import Link from "next/link";
import { OperatorProductInfo } from "./operator-product-info";

type StoreFooterConfig = {
  sellerName: string;
  sellerPhone: string;
  trusteeBusinessName: string;
  trusteeBusinessNumber: string;
  trusteeRepresentative: string;
  trusteePhone: string;
  origin: string;
  kakaoChannelUrl: string;
  termsUrl: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  (process.env.NODE_ENV === "development" ? "http://localhost:9000" : "");

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
        kakaoChannelUrl: "",
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
      kakaoChannelUrl: data.kakaoChannelUrl?.trim() || "",
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
      kakaoChannelUrl: "",
      termsUrl: "",
    };
  }
}

export default async function StoreInfoFooter() {
  const config = await loadStoreFooterConfig();

  return (
    <footer className="border-t border-stone-200 bg-white px-3 py-5 text-stone-900 sm:px-4 sm:py-6">
      <div className="mx-auto w-full max-w-3xl space-y-3">
        <OperatorProductInfo
          producerName={config.sellerName}
          producerPhone={config.sellerPhone}
          origin={config.origin}
        />
        <div className="flex flex-wrap gap-2 text-xs">
          {config.termsUrl && (
            <Link
              href="/terms"
              className="rounded-full border border-stone-300 bg-white px-3 py-1.5 font-semibold hover:bg-stone-100"
            >
              이용약관
            </Link>
          )}
          <Link
            href="/policy"
            className="rounded-full border border-stone-300 bg-white px-3 py-1.5 font-semibold hover:bg-stone-100"
          >
            배송/환불 정책
          </Link>
          <Link
            href="/privacy"
            className="rounded-full border border-stone-300 bg-white px-3 py-1.5 font-semibold hover:bg-stone-100"
          >
            개인정보처리방침
          </Link>
          {config.kakaoChannelUrl ? (
            <a
              href={config.kakaoChannelUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-stone-300 bg-white px-3 py-1.5 font-semibold hover:bg-stone-100"
            >
              문의하기
            </a>
          ) : (
            <Link
              href="/contact"
              className="rounded-full border border-stone-300 bg-white px-3 py-1.5 font-semibold hover:bg-stone-100"
            >
              문의하기
            </Link>
          )}
        </div>
      </div>
    </footer>
  );
}
