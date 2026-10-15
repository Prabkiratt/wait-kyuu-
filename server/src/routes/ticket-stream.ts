import { db } from "../lib/store";
import { AppError, ticketView } from "../lib/engine";
import { sse } from "../lib/server";


/** A customer's private live view. The unguessable token is the credential; no phone numbers or other customers leave here. */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  return sse(req, () => {
    const t = db.tickets.find((x) => x.token === token);
    if (!t) throw new AppError("Ticket not found", 404);
    return ticketView(t);
  });
}
