import fs from "node:fs";
import path from "node:path";
import type { DB } from "../../../src/lib/types";
import type { Persistence } from "./types";

/** Zero-config local development: one JSON file. Not for production. */
export function filePersistence(file = path.join(process.cwd(), ".data", "db.json")): Persistence {
  return {
    name: `file:${path.relative(process.cwd(), file)}`,
    async init() {},
    async load() {
      try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")) as DB;
      } catch (e) {
        console.error("[persist] could not read data file, starting from seed:", (e as Error).message);
      }
      return null;
    },
    async save(db) {
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const tmp = `${file}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(db));
        fs.renameSync(tmp, file); // atomic replace: never leave a half-written file
      } catch (e) {
        console.error("[persist] write failed:", (e as Error).message);
      }
    },
    async close() {},
  };
}
