import BusinessView from "@/components/BusinessView";

export const metadata = { title: "Live queue" };

export default async function BusinessPage({ params, searchParams }: PageProps<"/business/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  return <BusinessView slug={slug} autoJoin={sp.join === "1"} />;
}
