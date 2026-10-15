import type { DB } from "../../../src/lib/types";

/** Where the in-memory dataset is durably stored. */
export interface Persistence {
  readonly name: string;
  /** Prepare storage (create schema, open pool). */
  init(): Promise<void>;
  /** Load everything, or null when the store has never been initialised. */
  load(): Promise<DB | null>;
  /** Persist the dataset. Implementations write only what changed since the last call. */
  save(db: DB): Promise<void>;
  close(): Promise<void>;
}
