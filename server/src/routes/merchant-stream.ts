import { AppError, merchantView } from "../lib/engine";
import { currentUser, issueStreamToken, ownedBusiness, requireUser, sse, userFromStreamToken, handle, json } from "../lib/server";
import { db } from "../lib/store";

/**
 * Live dashboard feed. The browser opens this directly on the API host, where cookies aren't sent,
 * so it authenticates with a short-lived stream token (see POST /api/merchant/stream-token).
 * A normal session cookie also works (same-origin local dev).
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t");
  const user = userFromStreamToken(token) ?? (await currentUser());
  if (!user || user.role !== "merchant") return Response.json({ error: "Please sign in" }, { status: 401 });
  const biz = await ownedBusiness(user).catch(() => null);
  if (!biz) return Response.json({ error: "no-business" }, { status: 404 });
  // re-resolve on each push so edits are reflected, but ownership is fixed to this stream's user
  return sse(req, () => {
    const b = db.businesses.find((x) => x.id === biz.id);
    if (!b) throw new AppError("Business not found", 404);
    return merchantView(b);
  });
}

export const POST = handle(async () => {
  const user = await requireUser("merchant");
  return json({ token: issueStreamToken(user.id), expiresInSec: 900 });
});
