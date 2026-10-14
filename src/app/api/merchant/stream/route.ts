import { merchantView } from "@/lib/engine";
import { currentUser, ownedBusiness, sse } from "@/lib/server";
import { AppError } from "@/lib/engine";
import { db } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || user.role !== "merchant") return Response.json({ error: "Please sign in" }, { status: 401 });
  const biz = await ownedBusiness(user).catch(() => null);
  if (!biz) return Response.json({ error: "no-business" }, { status: 404 });
  // re-resolve on each push so edits are reflected, but ownership is fixed to this session's user
  return sse(req, () => {
    const b = db.businesses.find((x) => x.id === biz.id);
    if (!b) throw new AppError("Business not found", 404);
    return merchantView(b);
  });
}
