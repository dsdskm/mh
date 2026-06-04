"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatCurrency, formatPhone, toEmbedVideoUrl } from "./_lib/format";

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl: string;
  badge: string;
};

type StoreConfig = {
  shopName: string;
  sellerName: string;
  sellerPhone: string;
  origin: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  transferNote: string;
  detailDescription: string;
  storyImages: Array<{
    title: string;
    imageUrl: string;
  }>;
  videoUrl: string;
  recipes: Array<{
    title: string;
    ingredients: string[];
    steps: string[];
  }>;
};

type OrderResponse = {
  order: {
    id: string;
    totalAmount: number;
    status: "접수" | "준비중" | "배송중" | "배송완료" | "취소";
  };
  transfer: StoreConfig;
};

type ReviewComment = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
};

type Review = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  comments: ReviewComment[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002";
const MEMBER_PHONE_KEY = "cornmarket:member-phone";

export default function Home() {
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated";
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [storeConfig, setStoreConfig] = useState<StoreConfig>({
    shopName: "",
    sellerName: "",
    sellerPhone: "",
    origin: "",
    bankName: "",
    accountNumber: "",
    accountHolder: "",
    transferNote: "",
    detailDescription: "",
    storyImages: [],
    videoUrl: "",
    recipes: [],
  });
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderDone, setOrderDone] = useState<OrderResponse | null>(null);
  const [phone, setPhone] = useState("");
  const [depositorName, setDepositorName] = useState("");
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [visibleReviewCount, setVisibleReviewCount] = useState(5);
  const [reviewSort, setReviewSort] = useState<"latest" | "recommended">("latest");
  const [reviewContent, setReviewContent] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [purchaseType, setPurchaseType] = useState<"member" | "guest" | null>(null);
  const [savedMemberPhone, setSavedMemberPhone] = useState("");
  const [copyDone, setCopyDone] = useState(false);

  useEffect(() => {
    const savedPhone = localStorage.getItem(MEMBER_PHONE_KEY);
    if (savedPhone) {
      setSavedMemberPhone(savedPhone);
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [productsRes, reviewsRes, configRes] = await Promise.all([
          fetch(`${API_BASE}/api/products`, {
            cache: "no-store",
          }),
          fetch(`${API_BASE}/api/reviews`, {
            cache: "no-store",
          }),
          fetch(`${API_BASE}/api/config`, {
            cache: "no-store",
          }),
        ]);

        if (!productsRes.ok || !reviewsRes.ok || !configRes.ok) {
          throw new Error("스토어 정보를 불러오지 못했습니다.");
        }

        const productsData = (await productsRes.json()) as Product[];
        const reviewsData = (await reviewsRes.json()) as Review[];
        const configData = (await configRes.json()) as StoreConfig;
        setProducts(productsData);
        setReviews(reviewsData);
        setStoreConfig(configData);
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "알 수 없는 오류가 발생했습니다.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const cartItems = useMemo(() => {
    return products.reduce<Array<Product & { quantity: number; subtotal: number }>>(
      (acc, product) => {
        const quantity = cart[product.id] ?? 0;
        if (quantity < 1) {
          return acc;
        }

        acc.push({
          ...product,
          quantity,
          subtotal: product.price * quantity,
        });
        return acc;
      },
      [],
    );
  }, [products, cart]);

  const totalPrice = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.subtotal, 0),
    [cartItems],
  );

  const totalQuantity = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  );

  const sortedReviews = useMemo(() => {
    const copied = [...reviews];

    if (reviewSort === "recommended") {
      return copied.sort((a, b) => {
        const score = b.comments.length - a.comments.length;
        if (score !== 0) {
          return score;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }

    return copied.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [reviews, reviewSort]);

  const embeddedVideoUrl = useMemo(() => {
    if (!storeConfig.videoUrl) {
      return "";
    }

    return toEmbedVideoUrl(storeConfig.videoUrl);
  }, [storeConfig.videoUrl]);

  function changeQuantity(productId: string, delta: number): void {
    const product = products.find((item) => item.id === productId);
    if (!product) {
      return;
    }

    setCart((prev) => {
      const current = prev[productId] ?? 0;
      const next = Math.min(Math.max(current + delta, 0), Math.max(product.stock, 0));
      return {
        ...prev,
        [productId]: next,
      };
    });
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!cartItems.length) {
      setError("장바구니에 상품을 추가해주세요.");
      return;
    }

    const firstOverLimitItem = cartItems.find((item) => item.quantity > item.stock);
    if (firstOverLimitItem) {
      setError(`${firstOverLimitItem.name}의 재고를 초과했습니다. 수량을 조정해주세요.`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          depositorName,
          items: cartItems.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
        }),
      });

      if (!response.ok) {
        const failure = (await response.json()) as { message?: string };
        throw new Error(failure.message ?? "주문 처리 중 오류가 발생했습니다.");
      }

      const result = (await response.json()) as OrderResponse;
      setOrderDone(result);

      if (isLoggedIn && purchaseType === "member" && phone.trim()) {
        localStorage.setItem(MEMBER_PHONE_KEY, phone.trim());
        setSavedMemberPhone(phone.trim());
      }

      setCart({});
      setPhone("");
      setDepositorName("");
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "결제 요청에 실패했습니다.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshReviews() {
    const response = await fetch(`${API_BASE}/api/reviews`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("후기 목록을 불러오지 못했습니다.");
    }
    setReviews((await response.json()) as Review[]);
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLoggedIn) {
      setError("후기 작성은 로그인 후 이용할 수 있어요.");
      router.push("/signup?callback=/");
      return;
    }

    setReviewSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: session?.user?.name ?? "회원",
          content: reviewContent,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "후기 등록에 실패했습니다.");
      }

      setReviewContent("");
      await refreshReviews();
      setVisibleReviewCount(5);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "후기 등록 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setReviewSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-corn-pattern pb-32 text-stone-900">
      <header className="border-b border-amber-200/80 bg-amber-100/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <p className="font-display text-2xl text-amber-700">{storeConfig.shopName || "옥수수 가게"}</p>
            <p className="mt-1 text-xs text-amber-900/90">판매자 {storeConfig.sellerName || "-"}</p>
            <p className="text-xs text-amber-900/90">연락처 {storeConfig.sellerPhone ? formatPhone(storeConfig.sellerPhone) : "-"}</p>
            <p className="text-xs text-amber-900/90">원산지 {storeConfig.origin || "-"}</p>
          </div>
          {isLoggedIn ? (
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/" })}
              className="rounded-full border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800"
            >
              로그아웃
            </button>
          ) : (
            <Link
              href="/signup?callback=/"
              className="rounded-full border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800"
            >
              로그인/회원가입
            </Link>
          )}
        </div>
        <div className="mx-auto flex w-full max-w-3xl gap-2 px-4 pb-4">
          <Link
            href="/orders"
            className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800"
          >
            주문내역
          </Link>
          <button
            type="button"
            onClick={() => {
              if (isLoggedIn) {
                router.push("/contact");
                return;
              }
              router.push("/signup?callback=/contact");
            }}
            className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800"
          >
            문의하기
          </button>
          <Link
            href="/policy"
            className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800"
          >
            배송/환불
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pt-6">
        <section id="products" className="space-y-3">
          <div>
            <h2 className="font-display text-2xl text-amber-800">옥수수 상품</h2>
            <p className="text-sm text-stone-600">상품별 수량을 선택해 주세요.</p>
          </div>

          {loading && <p className="text-sm text-stone-600">상품을 불러오는 중입니다...</p>}

          {!loading && !error && (
            <div className="grid gap-3">
              {products.map((product) => (
                <article
                  key={product.id}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-lg shadow-amber-900/10"
                >
                  <div className="relative">
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      width={1200}
                      height={800}
                      className="h-36 w-full object-cover"
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-lime-600 px-2 py-1 text-xs font-bold tracking-wide text-white">
                      {product.badge}
                    </span>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="font-display text-2xl text-amber-700">{product.name}</h3>
                      <p className="mt-1 text-sm text-stone-600">{product.description}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <div>
                          <p className="text-lg font-extrabold text-stone-900">{formatCurrency(product.price)}</p>
                          <p className="text-xs text-stone-500">재고 {product.stock}개</p>
                        </div>
                        <div className="flex items-center gap-2 rounded-full border border-stone-300 px-2 py-1">
                          {(() => {
                            const quantity = cart[product.id] ?? 0;
                            const canDecrease = quantity > 0;
                            const canIncrease = quantity < product.stock;

                            return (
                              <>
                          <button
                            type="button"
                            onClick={() => changeQuantity(product.id, -1)}
                            disabled={!canDecrease}
                            className="h-8 w-8 rounded-full bg-stone-100 text-base font-bold disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            -
                          </button>
                          <span className="min-w-6 text-center text-sm font-bold">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => changeQuantity(product.id, 1)}
                            disabled={!canIncrease}
                            className="h-8 w-8 rounded-full bg-amber-100 text-base font-bold text-amber-800 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            +
                          </button>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-3xl border border-lime-200 bg-white p-5 shadow-lg">
          <div>
            <h2 className="font-display text-2xl text-lime-800">상품 상세 설명</h2>
            <p className="text-sm text-stone-600">{storeConfig.detailDescription || "등록된 상품 상세 설명이 없습니다."}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {storeConfig.storyImages.map((item) => (
              <article key={item.title} className="overflow-hidden rounded-2xl border border-stone-200">
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  width={1200}
                  height={800}
                  className="h-36 w-full object-cover sm:h-44"
                />
              </article>
            ))}
            {storeConfig.storyImages.length === 0 && (
              <p className="col-span-2 text-sm text-stone-500">등록된 상세 이미지가 없습니다.</p>
            )}
          </div>

          {embeddedVideoUrl ? (
            <div className="overflow-hidden rounded-2xl border border-stone-200">
              <div className="aspect-video w-full">
                <iframe
                  src={embeddedVideoUrl}
                  title="상품 소개 영상"
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-500">등록된 영상이 없습니다.</p>
          )}

          <div className="space-y-4 rounded-3xl border border-lime-300 bg-gradient-to-b from-lime-100 to-lime-50 p-5 shadow-lg shadow-lime-900/10">
            <div>
              <h3 className="mt-1 font-display text-2xl text-lime-900">추천 조리법</h3>
              <p className="mt-1 text-sm text-stone-700">
                가장 많이 찾는 찜 레시피를 한 번에 확인하세요. 카드 클릭 시 재료와 순서가 펼쳐집니다.
              </p>
            </div>

            {storeConfig.recipes.map((recipe) => (
              <details
                key={recipe.title}
                className="overflow-hidden rounded-2xl border border-lime-200 bg-white shadow-sm open:shadow-md"
              >
                <summary className="cursor-pointer px-4 py-4 text-base font-extrabold text-lime-900">
                  {recipe.title}
                </summary>
                <div className="grid gap-4 border-t border-lime-100 px-4 py-4 text-sm text-stone-700 md:grid-cols-2">
                  <div>
                    <p className="font-semibold text-stone-900">재료</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {recipe.ingredients.map((ingredient) => (
                        <li key={ingredient}>{ingredient}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-stone-900">조리순서</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5">
                      {recipe.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              </details>
            ))}
            {storeConfig.recipes.length === 0 && (
              <p className="text-sm text-stone-600">등록된 레시피가 없습니다.</p>
            )}
          </div>
        </section>

        <section id="reviews" className="space-y-4 rounded-3xl border border-amber-200 bg-white p-5 shadow-lg">
          <div>
            <h2 className="font-display text-2xl text-amber-800">후기</h2>
            <p className="text-sm text-stone-600">후기 작성은 로그인 후 가능하며, 목록 조회는 누구나 가능합니다.</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setReviewSort("latest")}
                className={`rounded-full border px-3 py-1 text-xs font-bold ${
                  reviewSort === "latest"
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-amber-300 bg-white text-amber-800"
                }`}
              >
                최신순
              </button>
              <button
                type="button"
                onClick={() => setReviewSort("recommended")}
                className={`rounded-full border px-3 py-1 text-xs font-bold ${
                  reviewSort === "recommended"
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-amber-300 bg-white text-amber-800"
                }`}
              >
                추천순
              </button>
            </div>
          </div>

          <form className="space-y-3 rounded-2xl bg-amber-50 p-4" onSubmit={submitReview}>
            <textarea
              value={reviewContent}
              onChange={(event) => setReviewContent(event.target.value)}
              placeholder={
                isLoggedIn
                  ? "후기 내용을 입력하세요 (예: 달고 신선해요)"
                  : "로그인 후 후기 작성이 가능합니다"
              }
              className="h-24 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              disabled={!isLoggedIn}
              required
            />
            <button
              type="submit"
              disabled={reviewSubmitting || !isLoggedIn}
              className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {reviewSubmitting ? "등록 중..." : "후기 등록"}
            </button>
            {!isLoggedIn && (
              <button
                type="button"
                onClick={() => router.push("/signup?callback=/")}
                className="w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-bold text-amber-800"
              >
                로그인하고 후기 쓰기
              </button>
            )}
          </form>

          <div className="space-y-4">
            {sortedReviews.slice(0, visibleReviewCount).map((review) => (
              <article key={review.id} className="rounded-2xl border border-stone-200 p-4">
                <p className="text-sm font-bold text-stone-900">{review.name}</p>
                <p className="mt-1 text-sm text-stone-700">{review.content}</p>
                {review.comments.length > 0 && (
                  <div className="mt-3 rounded-xl bg-stone-50 p-3 text-sm text-stone-700">
                    <p className="text-xs font-bold uppercase tracking-wide text-stone-600">운영자 답글</p>
                    <p className="mt-1">{review.comments[review.comments.length - 1]?.content}</p>
                  </div>
                )}
              </article>
            ))}

            {sortedReviews.length > visibleReviewCount && (
              <button
                type="button"
                onClick={() => setVisibleReviewCount((prev) => prev + 5)}
                className="w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-bold text-amber-800"
              >
                후기 더보기
              </button>
            )}

            {sortedReviews.length > 5 && visibleReviewCount >= sortedReviews.length && (
              <button
                type="button"
                onClick={() => setVisibleReviewCount(5)}
                className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold text-stone-700"
              >
                후기 접기
              </button>
            )}
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-amber-200 bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
          <div className="flex-1 rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-xs text-stone-600">선택 수량 {totalQuantity}개</p>
            <p className="text-sm font-extrabold text-amber-700">{formatCurrency(totalPrice)}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowPurchaseModal(true);
              setPurchaseType(null);
              setOrderDone(null);
              setError(null);
            }}
            disabled={submitting || totalQuantity === 0}
            className="min-w-36 rounded-xl bg-lime-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-lime-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            구매 신청
          </button>
        </div>
      </div>

      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-5 shadow-2xl">
            {!orderDone ? (
              <>
                <h2 className="font-display text-3xl text-amber-800">구매 신청</h2>
                {purchaseType === null ? (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm text-stone-600">구매 방식을 선택해주세요.</p>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!isLoggedIn) {
                          router.push("/signup?callback=/");
                          return;
                        }
                        setPurchaseType("member");
                        setDepositorName(session?.user?.name ?? "");
                        setPhone(savedMemberPhone);
                      }}
                      className="w-full rounded-xl bg-lime-600 px-4 py-3 text-sm font-bold text-white"
                    >
                      회원 구매
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPurchaseType("guest");
                        setDepositorName("");
                        setPhone("");
                      }}
                      className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold text-stone-800"
                    >
                      비회원 구매
                    </button>
                    {!isLoggedIn && (
                      <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                        회원 구매는 로그인/회원가입 후 이용할 수 있습니다.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPurchaseModal(false)}
                      className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold"
                    >
                      닫기
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-stone-600">
                      {purchaseType === "member"
                        ? "회원 정보가 자동 입력되었습니다. 필요하면 수정해주세요."
                        : "입금자명과 연락처를 입력해주세요."}
                    </p>

                    <form className="mt-4 space-y-3" onSubmit={submitOrder}>
                      <input
                        value={depositorName}
                        onChange={(event) => setDepositorName(event.target.value)}
                        placeholder="입금자명"
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                        required
                      />
                      <input
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="연락처"
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                        required
                      />

                      <div className="rounded-2xl bg-amber-50 p-3">
                        <p className="text-xs text-stone-600">최종 결제 예정 금액</p>
                        <p className="text-2xl font-extrabold text-amber-700">{formatCurrency(totalPrice)}</p>
                      </div>

                      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPurchaseType(null)}
                          className="flex-1 rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold"
                        >
                          이전
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="flex-1 rounded-xl bg-lime-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                        >
                          {submitting ? "확인 중..." : "최종 확인"}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </>
            ) : (
              <>
                <h2 className="font-display text-3xl text-lime-700">주문 접수 완료</h2>
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-sm text-stone-700">주문번호: {orderDone.order.id}</p>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(orderDone.order.id);
                      setCopyDone(true);
                      setTimeout(() => setCopyDone(false), 1500);
                    }}
                    className="rounded-lg border border-lime-300 bg-white px-2 py-1 text-xs font-semibold text-lime-800"
                  >
                    {copyDone ? "복사됨" : "주문번호 복사"}
                  </button>
                </div>
                <p className="text-sm text-stone-700">현재상태: {orderDone.order.status}</p>
                <p className="text-sm text-stone-700">주문금액: {formatCurrency(orderDone.order.totalAmount)}</p>

                <div className="mt-3 rounded-2xl border border-dashed border-lime-300 bg-lime-50 p-3 text-sm text-lime-900">
                  <p className="font-bold">계좌이체 안내</p>
                  <p>{orderDone.transfer.bankName}</p>
                  <p>{orderDone.transfer.accountNumber}</p>
                  <p>{orderDone.transfer.accountHolder}</p>
                  <p className="mt-2 text-xs">입금 확인 후 판매자가 주문 상태를 변경합니다.</p>
                </div>

                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                  문자 연동 시 주문번호를 문자로도 발송할 수 있습니다. 현재는 화면의 주문번호를 저장해주세요.
                </p>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPurchaseModal(false);
                      setOrderDone(null);
                    }}
                    className="flex-1 rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold"
                  >
                    닫기
                  </button>
                  <Link
                    href="/orders"
                    className="flex-1 rounded-xl bg-amber-500 px-4 py-3 text-center text-sm font-bold text-white"
                  >
                    주문조회 가기
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
