import * as SQLite from "expo-sqlite";
import type { IdentifyResult } from "./types";

export interface HistoryItem {
  id: number;
  createdAt: number;
  photoUri: string;
  result: IdentifyResult;
}

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync("history.db");
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL,
        photo_uri TEXT NOT NULL,
        result TEXT NOT NULL
      );
    `);
  }
  return db;
}

export async function saveToHistory(photoUri: string, result: IdentifyResult): Promise<number> {
  const conn = await getDb();
  const res = await conn.runAsync(
    "INSERT INTO history (created_at, photo_uri, result) VALUES (?, ?, ?)",
    Date.now(),
    photoUri,
    JSON.stringify(result),
  );
  return res.lastInsertRowId;
}

type Row = { id: number; created_at: number; photo_uri: string; result: string };

function toItem(row: Row): HistoryItem {
  return {
    id: row.id,
    createdAt: row.created_at,
    photoUri: row.photo_uri,
    result: JSON.parse(row.result) as IdentifyResult,
  };
}

export async function listHistory(limit = 50): Promise<HistoryItem[]> {
  const conn = await getDb();
  const rows = await conn.getAllAsync<Row>(
    "SELECT * FROM history ORDER BY created_at DESC LIMIT ?",
    limit,
  );
  return rows.map(toItem);
}

export async function getHistoryItem(id: number): Promise<HistoryItem | null> {
  const conn = await getDb();
  const row = await conn.getFirstAsync<Row>("SELECT * FROM history WHERE id = ?", id);
  return row ? toItem(row) : null;
}

export async function deleteHistoryItem(id: number): Promise<void> {
  const conn = await getDb();
  await conn.runAsync("DELETE FROM history WHERE id = ?", id);
}
