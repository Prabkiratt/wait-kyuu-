import AdminShell from "@/components/admin/AdminShell";
import AuthForm from "@/components/AuthForm";
import { getBootstrap, getMe } from "@/lib/api-server";

export const metadata = { title: "Admin console", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Server-side gate: nothing from the console is rendered unless the API says this session is an admin. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const [{ user }, boot] = await Promise.all([getMe(), getBootstrap()]);
  if (!user || user.role !== "admin") return <AuthForm role="admin" googleEnabled={boot.googleEnabled} />;
  return (
    <AdminShell admin={{ name: user.name, email: user.email, picture: user.picture }} platform={boot.platformName}>
      {children}
    </AdminShell>
  );
}
