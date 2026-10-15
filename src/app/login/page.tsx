import AuthForm from "@/components/AuthForm";
import { getBootstrap } from "@/lib/api-server";

export const metadata = { title: "Sign in" };

/** Only same-site relative paths are allowed as post-login destinations (prevents open redirects). */
const safeNext = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") ? n : undefined);

export default async function Login({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const boot = await getBootstrap();
  return (
    <AuthForm
      role="customer" googleEnabled={boot.googleEnabled} next={safeNext(one(sp.next))} error={one(sp.error)}
      demos={boot.demo ? [{ slug: "customer", name: "Demo customer" }] : []}
    />
  );
}
