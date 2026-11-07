import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SEED_NOTICES } from "@/data/seed/notices.seed";
import { NoticeScreen } from "@/components/screens/NoticeScreen";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";

export function generateStaticParams() {
  return SEED_NOTICES.map((n) => ({ id: n.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notice = SEED_NOTICES.find((n) => n.id === id);
  return { title: notice ? `${notice.title} — specification` : "Dossier not found" };
}

async function NoticeContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!SEED_NOTICES.some((n) => n.id === id)) notFound();
  return <NoticeScreen id={id} />;
}

export default function NoticePage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <NoticeContent {...props} />
    </Suspense>
  );
}
