import type { Metadata } from "next";
import { ExploreScreen } from "@/components/screens/ExploreScreen";

export const metadata: Metadata = { title: "Directory" };

export default function ExplorePage() {
  return <ExploreScreen />;
}
