import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReviewTool } from "./ReviewTool";

export const metadata: Metadata = { title: "SafeQuest · Review" };

export default function ReviewPage() {
  // Reads the local dataset through the dev API; nothing to show in production.
  if (process.env.NODE_ENV === "production") notFound();
  return <ReviewTool />;
}
