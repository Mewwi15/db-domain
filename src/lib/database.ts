export type DatabaseRow = Record<string, unknown>;

export const databaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "",
  schema: process.env.NEXT_PUBLIC_SUPABASE_SCHEMA?.trim() || "public",
  table: process.env.NEXT_PUBLIC_SUPABASE_TABLE?.trim() ?? "",
  requireAuth: process.env.NEXT_PUBLIC_REQUIRE_AUTH !== "false",
  rowLimit: 100,
};

export const isConfigured = Boolean(databaseConfig.url && databaseConfig.key);

// Demo is used only when configuration is missing, never after a connection error.
export const demoRows: DatabaseRow[] = [
  { id: 1008, name: "รายการตัวอย่าง 008", category: "Website", status: "active", updated_at: "2026-11-05T03:15:00Z" },
  { id: 1007, name: "รายการตัวอย่าง 007", category: "Application", status: "active", updated_at: "2026-11-05T03:12:00Z" },
  { id: 1006, name: "รายการตัวอย่าง 006", category: "Service", status: "pending", updated_at: "2026-11-05T03:10:00Z" },
  { id: 1005, name: "รายการตัวอย่าง 005", category: "Website", status: "active", updated_at: "2026-11-05T03:06:00Z" },
  { id: 1004, name: "รายการตัวอย่าง 004", category: "Service", status: "inactive", updated_at: "2026-11-05T03:02:00Z" },
  { id: 1003, name: "รายการตัวอย่าง 003", category: "Application", status: "active", updated_at: "2026-11-05T02:58:00Z" },
  { id: 1002, name: "รายการตัวอย่าง 002", category: "Website", status: "pending", updated_at: "2026-11-05T02:54:00Z" },
  { id: 1001, name: "รายการตัวอย่าง 001", category: "Application", status: "active", updated_at: "2026-11-05T02:51:00Z" },
];

export function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
