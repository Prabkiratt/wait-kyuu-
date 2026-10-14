import { db } from "@/lib/store";
import AuthForm from "@/components/AuthForm";
import { googleConfigured } from "@/lib/google";

export const metadata = { title: "Business sign in" };
export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: PageProps<"/merchant/login">) {
  const sp = await searchParams;
  const error = Array.isArray(sp.error) ? sp.error[0] : sp.error;
  const demo = process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "1";
  const demos = demo ? db.businesses.slice(0, 11).map((b) => ({ slug: b.slug, name: b.name })) : [];
  return <AuthForm role="merchant" googleEnabled={googleConfigured()} error={error} demos={demos} />;
}
