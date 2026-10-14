import type { Metadata } from "next";
import BusinessView from "@/components/BusinessView";
import { bizBySlug } from "@/lib/engine";

export async function generateMetadata({ params }: PageProps<"/business/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const b = bizBySlug(slug);
  return { title: b ? `${b.name}: live queue` : "Business" };
}

export default async function BusinessPage({ params, searchParams }: PageProps<"/business/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  return <BusinessView slug={slug} autoJoin={sp.join === "1"} />;
}
