import MarketBrowser from "@/components/MarketBrowser";

export const metadata = { title: "Explore" };

export default async function Search({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return (
    <div className="pt-6">
      <MarketBrowser search initialQ={one(sp.q)} initialCat={one(sp.cat)} />
    </div>
  );
}
