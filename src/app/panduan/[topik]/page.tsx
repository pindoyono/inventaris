import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TOPICS, topicBySlug } from "../topics";

export function generateStaticParams() {
  return TOPICS.map((t) => ({ topik: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/panduan/[topik]">): Promise<Metadata> {
  const t = topicBySlug((await params).topik);
  return { title: t?.title ?? "Panduan" };
}

export default async function TopikPage({ params }: PageProps<"/panduan/[topik]">) {
  const { topik } = await params;
  const t = topicBySlug(topik);
  if (!t) notFound();
  const i = TOPICS.indexOf(t);
  const prev = TOPICS[i - 1];
  const next = TOPICS[i + 1];
  return (
    <article className="max-w-4xl">
      <p className="text-sm text-slate-500"><Link href="/panduan" className="hover:underline">Panduan</Link> › {t.title}</p>
      <h1 className="mt-1 text-2xl font-semibold">{t.title}</h1>
      <p className="mt-1 text-slate-600">{t.summary}</p>
      <p className="mt-2 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">Untuk: {t.who}</p>
      {t.flow && <p className="mt-2 text-sm"><Link href={`/panduan/alur#alur-${t.flow}`} className="text-teal-700 underline">Lihat flowchart di halaman alur →</Link></p>}
      <div className="mt-2">{t.body()}</div>
      <nav className="mt-10 flex justify-between gap-4 border-t border-slate-200 pt-4 text-sm">
        {prev ? <Link href={`/panduan/${prev.slug}`} className="text-teal-700 hover:underline">← {prev.title}</Link> : <span />}
        {next ? <Link href={`/panduan/${next.slug}`} className="text-teal-700 hover:underline">{next.title} →</Link> : <span />}
      </nav>
    </article>
  );
}
