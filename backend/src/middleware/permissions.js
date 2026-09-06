import { query } from '../config/db.js';
import { HttpError } from '../utils/http.js';

export const ROLE_RANK = { guest: 0, member: 1, admin: 2, owner: 3 };

export async function getMembership(userId, workspaceId) {
  const { rows } = await query(
    'SELECT workspace_id, user_id, role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId],
  );
  return rows[0];
}

export async function requireWorkspaceRole(userId, workspaceId, minimumRole = 'guest') {
  const membership = await getMembership(userId, workspaceId);
  if (!membership || ROLE_RANK[membership.role] < ROLE_RANK[minimumRole]) {
    throw new HttpError(403, 'You do not have permission to do that');
  }
  return membership;
}

export async function getBoardAccess(userId, boardId, minimumRole = 'guest') {
  const { rows } = await query(`
    SELECT b.*, wm.role,
      CASE WHEN wm.role <> 'guest' OR bg.user_id IS NOT NULL THEN TRUE ELSE FALSE END AS can_access
    FROM boards b
    JOIN workspace_members wm ON wm.workspace_id = b.workspace_id AND wm.user_id = $1
    LEFT JOIN board_guests bg ON bg.board_id = b.id AND bg.user_id = $1
    WHERE b.id = $2
  `, [userId, boardId]);
  const access = rows[0];
  if (!access || !access.can_access || ROLE_RANK[access.role] < ROLE_RANK[minimumRole]) {
    throw new HttpError(403, 'You do not have access to this board');
  }
  return access;
}

export async function getCardAccess(userId, cardId, minimumRole = 'guest') {
  const { rows } = await query('SELECT l.board_id FROM cards c JOIN lists l ON l.id = c.list_id WHERE c.id = $1', [cardId]);
  if (!rows[0]) throw new HttpError(404, 'Card not found');
  return getBoardAccess(userId, rows[0].board_id, minimumRole);
}
