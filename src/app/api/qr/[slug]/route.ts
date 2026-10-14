import QRCode from "qrcode";
import { bizBySlug } from "@/lib/engine";

/** SVG QR code that points at /join/<slug>. Public: it only encodes a public URL. */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!bizBySlug(slug)) return new Response("Not found", { status: 404 });
  const origin = new URL(req.url).origin;
  const svg = await QRCode.toString(`${origin}/join/${slug}`, { type: "svg", margin: 1, width: 512, errorCorrectionLevel: "M" });
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" } });
}
