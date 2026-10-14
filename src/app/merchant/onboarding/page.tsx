import { db } from "@/lib/store";
import { areas } from "@/lib/market";
import Onboarding from "@/components/Onboarding";

export const metadata = { title: "Set up your business" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <Onboarding categories={db.categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon }))} areas={areas()} />;
}
