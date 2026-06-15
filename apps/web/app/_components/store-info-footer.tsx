import Link from "next/link";
import { formatPhone } from "../_lib/format";

type StoreFooterConfig = {
  sellerName: string;
  sellerPhone: string;
  origin: string;
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
      };
    }

    const data = (await response.json()) as Partial<StoreFooterConfig>;
    return {
      sellerName: data.sellerName?.trim() || "-",
      sellerPhone: data.sellerPhone?.trim() || "",
      origin: data.origin?.trim() || "-",
    };
  } catch {
    return {
      sellerName: "-",
      sellerPhone: "",
      origin: "-",
    };
  }
}

export default async function StoreInfoFooter() {
  const config = await loadStoreFooterConfig();
  const formattedPhone = config.sellerPhone ? formatPhone(config.sellerPhone) : "-";

  return (
    <footer className="border-t border-stone-200 bg-stone-50/95 px-3 py-4 text-stone-700 sm:px-4">
      <div className="mx-auto w-full max-w-3xl space-y-3">
        <div className="grid grid-cols-1 gap-1 text-[11px] leading-5 sm:grid-cols-3 sm:gap-2 sm:text-xs">
          <p>
            <span className="font-semibold text-stone-900">판매자</span> {config.sellerName}
          </p>
          <p>
            <span className="font-semibold text-stone-900">연락처</span> {formattedPhone}
          </p>
          <p>
            <span className="font-semibold text-stone-900">원산지</span> {config.origin}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link href="/policy" className="rounded-full border border-stone-300 bg-white px-3 py-1.5">
            배송/환불 정책
          </Link>
          <Link href="/privacy" className="rounded-full border border-stone-300 bg-white px-3 py-1.5">
            개인정보처리방침
          </Link>
          <Link href="/contact" className="rounded-full border border-stone-300 bg-white px-3 py-1.5">
            문의하기
          </Link>
        </div>
      </div>
    </footer>
  );
}
