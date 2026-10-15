import type { Metadata } from "next";
import { db } from "@/lib/db";
import { configured } from "@/lib/env";
import { showDirectory } from "@/lib/services/directory";
import HomePage, { metadata as homeMetadata } from "../home/page";
import BusinessPage, { metadata as businessMetadata } from "../business/page";
// Signed-out "/" is rewritten here by proxy.ts. Until enough salons are
// listed, the business page explains the product instead of an empty
// directory. /home and /business stay reachable directly.
export const dynamic = "force-dynamic";
const directory = async () => configured && (await showDirectory(db));
export async function generateMetadata(): Promise<Metadata> {
  return (await directory()) ? homeMetadata : businessMetadata;
}
export default async function Page(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (await directory()) ? <HomePage {...props} /> : <BusinessPage />;
}
