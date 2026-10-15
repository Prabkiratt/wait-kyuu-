import { filePersistence } from "./file";
import { pgPersistence } from "./pg";
import type { Persistence } from "./types";

/** DATABASE_URL (Supabase Postgres) in production; a JSON file for zero-config local development. */
export function createPersistence(): Persistence {
  const url = process.env.DATABASE_URL;
  if (url) return pgPersistence(url);
  if (process.env.NODE_ENV === "production") {
    console.warn("[persist] DATABASE_URL is not set: using a local file. Data will NOT survive a redeploy.");
  }
  return filePersistence();
}
