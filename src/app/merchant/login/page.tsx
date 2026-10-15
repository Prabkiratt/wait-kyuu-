import AuthForm from "@/components/AuthForm";
import { getBootstrap } from "@/lib/api-server";

export const metadata = { title: "Business sign in" };

export default async function Login({ searchParams }: PageProps<"/merchant/login">) {
  const sp = await searchParams;
  const error = Array.isArray(sp.error) ? sp.error[0] : sp.error;
  const boot = await getBootstrap();
  return <AuthForm role="merchant" googleEnabled={boot.googleEnabled} error={error} demos={boot.demo?.businesses ?? []} />;
}
