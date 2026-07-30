import { NextResponse } from "next/server";
import { database, databaseConfigured, ensureDatabaseSchema } from "../../../lib/db";

export const dynamic = "force-dynamic";

const validClientId = (value: unknown) => typeof value === "string" && /^[a-zA-Z0-9_-]{12,80}$/.test(value);
const validAction = (value: unknown): value is "opened" | "saved" | "hidden" =>
  value === "opened" || value === "saved" || value === "hidden";

export async function GET(request: Request) {
  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!validClientId(clientId)) return NextResponse.json({ error: "无效的客户端标识" }, { status: 400 });
  if (!databaseConfigured()) return NextResponse.json({ configured: false, feedback: {} });
  try {
    await ensureDatabaseSchema();
    const sql = database();
    if (!sql) return NextResponse.json({ configured: false, feedback: {} });
    const rows = await sql`
      SELECT story_id, action, action_count, scoring_version, last_action_at
      FROM selection_feedback
      WHERE client_id = ${clientId}
    `;
    const feedback: Record<string, { opened: number; saved: number; hidden: number; scoringVersion: string; lastActionAt: string }> = {};
    rows.forEach((row) => {
      const storyId = String(row.story_id);
      const current = feedback[storyId] ?? { opened: 0, saved: 0, hidden: 0, scoringVersion: String(row.scoring_version), lastActionAt: new Date(row.last_action_at as string).toISOString() };
      current[row.action as "opened" | "saved" | "hidden"] = Number(row.action_count);
      if (new Date(row.last_action_at as string).getTime() > new Date(current.lastActionAt).getTime()) {
        current.lastActionAt = new Date(row.last_action_at as string).toISOString();
      }
      feedback[storyId] = current;
    });
    return NextResponse.json({ configured: true, feedback });
  } catch {
    return NextResponse.json({ error: "反馈数据库暂时不可用" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    clientId?: string; storyId?: string; action?: string; scoringVersion?: string;
    source?: string; category?: string; eventKey?: string;
  };
  if (!validClientId(body.clientId) || !body.storyId || !validAction(body.action)) {
    return NextResponse.json({ error: "反馈参数不完整" }, { status: 400 });
  }
  if (!databaseConfigured()) return NextResponse.json({ configured: false, stored: false });
  try {
    await ensureDatabaseSchema();
    const sql = database();
    if (!sql) return NextResponse.json({ configured: false, stored: false });
    await sql`
      INSERT INTO selection_feedback (
        client_id, story_id, action, action_count, scoring_version,
        source_name, category, event_key, last_action_at
      ) VALUES (
        ${body.clientId}, ${body.storyId.slice(0, 240)}, ${body.action}, 1,
        ${(body.scoringVersion || "legacy").slice(0, 64)},
        ${(body.source || "").slice(0, 160)}, ${(body.category || "").slice(0, 120)},
        ${(body.eventKey || "").slice(0, 240)}, NOW()
      )
      ON CONFLICT (client_id, story_id, action)
      DO UPDATE SET
        action_count = selection_feedback.action_count + 1,
        scoring_version = EXCLUDED.scoring_version,
        source_name = EXCLUDED.source_name,
        category = EXCLUDED.category,
        event_key = EXCLUDED.event_key,
        last_action_at = NOW()
    `;
    return NextResponse.json({ configured: true, stored: true });
  } catch {
    return NextResponse.json({ error: "反馈暂时未写入数据库" }, { status: 503 });
  }
}
