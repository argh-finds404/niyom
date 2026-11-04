import { Suspense } from "react";

export function generateStaticParams() {
  return [
    { id: "notice-merit-2026" },
    { id: "service-railway-refund" },
    { id: "notice-ict-internship" },
    { id: "procedure-epassport-rajshahi" },
  ];
}

async function NoticeContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">Dossier Details: {id}</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Requirement ledger and evidence verification view.
      </p>
    </main>
  );
}

export default function NoticePage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<main className="min-h-screen p-8">Loading dossier...</main>}>
      <NoticeContent {...props} />
    </Suspense>
  );
}
