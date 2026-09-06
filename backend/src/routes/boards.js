import { Router } from 'express';
import { query, transaction } from '../config/db.js';
import { asyncHandler, HttpError, requireFields } from '../utils/http.js';
import { getBoardAccess, requireWorkspaceRole } from '../middleware/permissions.js';

const router = Router();

async function logActivity(userId, workspaceId, boardId, action, entityType, entityName, client = { query }) {
  await client.query(
    'INSERT INTO activity_logs (workspace_id, board_id, user_id, action, entity_type, entity_name) VALUES ($1, $2, $3, $4, $5, $6)',
    [workspaceId, boardId, userId, action, entityType, entityName],
  );
}

router.get('/workspace/:workspaceId', asyncHandler(async (req, res) => {
  const membership = await requireWorkspaceRole(req.user.id, req.params.workspaceId);
  const guestClause = membership.role === 'guest' ? 'AND EXISTS (SELECT 1 FROM board_guests bg WHERE bg.board_id = b.id AND bg.user_id = $2)' : '';
  const params = membership.role === 'guest' ? [req.params.workspaceId, req.user.id] : [req.params.workspaceId];
  const { rows } = await query(`
    SELECT b.*,
      (SELECT COUNT(*)::int FROM lists l WHERE l.board_id = b.id) AS list_count,
      (SELECT COUNT(*)::int FROM cards c JOIN lists l ON l.id = c.list_id WHERE l.board_id = b.id) AS card_count,
      (SELECT COUNT(*)::int FROM cards c JOIN lists l ON l.id = c.list_id WHERE l.board_id = b.id AND c.completed) AS completed_count
    FROM boards b WHERE b.workspace_id = $1 AND b.archived = FALSE ${guestClause}
    ORDER BY b.is_starred DESC, b.updated_at DESC
  `, params);
  res.json(rows);
}));

router.post('/workspace/:workspaceId', asyncHandler(async (req, res) => {
  await requireWorkspaceRole(req.user.id, req.params.workspaceId, 'member');
  requireFields(req.body, ['name']);
  const result = await transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO boards (workspace_id, name, description, color, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.workspaceId, req.body.name.trim(), req.body.description?.trim() || '', req.body.color || '#7259ee', req.user.id],
    );
    const board = rows[0];
    const defaults = req.body.withDefaults !== false ? ['Backlog', 'In progress', 'Review', 'Done'] : [];
    for (const [index, title] of defaults.entries()) {
      await client.query('INSERT INTO lists (board_id, title, position) VALUES ($1, $2, $3)', [board.id, title, (index + 1) * 1000]);
    }
    await logActivity(req.user.id, req.params.workspaceId, board.id, 'created', 'board', board.name, client);
    return board;
  });
  res.status(201).json(result);
}));

router.get('/:boardId', asyncHandler(async (req, res) => {
  const board = await getBoardAccess(req.user.id, req.params.boardId);
  const [{ rows: lists }, { rows: members }] = await Promise.all([
    query(`
      SELECT l.*, COALESCE(json_agg(
        json_build_object('id', c.id, 'title', c.title, 'description', c.description, 'priority', c.priority,
          'due_date', c.due_date, 'labels', c.labels, 'assignee_id', c.assignee_id, 'position', c.position,
          'completed', c.completed, 'comment_count', (SELECT COUNT(*)::int FROM comments cm WHERE cm.card_id = c.id))
        ORDER BY c.position) FILTER (WHERE c.id IS NOT NULL), '[]') AS cards
      FROM lists l LEFT JOIN cards c ON c.list_id = l.id
      WHERE l.board_id = $1 GROUP BY l.id ORDER BY l.position
    `, [req.params.boardId]),
    query(`SELECT u.id, u.name, u.email, u.avatar_color, wm.role
      FROM workspace_members wm JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = $1 AND (wm.role <> 'guest' OR EXISTS
        (SELECT 1 FROM board_guests bg WHERE bg.board_id = $2 AND bg.user_id = u.id)) ORDER BY u.name`, [board.workspace_id, board.id]),
  ]);
  res.json({ board, lists, members });
}));

router.patch('/:boardId', asyncHandler(async (req, res) => {
  const board = await getBoardAccess(req.user.id, req.params.boardId, 'member');
  const { rows } = await query(
    `UPDATE boards SET name = COALESCE($1, name), description = COALESCE($2, description),
      color = COALESCE($3, color), is_starred = COALESCE($4, is_starred), archived = COALESCE($5, archived), updated_at = NOW()
     WHERE id = $6 RETURNING *`,
    [req.body.name?.trim() || null, req.body.description ?? null, req.body.color || null,
      typeof req.body.isStarred === 'boolean' ? req.body.isStarred : null,
      typeof req.body.archived === 'boolean' ? req.body.archived : null, req.params.boardId],
  );
  await logActivity(req.user.id, board.workspace_id, board.id, 'updated', 'board', rows[0].name);
  res.json(rows[0]);
}));

router.delete('/:boardId', asyncHandler(async (req, res) => {
  const board = await getBoardAccess(req.user.id, req.params.boardId, 'admin');
  await logActivity(req.user.id, board.workspace_id, null, 'deleted', 'board', board.name);
  await query('DELETE FROM boards WHERE id = $1', [req.params.boardId]);
  res.status(204).end();
}));

router.post('/:boardId/lists', asyncHandler(async (req, res) => {
  const board = await getBoardAccess(req.user.id, req.params.boardId, 'member');
  requireFields(req.body, ['title']);
  const { rows: positions } = await query('SELECT COALESCE(MAX(position), 0) + 1000 AS position FROM lists WHERE board_id = $1', [board.id]);
  const { rows } = await query('INSERT INTO lists (board_id, title, position) VALUES ($1, $2, $3) RETURNING *', [board.id, req.body.title.trim(), positions[0].position]);
  await logActivity(req.user.id, board.workspace_id, board.id, 'added', 'list', rows[0].title);
  res.status(201).json({ ...rows[0], cards: [] });
}));

router.patch('/lists/:listId', asyncHandler(async (req, res) => {
  const { rows: found } = await query('SELECT * FROM lists WHERE id = $1', [req.params.listId]);
  if (!found[0]) throw new HttpError(404, 'List not found');
  await getBoardAccess(req.user.id, found[0].board_id, 'member');
  const { rows } = await query('UPDATE lists SET title = COALESCE($1, title), position = COALESCE($2, position) WHERE id = $3 RETURNING *', [req.body.title?.trim() || null, req.body.position ?? null, req.params.listId]);
  res.json(rows[0]);
}));

router.delete('/lists/:listId', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM lists WHERE id = $1', [req.params.listId]);
  if (!rows[0]) throw new HttpError(404, 'List not found');
  await getBoardAccess(req.user.id, rows[0].board_id, 'member');
  await query('DELETE FROM lists WHERE id = $1', [req.params.listId]);
  res.status(204).end();
}));

router.post('/lists/:listId/cards', asyncHandler(async (req, res) => {
  const { rows: lists } = await query('SELECT * FROM lists WHERE id = $1', [req.params.listId]);
  if (!lists[0]) throw new HttpError(404, 'List not found');
  const board = await getBoardAccess(req.user.id, lists[0].board_id, 'member');
  requireFields(req.body, ['title']);
  if (req.body.assigneeId) await ensureWorkspaceAssignee(req.body.assigneeId, board.workspace_id);
  const { rows: positions } = await query('SELECT COALESCE(MAX(position), 0) + 1000 AS position FROM cards WHERE list_id = $1', [req.params.listId]);
  const { rows } = await query(
    `INSERT INTO cards (list_id, title, description, priority, due_date, labels, assignee_id, position, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.params.listId, req.body.title.trim(), req.body.description?.trim() || '', req.body.priority || 'medium',
      req.body.dueDate || null, JSON.stringify(req.body.labels || []), req.body.assigneeId || null, positions[0].position, req.user.id],
  );
  await logActivity(req.user.id, board.workspace_id, board.id, 'created', 'card', rows[0].title);
  res.status(201).json({ ...rows[0], comment_count: 0 });
}));

router.patch('/cards/:cardId', asyncHandler(async (req, res) => {
  const board = await getCardBoard(req.params.cardId);
  await getBoardAccess(req.user.id, board.id, 'member');
  if (req.body.assigneeId) await ensureWorkspaceAssignee(req.body.assigneeId, board.workspace_id);
  if (req.body.listId) {
    const { rows: target } = await query('SELECT board_id FROM lists WHERE id = $1', [req.body.listId]);
    if (!target[0] || target[0].board_id !== board.id) throw new HttpError(400, 'Target list is not on this board');
  }
  const { rows } = await query(`
    UPDATE cards SET title = COALESCE($1, title), description = COALESCE($2, description),
      priority = COALESCE($3, priority), due_date = CASE WHEN $4::boolean THEN $5::timestamptz ELSE due_date END,
      labels = COALESCE($6::jsonb, labels), assignee_id = CASE WHEN $7::boolean THEN $8::uuid ELSE assignee_id END,
      list_id = COALESCE($9, list_id), position = COALESCE($10, position), completed = COALESCE($11, completed), updated_at = NOW()
    WHERE id = $12 RETURNING *
  `, [req.body.title?.trim() || null, req.body.description ?? null, req.body.priority || null,
    Object.hasOwn(req.body, 'dueDate'), req.body.dueDate || null,
    req.body.labels ? JSON.stringify(req.body.labels) : null,
    Object.hasOwn(req.body, 'assigneeId'), req.body.assigneeId || null,
    req.body.listId || null, req.body.position ?? null,
    typeof req.body.completed === 'boolean' ? req.body.completed : null, req.params.cardId]);
  const action = req.body.listId ? 'moved' : req.body.completed === true ? 'completed' : 'updated';
  await logActivity(req.user.id, board.workspace_id, board.id, action, 'card', rows[0].title);
  res.json(rows[0]);
}));

router.delete('/cards/:cardId', asyncHandler(async (req, res) => {
  const board = await getCardBoard(req.params.cardId);
  await getBoardAccess(req.user.id, board.id, 'member');
  const { rows } = await query('DELETE FROM cards WHERE id = $1 RETURNING title', [req.params.cardId]);
  await logActivity(req.user.id, board.workspace_id, board.id, 'deleted', 'card', rows[0].title);
  res.status(204).end();
}));

router.get('/cards/:cardId/comments', asyncHandler(async (req, res) => {
  await getCardAccessViaBoard(req.user.id, req.params.cardId);
  const { rows } = await query(`SELECT c.*, u.name AS user_name, u.avatar_color FROM comments c JOIN users u ON u.id = c.user_id WHERE c.card_id = $1 ORDER BY c.created_at`, [req.params.cardId]);
  res.json(rows);
}));

router.post('/cards/:cardId/comments', asyncHandler(async (req, res) => {
  const board = await getCardAccessViaBoard(req.user.id, req.params.cardId);
  requireFields(req.body, ['body']);
  const { rows } = await query(`
    WITH inserted AS (INSERT INTO comments (card_id, user_id, body) VALUES ($1, $2, $3) RETURNING *)
    SELECT inserted.*, u.name AS user_name, u.avatar_color FROM inserted JOIN users u ON u.id = inserted.user_id
  `, [req.params.cardId, req.user.id, req.body.body.trim()]);
  await logActivity(req.user.id, board.workspace_id, board.id, 'commented on', 'card', 'a card');
  res.status(201).json(rows[0]);
}));

async function getCardBoard(cardId) {
  const { rows } = await query('SELECT b.* FROM cards c JOIN lists l ON l.id = c.list_id JOIN boards b ON b.id = l.board_id WHERE c.id = $1', [cardId]);
  if (!rows[0]) throw new HttpError(404, 'Card not found');
  return rows[0];
}

async function getCardAccessViaBoard(userId, cardId) {
  const board = await getCardBoard(cardId);
  return getBoardAccess(userId, board.id);
}

async function ensureWorkspaceAssignee(userId, workspaceId) {
  const { rows } = await query('SELECT role FROM workspace_members WHERE user_id = $1 AND workspace_id = $2', [userId, workspaceId]);
  if (!rows[0] || rows[0].role === 'guest') throw new HttpError(400, 'Assignee must be a workspace owner, admin, or member');
}

export default router;
