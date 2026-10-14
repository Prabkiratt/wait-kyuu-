import { db, uid } from "./store";

/** Append-only record of admin and security-relevant actions. Persisted on the next notify(). */
export function audit(actor: string, action: string, target: string, detail?: string) {
  db.audit.push({ id: uid(), at: Date.now(), actor, action, target, detail });
  if (db.audit.length > 2000) db.audit.splice(0, db.audit.length - 2000);
}
