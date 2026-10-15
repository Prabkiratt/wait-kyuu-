import Onboarding from "@/components/Onboarding";
import { getBootstrap } from "@/lib/api-server";

export const metadata = { title: "Set up your business" };

export default async function Page() {
  const { categories, areas } = await getBootstrap();
  return <Onboarding categories={categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon }))} areas={areas} />;
}
