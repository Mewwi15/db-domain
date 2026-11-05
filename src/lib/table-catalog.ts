export type TableDefinition = {
  schema: string;
  name: string;
  primaryKey: string[];
  orderColumn?: string;
  columns?: string[];
  canRead?: boolean;
  realtimeEnabled?: boolean;
  isPartitioned?: boolean;
};

export function tableId(table: Pick<TableDefinition, "schema" | "name">): string {
  return JSON.stringify([table.schema, table.name]);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Accept SQL Editor JSON or names separated by newlines/commas. Never executes SQL. */
export function parseTableList(input: string, defaultSchema = "public"): TableDefinition[] {
  const text = input.trim();
  if (!text) throw new Error("กรุณาวางรายชื่อตารางก่อน");
  let entries: unknown;
  if (text.startsWith("[")) {
    try { entries = JSON.parse(text); }
    catch { throw new Error("JSON ไม่ถูกต้อง กรุณาคัดลอกค่าจากคอลัมน์ tables ให้ครบ"); }
  } else {
    entries = text.split(/[\n,]+/).map((name) => name.trim()).filter(Boolean);
  }
  if (!Array.isArray(entries) || !entries.length) throw new Error("ไม่พบรายชื่อตารางในรายการนี้");
  const tables = entries.map((entry, index): TableDefinition => {
    if (typeof entry === "string") {
      const parts = entry.trim().split(".");
      if (parts.length > 2 || parts.some((part) => !part.trim())) throw new Error(`ชื่อตารางรายการที่ ${index + 1} ไม่ถูกต้อง`);
      return { schema: parts.length === 2 ? parts[0].trim() : defaultSchema, name: parts.at(-1)!.trim(), primaryKey: [] };
    }
    if (!entry || typeof entry !== "object") throw new Error(`รายการที่ ${index + 1} ต้องเป็นชื่อตารางหรือข้อมูลตาราง`);
    const value = entry as Record<string, unknown>;
    const schema = value.schema ?? defaultSchema;
    const name = value.name;
    const primaryKey = value.primaryKey ?? [];
    if (!nonEmptyString(schema) || !nonEmptyString(name)
      || !Array.isArray(primaryKey) || !primaryKey.every(nonEmptyString)
      || (value.orderColumn !== undefined && !nonEmptyString(value.orderColumn))) {
      throw new Error(`schema, name หรือ primaryKey ของรายการที่ ${index + 1} ไม่ถูกต้อง`);
    }
    if (value.columns !== undefined && (!Array.isArray(value.columns) || !value.columns.every(nonEmptyString))) {
      throw new Error(`columns ของรายการที่ ${index + 1} ไม่ถูกต้อง`);
    }
    for (const flag of ["canRead", "realtimeEnabled", "isPartitioned"]) {
      if (value[flag] !== undefined && typeof value[flag] !== "boolean") throw new Error(`ค่า ${flag} ไม่ถูกต้อง`);
    }
    return {
      schema: schema.trim(), name: name.trim(), primaryKey: [...new Set(primaryKey.map((key: string) => key.trim()))],
      ...(value.orderColumn ? { orderColumn: (value.orderColumn as string).trim() } : {}),
      ...(value.columns ? { columns: value.columns as string[] } : {}),
      ...(typeof value.canRead === "boolean" ? { canRead: value.canRead } : {}),
      ...(typeof value.realtimeEnabled === "boolean" ? { realtimeEnabled: value.realtimeEnabled } : {}),
      ...(typeof value.isPartitioned === "boolean" ? { isPartitioned: value.isPartitioned } : {}),
    };
  });
  return mergeTables([], tables);
}

export function parseDatabaseCatalog(data: unknown): TableDefinition[] {
  if (!Array.isArray(data)) throw new Error("รูปแบบรายชื่อตารางจากฐานข้อมูลไม่ถูกต้อง");
  return data.length ? parseTableList(JSON.stringify(data)) : [];
}

export function mergeTables(existing: TableDefinition[], incoming: TableDefinition[]): TableDefinition[] {
  const result = new Map(existing.map((table) => [tableId(table), table]));
  for (const table of incoming) result.set(tableId(table), table);
  return [...result.values()].sort((a, b) => a.schema.localeCompare(b.schema) || a.name.localeCompare(b.name));
}

/** A table without known keys can still be viewed; identical rows get distinct keys. */
export function identifyRows<T extends Record<string, unknown>>(rows: T[], primaryKey: string[]) {
  const occurrences = new Map<string, number>();
  return rows.map((data) => {
    const keys = primaryKey.length ? primaryKey : ["id"];
    const hasKey = keys.every((key) => data[key] !== undefined && data[key] !== null);
    const base = JSON.stringify(hasKey ? keys.map((key) => data[key]) : Object.entries(data).sort(([a], [b]) => a.localeCompare(b)));
    const occurrence = occurrences.get(base) ?? 0;
    occurrences.set(base, occurrence + 1);
    return { key: `${base}:${occurrence}`, data };
  });
}
