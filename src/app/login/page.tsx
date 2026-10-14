import AuthForm from "@/components/AuthForm";
import { googleConfigured, safeNext } from "@/lib/google";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const demo = process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "1";
  return (
    <AuthForm
      role="customer" googleEnabled={googleConfigured()} next={safeNext(one(sp.next)) ?? undefined} error={one(sp.error)}
      demos={demo ? [{ slug: "customer", name: "Demo customer" }] : []}
    />
  );
}
