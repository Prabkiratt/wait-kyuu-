import { notFound } from "next/navigation";
import Overview from "@/components/admin/Overview";
import Businesses from "@/components/admin/Businesses";
import Queues from "@/components/admin/Queues";
import Tickets from "@/components/admin/Tickets";
import Users from "@/components/admin/Users";
import { Reviews, Categories, Audit } from "@/components/admin/Misc";
import Settings from "@/components/admin/Settings";

const SECTIONS: Record<string, React.ComponentType> = {
  overview: Overview, businesses: Businesses, queues: Queues, tickets: Tickets, users: Users,
  reviews: Reviews, categories: Categories, settings: Settings, audit: Audit,
};

export default async function Section({ params }: PageProps<"/admin/[section]">) {
  const { section } = await params;
  const C = SECTIONS[section];
  if (!C) notFound();
  return <C />;
}
