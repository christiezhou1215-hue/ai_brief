import { neon } from "@neondatabase/serverless";

export const databaseConfigured = () => Boolean(process.env.DATABASE_URL);

export const database = () => {
  const connectionString = process.env.DATABASE_URL;
  return connectionString ? neon(connectionString) : null;
};

let schemaReady: Promise<void> | null = null;

export const ensureDatabaseSchema = async () => {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const sql = database();
    if (!sql) return;
    await sql`
      CREATE TABLE IF NOT EXISTS selection_feedback (
        client_id TEXT NOT NULL,
        story_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('opened', 'saved', 'hidden')),
        action_count INTEGER NOT NULL DEFAULT 0,
        scoring_version TEXT NOT NULL,
        source_name TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '',
        event_key TEXT NOT NULL DEFAULT '',
        last_action_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (client_id, story_id, action)
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS selection_feedback_version_idx
      ON selection_feedback (scoring_version, last_action_at DESC)
    `;
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
};
