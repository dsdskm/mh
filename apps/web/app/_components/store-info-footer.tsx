import Link from "next/link";
import { formatPhone } from "../_lib/format";

type StoreFooterConfig = {
  sellerName: string;
  sellerPhone: string;
  trusteeBusinessName: string;
  trusteeBusinessNumber: string;
  trusteeRepresentative: string;
  trusteePhone: string;
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
        trusteeBusinessName: "",
        trusteeBusinessNumber: "",
        trusteeRepresentative: "",
        trusteePhone: "",
        origin: "-",
        termsUrl: "",
      };
    }

    const data = (await response.json()) as Partial<StoreFooterConfig>;
    return {
      sellerName: data.sellerName?.trim() || "-",
      sellerPhone: data.sellerPhone?.trim() || "",
      trusteeBusinessName: data.trusteeBusinessName?.trim() || "",
      trusteeBusinessNumber: data.trusteeBusinessNumber?.trim() || "",
      trusteeRepresentative: data.trusteeRepresentative?.trim() || "",
      trusteePhone: data.trusteePhone?.trim() || "",
      origin: data.origin?.trim() || "-",
      termsUrl: data.termsUrl?.trim() || "",
    };
  } catch {
    return {
      sellerName: "-",
      sellerPhone: "",
      trusteeBusinessName: "",
      trusteeBusinessNumber: "",
      trusteeRepresentative: "",
      trusteePhone: "",
      origin: "-",
      termsUrl: "",
    };
  }
}

export default async function StoreInfoFooter() {
  const config = await loadStoreFooterConfig();
  const formattedPhone = config.sellerPhone ? formatPhone(config.sellerPhone) : "-";
  const formattedTrusteePhone = config.trusteePhone ? formatPhone(config.trusteePhone) : "-";

  return (
    <footer className="border-t border-stone-200 bg-white px-3 py-5 text-stone-900 sm:px-4 sm:py-6">
      <div className="mx-auto w-full max-w-3xl space-y-3">
        <div className="space-y-1 text-sm text-stone-900">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em]">사업자 정보</p>
          <p>판매자: {config.sellerName}</p>
          <p>연락처: {formattedPhone}</p>
          <p>원산지: {config.origin}</p>
          <p className="pt-2 text-[11px] font-bold uppercase tracking-[0.12em]">위탁 사업자 정보</p>
          <p>사업자명: {config.trusteeBusinessName || "-"}</p>
          <p>사업자등록번호: {config.trusteeBusinessNumber || "-"}</p>
          <p>대표: {config.trusteeRepresentative || "-"}</p>
          <p>연락처: {formattedTrusteePhone}</p>
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
