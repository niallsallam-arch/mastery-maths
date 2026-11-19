import { createClient, Client, InValue } from "@libsql/client";

// Local development uses a SQLite file; production uses a hosted Turso database (same SQL).
let client: Client | null = null;
let ready: Promise<void> | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS skill_state (id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'unknown', level INTEGER NOT NULL DEFAULT 1, stage INTEGER NOT NULL DEFAULT 0, next_check INTEGER, mastered_at INTEGER, since INTEGER, traced INTEGER);
CREATE TABLE IF NOT EXISTS attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, session_id INTEGER, skill_id TEXT, mode TEXT NOT NULL, level INTEGER, prompt TEXT, answer TEXT, response TEXT, correct INTEGER NOT NULL, ms INTEGER, flags TEXT, label TEXT, explain_ms INTEGER, payload TEXT);
CREATE INDEX IF NOT EXISTS attempts_skill ON attempts(skill_id, ts);
CREATE INDEX IF NOT EXISTS attempts_session ON attempts(session_id);
CREATE TABLE IF NOT EXISTS fact_state (fact TEXT PRIMARY KEY, box INTEGER NOT NULL DEFAULT 0, last_ms INTEGER, due INTEGER NOT NULL DEFAULT 0, seen INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, started INTEGER NOT NULL, ended INTEGER, minutes INTEGER, active_ms INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS challenges (id INTEGER PRIMARY KEY AUTOINCREMENT, grade INTEGER NOT NULL, started INTEGER NOT NULL, finished INTEGER, questions TEXT NOT NULL, idx INTEGER NOT NULL DEFAULT 0, correct INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL, passed INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS rewards (id INTEGER PRIMARY KEY AUTOINCREMENT, grade INTEGER NOT NULL, amount REAL NOT NULL, earned INTEGER NOT NULL, paid INTEGER);
CREATE TABLE IF NOT EXISTS pending (id TEXT PRIMARY KEY, created INTEGER NOT NULL, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

export async function db(): Promise<Client> {
  if (!client) {
    client = createClient({ url: process.env.TURSO_DATABASE_URL || "file:local.db", authToken: process.env.TURSO_AUTH_TOKEN });
    ready = client.executeMultiple(SCHEMA);
  }
  await ready;
  return client;
}

export async function all<T = Record<string, unknown>>(sql: string, args: InValue[] = []): Promise<T[]> {
  const r = await (await db()).execute({ sql, args });
  return r.rows as unknown as T[];
}
export async function one<T = Record<string, unknown>>(sql: string, args: InValue[] = []): Promise<T | undefined> {
  return (await all<T>(sql, args))[0];
}
export async function run(sql: string, args: InValue[] = []) {
  return (await db()).execute({ sql, args });
}

// ── Settings
export interface Settings {
  rewards: Record<string, number>;   // grade → amount earned for 100% on that grade's challenge
  currency: string;
  interests: string;                 // used to theme AI explanations
  autoRead: boolean;
  minutes: number;                   // standard session length
  shortMinutes: number;              // fallback session length
  ai: boolean;
  name: string;
}
export const DEFAULT_SETTINGS: Settings = {
  rewards: { "3": 20, "4": 30, "5": 40, "6": 60, "7": 80, "8": 120 },
  currency: "$",
  interests: "",
  autoRead: false,
  minutes: 20,
  shortMinutes: 10,
  ai: true,
  name: "Amira",
};
export async function getSettings(): Promise<Settings> {
  const rows = await all<{ key: string; value: string }>("SELECT key, value FROM settings");
  const s: Settings = structuredClone(DEFAULT_SETTINGS);
  for (const r of rows) (s as unknown as Record<string, unknown>)[r.key] = JSON.parse(r.value);
  return s;
}
export async function saveSettings(patch: Partial<Settings>) {
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in DEFAULT_SETTINGS)) continue;
    await run("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [k, JSON.stringify(v)]);
  }
}
