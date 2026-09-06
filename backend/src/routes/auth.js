import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, transaction } from '../config/db.js';
import { authenticate, signToken } from '../middleware/auth.js';
import { asyncHandler, HttpError, requireFields } from '../utils/http.js';

const router = Router();
const COLORS = ['#7259ee', '#0ea5a0', '#e36b52', '#3487eb', '#d14f8b'];

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, avatarColor: user.avatar_color };
}

router.post('/register', asyncHandler(async (req, res) => {
  requireFields(req.body, ['name', 'email', 'password']);
  if (req.body.password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  const email = req.body.email.trim().toLowerCase();
  const existing = await query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (existing.rowCount) throw new HttpError(409, 'An account with that email already exists');

  const result = await transaction(async (client) => {
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const { rows: users } = await client.query(
      'INSERT INTO users (name, email, password_hash, avatar_color) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.body.name.trim(), email, passwordHash, color],
    );
    const user = users[0];
    const workspaceName = req.body.workspaceName?.trim() || `${user.name.split(' ')[0]}'s workspace`;
    const { rows: workspaces } = await client.query(
      'INSERT INTO workspaces (name, owner_id) VALUES ($1, $2) RETURNING *', [workspaceName, user.id],
    );
    const workspace = workspaces[0];
    await client.query('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)', [workspace.id, user.id, 'owner']);
    const { rows: boards } = await client.query(
      `INSERT INTO boards (workspace_id, name, description, color, created_by)
       VALUES ($1, 'Product launch', 'Everything we need to ship something remarkable.', '#7259ee', $2) RETURNING *`,
      [workspace.id, user.id],
    );
    const board = boards[0];
    const { rows: lists } = await client.query(
      `INSERT INTO lists (board_id, title, position) VALUES
        ($1, 'Ideas', 1000), ($1, 'In progress', 2000), ($1, 'Review', 3000), ($1, 'Done', 4000)
       RETURNING *`, [board.id],
    );
    const idea = lists.find((list) => list.title === 'Ideas');
    const progress = lists.find((list) => list.title === 'In progress');
    await client.query(
      `INSERT INTO cards (list_id, title, description, priority, labels, position, created_by) VALUES
       ($1, 'Map the customer journey', 'Document the key moments from discovery through activation.', 'high', '[{"name":"Research","color":"#8b5cf6"}]', 1000, $3),
       ($1, 'Define launch metrics', 'Choose a focused set of outcomes for the first 30 days.', 'medium', '[{"name":"Strategy","color":"#0ea5a0"}]', 2000, $3),
       ($2, 'Prototype onboarding', 'Create a warm, focused first-run experience.', 'urgent', '[{"name":"Design","color":"#e36b52"}]', 1000, $3)`,
      [idea.id, progress.id, user.id],
    );
    return { user, workspace };
  });

  res.status(201).json({ token: signToken(result.user.id), user: publicUser(result.user), workspaceId: result.workspace.id });
}));

router.post('/login', asyncHandler(async (req, res) => {
  requireFields(req.body, ['email', 'password']);
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [req.body.email.trim().toLowerCase()]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(req.body.password, user.password_hash))) {
    throw new HttpError(401, 'Incorrect email or password');
  }
  res.json({ token: signToken(user.id), user: publicUser(user) });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const { rows: memberships } = await query(`
    SELECT w.id, w.name, w.description, wm.role
    FROM workspace_members wm JOIN workspaces w ON w.id = wm.workspace_id
    WHERE wm.user_id = $1 ORDER BY wm.joined_at
  `, [req.user.id]);
  res.json({ user: publicUser(req.user), workspaces: memberships });
}));

export default router;
