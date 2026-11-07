import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SEED_NOTICES } from "@/data/seed/notices.seed";
import { ChangesScreen } from "@/components/screens/ChangesScreen";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";

export function generateStaticParams() {
  return SEED_NOTICES.map((n) => ({ id: n.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notice = SEED_NOTICES.find((n) => n.id === id);
  return { title: notice ? `${notice.title} — version diff` : "Dossier not found" };
}

async function ChangesContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!SEED_NOTICES.some((n) => n.id === id)) notFound();
  return <ChangesScreen id={id} />;
}

export default function ChangesPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <ChangesContent {...props} />
    </Suspense>
  );
}
