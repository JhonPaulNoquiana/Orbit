import pg from 'pg';

const { Pool, Client } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function initializeDatabase() {
  try {
    await createSchema();
  } catch (error) {
    if (error.code !== '3D000') throw error;
    await createConfiguredDatabase();
    await createSchema();
  }
}

async function createConfiguredDatabase() {
  const target = new URL(process.env.DATABASE_URL);
  const databaseName = decodeURIComponent(target.pathname.slice(1));
  if (!/^[a-zA-Z0-9_-]+$/.test(databaseName)) {
    throw new Error('The configured database name contains unsupported characters');
  }
  target.pathname = '/postgres';
  const client = new Client({
    connectionString: target.toString(),
    ssl: target.hostname === 'localhost' || target.hostname === '127.0.0.1' ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE "${databaseName.replaceAll('"', '""')}"`);
    console.log(`Created PostgreSQL database ${databaseName}.`);
  } finally {
    await client.end();
  }
}

async function createSchema() {
  await query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_color VARCHAR(20) NOT NULL DEFAULT '#7259ee',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(120) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS workspace_members (
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(12) NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'guest')),
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (workspace_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS boards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name VARCHAR(120) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      color VARCHAR(20) NOT NULL DEFAULT '#6c5ce7',
      is_starred BOOLEAN NOT NULL DEFAULT FALSE,
      archived BOOLEAN NOT NULL DEFAULT FALSE,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS board_guests (
      board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (board_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS lists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      title VARCHAR(120) NOT NULL,
      position DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      title VARCHAR(180) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      due_date TIMESTAMPTZ,
      labels JSONB NOT NULL DEFAULT '[]'::jsonb,
      assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
      position DOUBLE PRECISION NOT NULL DEFAULT 0,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(80) NOT NULL,
      entity_type VARCHAR(30) NOT NULL,
      entity_name VARCHAR(180) NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_boards_workspace ON boards(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_lists_board ON lists(board_id, position);
    CREATE INDEX IF NOT EXISTS idx_cards_list ON cards(list_id, position);
    CREATE INDEX IF NOT EXISTS idx_activity_workspace ON activity_logs(workspace_id, created_at DESC);
  `);
}
