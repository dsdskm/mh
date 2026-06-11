"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ShippingAddress } from "../../../types/auth";
import { getShippingAddressesApi, saveShippingAddressApi } from "../api/account.api";

const DAUM_POSTCODE_SCRIPT_URL =
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

type DaumPostcodeData = {
  roadAddress: string;
  jibunAddress: string;
  buildingName: string;
  apartment: "Y" | "N";
};

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: DaumPostcodeData) => void;
      }) => {
        open: () => void;
      };
    };
  }
}

export default function ShippingAddressPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const userId = useMemo(() => session?.user?.email ?? "", [session?.user?.email]);

  const [shippingAddresses, setShippingAddresses] = useState<ShippingAddress[]>([]);
  const [shippingName, setShippingName] = useState("");
  const [shippingAddress1, setShippingAddress1] = useState("");
  const [shippingAddress2, setShippingAddress2] = useState("");
  const [editingShippingId, setEditingShippingId] = useState<number | null>(null);
  const [savingShipping, setSavingShipping] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<number | null>(null);
  const [postcodeReady, setPostcodeReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signup?callback=/account/shipping");
      return;
    }

    if (status !== "authenticated" || !userId) {
      return;
    }

    async function loadShippingAddresses() {
      setLoading(true);
      setError(null);

      try {
        const data = await getShippingAddressesApi(userId);
        setShippingAddresses(data.shippingAddresses);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "배송지 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void loadShippingAddresses();
  }, [router, status, userId]);

  useEffect(() => {
    if (window.daum?.Postcode) {
      setPostcodeReady(true);
      return;
    }

    const script = document.createElement("script");
    script.src = DAUM_POSTCODE_SCRIPT_URL;
    script.async = true;
    script.onload = () => setPostcodeReady(true);
    script.onerror = () => {
      setError("주소 검색 스크립트를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    };

    document.head.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, []);

  function searchShippingAddress() {
    if (!window.daum?.Postcode) {
      setError("주소 검색 준비 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    new window.daum.Postcode({
      oncomplete: (data) => {
        const baseAddress = data.roadAddress || data.jibunAddress;
        const buildingSuffix =
          data.apartment === "Y" && data.buildingName
            ? ` (${data.buildingName})`
            : "";

        setShippingAddress1(`${baseAddress}${buildingSuffix}`.trim());
        setError(null);
      },
    }).open();
  }

  async function submitShippingAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setError("로그인 정보가 없습니다.");
      return;
    }

    setSavingShipping(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await saveShippingAddressApi({
        userId,
        id: editingShippingId ?? undefined,
        name: shippingName.trim(),
        address1: shippingAddress1.trim(),
        address2: shippingAddress2.trim(),
      });

      setShippingAddresses(result.shippingAddresses);
      setShippingName("");
      setShippingAddress1("");
      setShippingAddress2("");
      setEditingShippingId(null);
      setSuccess("배송지가 저장되었습니다.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "배송지 저장 실패");
    } finally {
      setSavingShipping(false);
    }
  }

  async function setDefaultShipping(item: ShippingAddress) {
    if (!userId || item.isDefault) {
      return;
    }

    setSettingDefaultId(item.id);
    setError(null);
    setSuccess(null);

    try {
      const result = await saveShippingAddressApi({
        userId,
        id: item.id,
        name: item.name,
        address1: item.address1,
        address2: item.address2,
        isDefault: true,
      });

      setShippingAddresses(result.shippingAddresses);
      setSuccess("기본 배송지가 변경되었습니다.");
    } catch (setDefaultError) {
      setError(setDefaultError instanceof Error ? setDefaultError.message : "기본 배송지 변경 실패");
    } finally {
      setSettingDefaultId(null);
    }
  }

  if (status === "loading" || loading) {
    return <main className="mx-auto max-w-3xl px-4 py-8 text-sm text-stone-600">불러오는 중...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="text-sm font-semibold text-amber-700">
          ← 뒤로가기
        </Link>
      </div>

      <section className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-5">
        <h1 className="text-2xl font-bold text-amber-800">배송지 관리</h1>
        <p className="mt-1 text-sm text-stone-600">배송지 이름과 주소를 추가/수정할 수 있습니다.</p>

        <div className="mt-4 space-y-2">
          {shippingAddresses.length === 0 && (
            <p className="rounded-lg bg-stone-50 p-3 text-xs text-stone-600">등록된 배송지가 없습니다.</p>
          )}

          {shippingAddresses.map((item) => (
            <div key={item.id} className="rounded-lg border border-stone-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-stone-800">{item.name}</p>
                <label className="flex items-center gap-1 text-xs font-semibold text-stone-700">
                  <input
                    type="radio"
                    name="default-shipping"
                    checked={item.isDefault}
                    disabled={settingDefaultId !== null}
                    onChange={() => void setDefaultShipping(item)}
                    className="h-4 w-4"
                  />
                  기본 배송지
                </label>
              </div>
              <p className="mt-1 text-sm text-stone-700">{[item.address1, item.address2].filter(Boolean).join(" ")}</p>
              <button
                type="button"
                onClick={() => {
                  setEditingShippingId(item.id);
                  setShippingName(item.name);
                  setShippingAddress1(item.address1);
                  setShippingAddress2(item.address2 ?? "");
                }}
                className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800"
              >
                수정
              </button>
            </div>
          ))}
        </div>

        <form className="mt-3 space-y-2" onSubmit={submitShippingAddress}>
          <input
            value={shippingName}
            onChange={(event) => setShippingName(event.target.value)}
            placeholder="배송지 이름 (예: 집, 회사)"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            required
          />
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={shippingAddress1}
              placeholder="주소검색 클릭"
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-500"
              readOnly
              required
            />
            <button
              type="button"
              onClick={searchShippingAddress}
              disabled={!postcodeReady}
              className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-800 disabled:opacity-60"
            >
              {postcodeReady ? "주소 검색" : "로딩 중..."}
            </button>
          </div>
          <input
            value={shippingAddress2}
            onChange={(event) => setShippingAddress2(event.target.value)}
            placeholder="상세 주소 (동/호수 등)"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <p className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
            기본 배송지는 위 목록의 라디오 버튼에서 선택할 수 있습니다.
          </p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={savingShipping}
              className="flex-1 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {savingShipping ? "저장 중..." : editingShippingId ? "배송지 수정" : "배송지 추가"}
            </button>
            {editingShippingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingShippingId(null);
                  setShippingName("");
                  setShippingAddress1("");
                  setShippingAddress2("");
                }}
                className="rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold text-stone-700"
              >
                취소
              </button>
            )}
          </div>
        </form>

        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {success && <p className="mt-3 rounded-xl bg-lime-50 p-3 text-sm text-lime-800">{success}</p>}
      </section>
    </main>
  );
}
