import Link from "next/link";
import { formatPhone } from "../_lib/format";

type StoreFooterConfig = {
  sellerName: string;
  sellerPhone: string;
  origin: string;
  termsUrl: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:9000";

async function loadStoreFooterConfig(): Promise<StoreFooterConfig> {
  try {
    const response = await fetch(`${API_BASE}/api/config`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        sellerName: "-",
        sellerPhone: "",
        origin: "-",
        termsUrl: "",
      };
    }

    const data = (await response.json()) as Partial<StoreFooterConfig>;
    return {
      sellerName: data.sellerName?.trim() || "-",
      sellerPhone: data.sellerPhone?.trim() || "",
      origin: data.origin?.trim() || "-",
      termsUrl: data.termsUrl?.trim() || "",
    };
  } catch {
    return {
      sellerName: "-",
      sellerPhone: "",
      origin: "-",
      termsUrl: "",
    };
  }
}

export default async function StoreInfoFooter() {
  const config = await loadStoreFooterConfig();
  const formattedPhone = config.sellerPhone ? formatPhone(config.sellerPhone) : "-";

  return (
    <footer className="border-t border-amber-200/80 bg-gradient-to-b from-amber-50/80 to-white px-3 py-5 text-stone-700 sm:px-4 sm:py-6">
      <div className="mx-auto w-full max-w-3xl space-y-3">
        <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm shadow-amber-900/5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-700">사업자 정보</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-amber-50 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">판매자</p>
              <p className="mt-1 text-sm font-semibold text-stone-900">{config.sellerName}</p>
            </div>
            <div className="rounded-xl bg-lime-50 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-lime-800">연락처</p>
              <p className="mt-1 text-sm font-semibold text-stone-900">{formattedPhone}</p>
            </div>
            <div className="rounded-xl bg-stone-100 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-stone-700">원산지</p>
              <p className="mt-1 text-sm font-semibold text-stone-900">{config.origin}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {config.termsUrl && (
            <Link href="/terms" className="rounded-full border border-stone-300 bg-white px-3 py-1.5 font-semibold hover:bg-stone-100">
              이용약관
            </Link>
          )}
          <Link href="/policy" className="rounded-full border border-stone-300 bg-white px-3 py-1.5 font-semibold hover:bg-stone-100">
            배송/환불 정책
          </Link>
          <Link href="/privacy" className="rounded-full border border-stone-300 bg-white px-3 py-1.5 font-semibold hover:bg-stone-100">
            개인정보처리방침
          </Link>
          <Link href="/contact" className="rounded-full border border-stone-300 bg-white px-3 py-1.5 font-semibold hover:bg-stone-100">
            문의하기
          </Link>
        </div>
      </div>
    </footer>
  );
}
