import { redirect } from "next/navigation";

export default async function LegacyEventDemo({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const params = await searchParams;
  const ref = typeof params.ref === "string" ? `?ref=${encodeURIComponent(params.ref)}` : "";
  redirect(`/examples/event${ref}`);
}
