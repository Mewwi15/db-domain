import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

export async function GET() {
  const sql = await readFile(join(process.cwd(), "supabase/setup-db-explorer.sql"), "utf8");
  return new Response(sql, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="setup-db-explorer.sql"',
      "Cache-Control": "no-store",
    },
  });
}
