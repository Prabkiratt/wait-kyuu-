import { redirect } from "next/navigation";

/** Target of the business QR code: land straight on the join flow. */
export default async function Join({ params }: PageProps<"/join/[slug]">) {
  const { slug } = await params;
  redirect(`/business/${encodeURIComponent(slug)}?join=1`);
}
