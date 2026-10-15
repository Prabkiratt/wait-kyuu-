import path from "node:path";
import dotenv from "dotenv";
import { serve } from "@hono/node-server";

// Local development convenience; on Render real environment variables win (dotenv never overrides).
dotenv.config({ path: [path.join(process.cwd(), "server/.env"), path.join(process.cwd(), ".env.local")] });

import { buildApp } from "./app";
import { flushStore, initStore } from "./lib/store";
import { createPersistence } from "./persist";

async function main() {
  const persistence = createPersistence();
  let ready = false;
  const app = buildApp(() => ({ ready, store: persistence.name }));
  const port = Number(process.env.PORT ?? 4000);

  // Bind first so the platform health check sees the process while the database warms up.
  const server = serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (i) => console.log(`[api] listening on :${i.port}`));
  await initStore(persistence);
  ready = true;

  let closing = false;
  const shutdown = async (sig: string) => {
    if (closing) return;
    closing = true;
    console.log(`[api] ${sig}: flushing data and shutting down`);
    server.close();
    await flushStore().catch(() => {});
    await persistence.close().catch(() => {});
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((e) => {
  console.error("[api] fatal:", e);
  process.exit(1);
});
