import type { Metadata } from "next";
import { MyPlanScreen } from "@/components/screens/MyPlanScreen";

export const metadata: Metadata = { title: "My preparation plan" };

export default function MyPlanPage() {
  return <MyPlanScreen />;
}
