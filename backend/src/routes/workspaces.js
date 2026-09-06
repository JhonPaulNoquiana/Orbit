import { Router } from 'express';
import { query, transaction } from '../config/db.js';
import { asyncHandler, HttpError, requireFields } from '../utils/http.js';
import { requireWorkspaceRole, ROLE_RANK } from '../middleware/permissions.js';

const router = Router();

router.get('/:workspaceId', asyncHandler(async (req, res) => {
  const membership = await requireWorkspaceRole(req.user.id, req.params.workspaceId);
  const { rows } = await query('SELECT id, name, description, owner_id, created_at FROM workspaces WHERE id = $1', [req.params.workspaceId]);
  res.json({ ...rows[0], role: membership.role });
}));

router.patch('/:workspaceId', asyncHandler(async (req, res) => {
  await requireWorkspaceRole(req.user.id, req.params.workspaceId, 'admin');
  const { rows } = await query(
    `UPDATE workspaces SET name = COALESCE($1, name), description = COALESCE($2, description)
     WHERE id = $3 RETURNING id, name, description, owner_id`,
    [req.body.name?.trim() || null, req.body.description ?? null, req.params.workspaceId],
  );
  res.json(rows[0]);
}));

router.get('/:workspaceId/members', asyncHandler(async (req, res) => {
  await requireWorkspaceRole(req.user.id, req.params.workspaceId);
  const { rows } = await query(`
    SELECT u.id, u.name, u.email, u.avatar_color, wm.role, wm.joined_at,
      COALESCE(json_agg(bg.board_id) FILTER (WHERE bg.board_id IS NOT NULL), '[]') AS board_ids
    FROM workspace_members wm JOIN users u ON u.id = wm.user_id
    LEFT JOIN board_guests bg ON bg.user_id = u.id
      AND bg.board_id IN (SELECT id FROM boards WHERE workspace_id = wm.workspace_id)
    WHERE wm.workspace_id = $1 GROUP BY u.id, wm.role, wm.joined_at
    ORDER BY CASE wm.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'member' THEN 3 ELSE 4 END, u.name
  `, [req.params.workspaceId]);
  res.json(rows);
}));

router.post('/:workspaceId/members', asyncHandler(async (req, res) => {
  const actor = await requireWorkspaceRole(req.user.id, req.params.workspaceId, 'admin');
  requireFields(req.body, ['email', 'role']);
  const role = req.body.role.toLowerCase();
  if (!['admin', 'member', 'guest'].includes(role)) throw new HttpError(400, 'Choose admin, member, or guest');
  if (actor.role === 'admin' && role === 'admin') throw new HttpError(403, 'Only the owner can appoint admins');
  if (role === 'guest' && (!Array.isArray(req.body.boardIds) || req.body.boardIds.length === 0)) {
    throw new HttpError(400, 'Select at least one board for a guest');
  }
  const { rows: users } = await query('SELECT id, name, email, avatar_color FROM users WHERE email = $1', [req.body.email.trim().toLowerCase()]);
  if (!users[0]) throw new HttpError(404, 'No Orbit account uses that email yet');
  const existing = await getMembershipForUpdate(req.params.workspaceId, users[0].id);
  if (existing?.role === 'owner') throw new HttpError(403, 'The workspace owner role cannot be changed');
  if (actor.role !== 'owner' && existing?.role === 'admin') throw new HttpError(403, 'Only the owner can manage admins');

  await transaction(async (client) => {
    await client.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [req.params.workspaceId, users[0].id, role],
    );
    await client.query('DELETE FROM board_guests WHERE user_id = $1 AND board_id IN (SELECT id FROM boards WHERE workspace_id = $2)', [users[0].id, req.params.workspaceId]);
    if (role === 'guest' && Array.isArray(req.body.boardIds) && req.body.boardIds.length) {
      await client.query(
        `INSERT INTO board_guests (board_id, user_id)
         SELECT id, $1 FROM boards WHERE workspace_id = $2 AND id = ANY($3::uuid[]) ON CONFLICT DO NOTHING`,
        [users[0].id, req.params.workspaceId, req.body.boardIds],
      );
    }
  });
  res.status(201).json({ ...users[0], role });
}));

router.patch('/:workspaceId/members/:userId', asyncHandler(async (req, res) => {
  const actor = await requireWorkspaceRole(req.user.id, req.params.workspaceId, 'admin');
  const target = await requireWorkspaceRole(req.params.userId, req.params.workspaceId);
  const role = req.body.role?.toLowerCase();
  if (!['admin', 'member', 'guest'].includes(role)) throw new HttpError(400, 'Invalid role');
  if (target.role === 'owner') throw new HttpError(403, 'The workspace owner role cannot be changed');
  if (actor.role !== 'owner' && (target.role === 'admin' || role === 'admin')) throw new HttpError(403, 'Only the owner can manage admins');
  if (ROLE_RANK[target.role] > ROLE_RANK[actor.role]) throw new HttpError(403, 'You cannot manage this member');
  await transaction(async (client) => {
    await client.query('UPDATE workspace_members SET role = $1 WHERE workspace_id = $2 AND user_id = $3', [role, req.params.workspaceId, req.params.userId]);
    await client.query('DELETE FROM board_guests WHERE user_id = $1 AND board_id IN (SELECT id FROM boards WHERE workspace_id = $2)', [req.params.userId, req.params.workspaceId]);
    if (role === 'guest') {
      const boardIds = Array.isArray(req.body.boardIds) && req.body.boardIds.length
        ? req.body.boardIds
        : (await client.query('SELECT id FROM boards WHERE workspace_id = $1 AND archived = FALSE', [req.params.workspaceId])).rows.map((board) => board.id);
      if (boardIds.length) {
        await client.query(`INSERT INTO board_guests (board_id, user_id)
          SELECT id, $1 FROM boards WHERE workspace_id = $2 AND id = ANY($3::uuid[]) ON CONFLICT DO NOTHING`,
        [req.params.userId, req.params.workspaceId, boardIds]);
      }
    }
  });
  res.json({ role });
}));

router.delete('/:workspaceId/members/:userId', asyncHandler(async (req, res) => {
  const actor = await requireWorkspaceRole(req.user.id, req.params.workspaceId, 'admin');
  const target = await requireWorkspaceRole(req.params.userId, req.params.workspaceId);
  if (target.role === 'owner') throw new HttpError(403, 'The workspace owner cannot be removed');
  if (actor.role !== 'owner' && target.role === 'admin') throw new HttpError(403, 'Only the owner can remove admins');
  await query('DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [req.params.workspaceId, req.params.userId]);
  res.status(204).end();
}));

router.get('/:workspaceId/activity', asyncHandler(async (req, res) => {
  const membership = await requireWorkspaceRole(req.user.id, req.params.workspaceId);
  const guestClause = membership.role === 'guest'
    ? 'AND a.board_id IN (SELECT board_id FROM board_guests WHERE user_id = $2)'
    : '';
  const { rows } = await query(`
    SELECT a.*, u.name AS user_name, u.avatar_color
    FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id
    WHERE a.workspace_id = $1 ${guestClause} ORDER BY a.created_at DESC LIMIT 40
  `, membership.role === 'guest' ? [req.params.workspaceId, req.user.id] : [req.params.workspaceId]);
  res.json(rows);
}));

export default router;

async function getMembershipForUpdate(workspaceId, userId) {
  const { rows } = await query('SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [workspaceId, userId]);
  return rows[0];
}
