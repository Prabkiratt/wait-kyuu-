import AdminShell from "@/components/admin/AdminShell";
import AuthForm from "@/components/AuthForm";
import { currentUser } from "@/lib/server";
import { db } from "@/lib/store";
import { googleConfigured } from "@/lib/google";

export const metadata = { title: "Admin console", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Server-side gate: nothing from the console is rendered unless the session belongs to an admin. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await currentUser();
  if (!user || user.role !== "admin") return <AuthForm role="admin" googleEnabled={googleConfigured()} />;
  return (
    <AdminShell admin={{ name: user.name ?? user.email.split("@")[0], email: user.email, picture: user.picture ?? null }} platform={db.settings.platformName}>
      {children}
    </AdminShell>
  );
}
