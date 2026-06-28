"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Notice } from "@repo/shared-types/notice";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || (process.env.NODE_ENV === "development" ? "http://localhost:9000" : "");

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadNotices() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/notices`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("공지사항을 불러오지 못했습니다.");
        }

        const data = (await response.json()) as Notice[];
        setNotices(data);
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "공지사항을 불러오지 못했습니다.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void loadNotices();
  }, []);

  const sortedNotices = useMemo(
    () => [...notices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notices],
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-4 px-4 py-6 text-stone-800">
      <Link href="/" className="text-sm font-semibold text-amber-700">
        ← 홈으로
      </Link>

      <section className="rounded-3xl border border-amber-200 bg-white p-5 shadow">
        <h1 className="font-display text-3xl text-amber-800">공지사항</h1>

        {loading && <p className="mt-4 text-sm text-stone-600">공지사항 불러오는 중...</p>}
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {!loading && !error && sortedNotices.length === 0 && (
          <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center text-sm text-stone-500">
            등록된 공지사항이 없습니다.
          </div>
        )}

        <div className="mt-4 space-y-3">
          {sortedNotices.map((item) => (
            <article key={item.id} className="rounded-2xl border border-stone-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-stone-900">{item.title}</h2>
                {item.isImportant && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">중요</span>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{item.content}</p>
              <p className="mt-2 text-xs text-stone-400">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
