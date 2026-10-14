import type { Metadata } from "next";
import TicketLive from "@/components/TicketLive";

export const metadata: Metadata = { title: "Your ticket", robots: { index: false } };

export default async function TicketPage({ params }: PageProps<"/t/[token]">) {
  const { token } = await params;
  return <TicketLive token={token} />;
}
