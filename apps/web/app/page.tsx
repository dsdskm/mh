"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency, formatPhone, toEmbedVideoUrl } from "./_lib/format";
import { OperatorProductInfo } from "./_components/operator-product-info";
import { PhoneVerificationBox } from "./_components/phone-verification-box";
import { getProfileApi, getMyCouponsApi, getMyMileageApi } from "./account/api/account.api";
import type { DaumPostcodeData, DaumPostcodeWindow } from "../types/daum-postcode";
import { getOrderStatusLabelKo } from "@repo/shared-types/order";
import type { OrderStatus } from "@repo/shared-types/order";
import type { Notice } from "@repo/shared-types/notice";
import type { Coupon } from "@repo/shared-types/coupon";

const DAUM_POSTCODE_SCRIPT_URL = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

type KakaoSdk = {
  Auth: {
    authorize: (options: { redirectUri: string; state?: string }) => void;
    logout?: (callback?: () => void) => void;
    setAccessToken?: (accessToken: string | null) => void;
  };
  init: (appKey: string) => void;
  isInitialized: () => boolean;
};

declare global {
  interface Window {
    daum?: DaumPostcodeWindow;
    Kakao?: KakaoSdk;
  }
}

type Product = {
  id: number;
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
  trusteeBusinessName: string;
  trusteeBusinessNumber: string;
  trusteeRepresentative: string;
  trusteePhone: string;
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
  kakaoChannelUrl: string;
  termsUrl: string;
  termsVersion: string;
  termsUpdatedAt: string | null;
  recipes: Array<{
    title: string;
    ingredients: string[];
    steps: any[];
  }>;
  paymentDueDays: number;
  deliveryFee: number;
  chargeDeliveryFee: boolean;
  memberBonusProductId: number | null;
  memberBonusProductName: string | null;
  mileageEarnRate: number;
  businessStatus: "open" | "standby" | "closed";
  businessStatusOpenText: string;
  businessStatusStandbyText: string;
  businessStatusClosedText: string;
};

type OrderResponse = {
  order: {
    id: number;
    totalAmount: number;
    status: OrderStatus;
    paymentDueAt: string | null;
    deliveryFee: number;
    couponDiscount: number;
    mileageUsed: number;
    mileageEarned: number;
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

function isOperatorAuthor(name: string): boolean {
  return /운영자|관리자/.test(name);
}

function formatKoreanDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  (process.env.NODE_ENV === "development" ? "http://localhost:9000" : "");
const MEMBER_PHONE_KEY = "cornmarket:member-phone";
const NOTICE_DISMISS_KEY_PREFIX = "cornmarket:notice:dismissed:";
const TERMS_SEEN_VERSION_KEY = "cornmarket:terms:seen-version";
const ORDER_REQUEST_CUSTOM_VALUE = "__custom__";
const ENABLE_REWARDS = false;
type OrderRequestPresetValue =
  | ""
  | "문 앞에 놓아주세요"
  | "경비실에 맡겨 주세요"
  | "전화주세요"
  | typeof ORDER_REQUEST_CUSTOM_VALUE;

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const isLoggedIn = mounted && status === "authenticated";

  const [products, setProducts] = useState<Product[]>([]);
  const [storeConfig, setStoreConfig] = useState<StoreConfig>({
    shopName: "",
    sellerName: "",
    sellerPhone: "",
    trusteeBusinessName: "",
    trusteeBusinessNumber: "",
    trusteeRepresentative: "",
    trusteePhone: "",
    origin: "",
    bankName: "",
    accountNumber: "",
    accountHolder: "",
    transferNote: "",
    detailDescription: "",
    storyImages: [],
    videoUrl: "",
    kakaoChannelUrl: "",
    termsUrl: "",
    termsVersion: "",
    termsUpdatedAt: null,
    recipes: [],
    paymentDueDays: 0,
    deliveryFee: 0,
    chargeDeliveryFee: false,
    memberBonusProductId: null,
    memberBonusProductName: null,
    mileageEarnRate: 0,
    businessStatus: "open",
    businessStatusOpenText: "현재 정상 영업 중입니다.",
    businessStatusStandbyText: "영업 준비 중입니다. 잠시 후 다시 방문해주세요.",
    businessStatusClosedText: "영업이 종료되었습니다. 다음 영업 시간에 주문 가능합니다.",
  });
  const [cart, setCart] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderDone, setOrderDone] = useState<OrderResponse | null>(null);
  const [phone, setPhone] = useState("");
  const [depositorName, setDepositorName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [memberPostalCode, setMemberPostalCode] = useState("");
  const [guestPostalCode, setGuestPostalCode] = useState("");
  const [orderRequestPreset, setOrderRequestPreset] = useState<OrderRequestPresetValue>("");
  const [orderRequestCustomNote, setOrderRequestCustomNote] = useState("");
  const [loadingDefaultShipping, setLoadingDefaultShipping] = useState(false);
  // 회원 전용: 쿠폰/적립금
  const [memberAccountId, setMemberAccountId] = useState<number | null>(null);
  const [memberCoupons, setMemberCoupons] = useState<Coupon[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState<number | null>(null);
  const [mileageBalance, setMileageBalance] = useState(0);
  const [mileageInput, setMileageInput] = useState("");
  const [excludeMemberBonus, setExcludeMemberBonus] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [visibleReviewCount, setVisibleReviewCount] = useState(5);
  const [reviewSort, setReviewSort] = useState<"latest" | "recommended">("latest");
  const [reviewContent, setReviewContent] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [purchaseType, setPurchaseType] = useState<"member" | "guest" | null>(null);
  const [savedMemberPhone, setSavedMemberPhone] = useState("");
  const [copyDone, setCopyDone] = useState(false);
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [logoutSubmitting, setLogoutSubmitting] = useState(false);
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);
  const [showContactAuthDialog, setShowContactAuthDialog] = useState(false);
  const [activePopupNotice, setActivePopupNotice] = useState<Notice | null>(null);
  const [dismissPopupChecked, setDismissPopupChecked] = useState(false);
  const [showOrderConfirmModal, setShowOrderConfirmModal] = useState(false);
  const [showTermsUpdateModal, setShowTermsUpdateModal] = useState(false);
  const [showBusinessStatusModal, setShowBusinessStatusModal] = useState(false);
  const [postcodeReady, setPostcodeReady] = useState(false);
  const [guestAddressBase, setGuestAddressBase] = useState("");
  const [guestAddressDetail, setGuestAddressDetail] = useState("");
  const [guestOrderCode, setGuestOrderCode] = useState("");
  const [guestOrderCodeSent, setGuestOrderCodeSent] = useState(false);
  const [guestOrderLookupToken, setGuestOrderLookupToken] = useState<string | null>(null);
  const [guestOrderPhoneVerified, setGuestOrderPhoneVerified] = useState(false);
  const [guestOrderSendingCode, setGuestOrderSendingCode] = useState(false);
  const [guestOrderVerifyingCode, setGuestOrderVerifyingCode] = useState(false);
  const [guestHasRegisteredAccount, setGuestHasRegisteredAccount] = useState(false);
  const [guestOrderCodeExpiresAt, setGuestOrderCodeExpiresAt] = useState<number | null>(null);
  const [guestOrderCodeRemainingSec, setGuestOrderCodeRemainingSec] = useState(0);
  const videoIframeRef = useRef<HTMLIFrameElement | null>(null);
  const resolvedOrderRequestNote =
    orderRequestPreset === ORDER_REQUEST_CUSTOM_VALUE ? orderRequestCustomNote.trim() : orderRequestPreset.trim();
  const inquiryUrl = storeConfig.kakaoChannelUrl.trim();


  function openInquiry() {
    setShowMenuDrawer(false);

    if (inquiryUrl) {
      window.open(inquiryUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (isLoggedIn) {
      router.push("/contact");
      return;
    }

    setShowContactAuthDialog(true);
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const savedPhone = localStorage.getItem(MEMBER_PHONE_KEY);
    if (savedPhone) {
      setSavedMemberPhone(savedPhone);
    }
  }, []);

  useEffect(() => {
    if (!ENABLE_REWARDS) {
      setMemberAccountId(null);
      setMemberCoupons([]);
      return;
    }

    if (status !== "authenticated") {
      setMemberCoupons([]);
      return;
    }

    const userId = session?.user?.email?.trim() ?? "";
    if (!userId) {
      setMemberCoupons([]);
      return;
    }

    let cancelled = false;

    async function loadMemberCouponsForBadge() {
      try {
        const profileData = await getProfileApi(userId);
        const accountId = profileData.profile.id;
        const couponsData = await getMyCouponsApi(accountId);

        if (cancelled) {
          return;
        }

        setMemberAccountId(accountId);
        setMemberCoupons(couponsData);
      } catch {
        if (cancelled) {
          return;
        }
        setMemberCoupons([]);
      }
    }

    void loadMemberCouponsForBadge();

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.email]);

  useEffect(() => {
    if (!guestOrderCodeSent || guestOrderPhoneVerified || !guestOrderCodeExpiresAt) {
      setGuestOrderCodeRemainingSec(0);
      return;
    }

    const updateRemaining = () => {
      const nextRemaining = Math.max(0, Math.ceil((guestOrderCodeExpiresAt - Date.now()) / 1000));
      setGuestOrderCodeRemainingSec(nextRemaining);

      if (nextRemaining <= 0) {
        setGuestOrderCodeSent(false);
        setGuestOrderLookupToken(null);
        setGuestOrderPhoneVerified(false);
        setGuestOrderCodeExpiresAt(null);
      }
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [guestOrderCodeSent, guestOrderPhoneVerified, guestOrderCodeExpiresAt]);

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
        const message = loadError instanceof Error ? loadError.message : "알 수 없는 오류가 발생했습니다.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    async function loadPopupNotices() {
      try {
        const response = await fetch(`${API_BASE}/api/notices/popup`, {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const popupNotices = (await response.json()) as Notice[];
        const now = Date.now();
        const activeNotice = popupNotices.find((item) => {
          if (!item.isImportant || !item.popupStartAt || !item.popupEndAt) {
            return false;
          }

          const dismissed = localStorage.getItem(`${NOTICE_DISMISS_KEY_PREFIX}${item.id}`);
          if (dismissed === "1") {
            return false;
          }

          const start = new Date(item.popupStartAt).getTime();
          const end = new Date(item.popupEndAt).getTime();
          if (Number.isNaN(start) || Number.isNaN(end)) {
            return false;
          }

          return start <= now && now <= end;
        });

        setActivePopupNotice(activeNotice ?? null);
      } catch {
        setActivePopupNotice(null);
      }
    }

    void loadPopupNotices();
  }, []);

  useEffect(() => {
    if (!storeConfig.termsUrl || !storeConfig.termsVersion) {
      setShowTermsUpdateModal(false);
      return;
    }

    const seenVersion = localStorage.getItem(TERMS_SEEN_VERSION_KEY);
    if (!seenVersion) {
      localStorage.setItem(TERMS_SEEN_VERSION_KEY, storeConfig.termsVersion);
      return;
    }

    if (seenVersion !== storeConfig.termsVersion) {
      setShowTermsUpdateModal(true);
    }
  }, [storeConfig.termsUrl, storeConfig.termsVersion]);

  useEffect(() => {
    if (storeConfig.businessStatus === "open") {
      return;
    }

    setShowOrderConfirmModal(false);
  }, [storeConfig.businessStatus]);

  function dismissNoticeForThisDevice() {
    if (!activePopupNotice) {
      return;
    }

    localStorage.setItem(`${NOTICE_DISMISS_KEY_PREFIX}${activePopupNotice.id}`, "1");
    setActivePopupNotice(null);
  }

  function closePopupNotice() {
    if (dismissPopupChecked) {
      dismissNoticeForThisDevice();
      setDismissPopupChecked(false);
      return;
    }

    setActivePopupNotice(null);
    setDismissPopupChecked(false);
  }

  function closeTermsUpdateModal() {
    if (storeConfig.termsVersion) {
      localStorage.setItem(TERMS_SEEN_VERSION_KEY, storeConfig.termsVersion);
    }
    setShowTermsUpdateModal(false);
  }

  const cartItems = useMemo(() => {
    return products.reduce<Array<Product & { quantity: number; subtotal: number }>>((acc, product) => {
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
    }, []);
  }, [products, cart]);

  const confirmCartItems = useMemo(() => {
    return products.reduce<Array<Product & { quantity: number; subtotal: number }>>((acc, product) => {
      if (!(product.id in cart)) {
        return acc;
      }

      const quantity = Math.max(0, cart[product.id] ?? 0);
      acc.push({
        ...product,
        quantity,
        subtotal: product.price * quantity,
      });
      return acc;
    }, []);
  }, [products, cart]);

  const totalPrice = useMemo(() => cartItems.reduce((sum, item) => sum + item.subtotal, 0), [cartItems]);

  const totalQuantity = useMemo(() => cartItems.reduce((sum, item) => sum + item.quantity, 0), [cartItems]);

  // 배송료: 청구 설정이 켜져 있을 때만 부과 (API orders.service 로직과 동일)
  const effectiveDeliveryFee = useMemo(
    () => (storeConfig.chargeDeliveryFee ? Math.max(0, Math.floor(storeConfig.deliveryFee || 0)) : 0),
    [storeConfig.chargeDeliveryFee, storeConfig.deliveryFee],
  );

  const isMemberCheckout = purchaseType === "member";
  const isOrderAvailable = storeConfig.businessStatus === "open";
  const activeBusinessStatusText = useMemo(() => {
    if (storeConfig.businessStatus === "open") {
      return storeConfig.businessStatusOpenText || "현재 정상 영업 중입니다.";
    }
    if (storeConfig.businessStatus === "standby") {
      return storeConfig.businessStatusStandbyText || "영업 준비 중입니다. 잠시 후 다시 방문해주세요.";
    }

    return storeConfig.businessStatusClosedText || "영업이 종료되었습니다. 다음 영업 시간에 주문 가능합니다.";
  }, [
    storeConfig.businessStatus,
    storeConfig.businessStatusOpenText,
    storeConfig.businessStatusStandbyText,
    storeConfig.businessStatusClosedText,
  ]);

  const selectedCoupon = useMemo(
    () => (ENABLE_REWARDS ? (memberCoupons.find((c) => c.id === selectedCouponId) ?? null) : null),
    [memberCoupons, selectedCouponId],
  );

  const hasAvailableCouponBadge = useMemo(
    () =>
      ENABLE_REWARDS &&
      memberCoupons.some(
        (coupon) => coupon.status === "available" && coupon.expired !== true,
      ),
    [memberCoupons],
  );

  // 쿠폰 할인액 (상품 소계 기준, API computeCouponDiscount 와 동일 규칙)
  const couponDiscount = useMemo(() => {
    if (!ENABLE_REWARDS || !isMemberCheckout || !selectedCoupon) {
      return 0;
    }
    if (totalPrice < (selectedCoupon.minOrderAmount ?? 0)) {
      return 0;
    }
    let discount = 0;
    if (selectedCoupon.discountType === "percent") {
      discount = Math.floor((totalPrice * selectedCoupon.discountValue) / 100);
      if (selectedCoupon.maxDiscountAmount != null) {
        discount = Math.min(discount, selectedCoupon.maxDiscountAmount);
      }
    } else {
      discount = selectedCoupon.discountValue;
    }
    return Math.max(0, Math.min(discount, totalPrice));
  }, [isMemberCheckout, selectedCoupon, totalPrice]);

  // 적립금 사용액 (잔액·결제예정액 한도 내)
  const payableBeforeMileage = Math.max(0, totalPrice + effectiveDeliveryFee - couponDiscount);
  const mileageToUse = useMemo(() => {
    if (!ENABLE_REWARDS || !isMemberCheckout) {
      return 0;
    }
    const requested = Math.max(0, Math.floor(Number(mileageInput) || 0));
    return Math.min(requested, mileageBalance, payableBeforeMileage);
  }, [isMemberCheckout, mileageInput, mileageBalance, payableBeforeMileage]);

  const finalPayable = Math.max(0, totalPrice + effectiveDeliveryFee - couponDiscount - mileageToUse);
  const confirmShippingAddress =
    purchaseType === "guest"
      ? [guestAddressBase, guestAddressDetail].filter(Boolean).join(" ").trim()
      : shippingAddress.trim();
  const confirmPostalCode = purchaseType === "guest" ? guestPostalCode.trim() : memberPostalCode.trim();

  // 적립 예정 적립금 (배송완료 시)
  const expectedMileageEarn = useMemo(() => {
    if (!ENABLE_REWARDS || !isMemberCheckout) {
      return 0;
    }
    const rate = Math.max(0, Math.floor(storeConfig.mileageEarnRate || 0));
    return rate > 0 ? Math.floor((finalPayable * rate) / 100) : 0;
  }, [isMemberCheckout, storeConfig.mileageEarnRate, finalPayable]);

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

    return copied.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [reviews, reviewSort]);

  const embeddedVideoUrl = useMemo(() => {
    if (!storeConfig.videoUrl) {
      return "";
    }

    const rawEmbedUrl = toEmbedVideoUrl(storeConfig.videoUrl);
    if (!rawEmbedUrl) {
      return "";
    }

    try {
      const url = new URL(rawEmbedUrl);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      url.searchParams.set("autoplay", "1");
      url.searchParams.set("mute", "1");
      url.searchParams.set("muted", "1");
      url.searchParams.set("volume", "0");
      url.searchParams.set("playsinline", "1");

      if (host.includes("youtube.com") || host.includes("youtube-nocookie.com")) {
        url.searchParams.set("enablejsapi", "1");
        url.searchParams.set("rel", "0");
        url.searchParams.set("modestbranding", "1");
      }

      if (host.includes("vimeo.com")) {
        url.searchParams.set("api", "1");
      }

      return url.toString();
    } catch {
      return rawEmbedUrl;
    }
  }, [storeConfig.videoUrl]);

  function forceMuteEmbeddedVideo() {
    const iframe = videoIframeRef.current;
    if (!iframe || !iframe.src) {
      return;
    }

    try {
      const url = new URL(iframe.src);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();

      if (host.includes("youtube.com") || host.includes("youtube-nocookie.com")) {
        iframe.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "mute", args: [] }), "*");
        iframe.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "setVolume", args: [0] }), "*");
      }

      if (host.includes("vimeo.com")) {
        iframe.contentWindow?.postMessage(JSON.stringify({ method: "setVolume", value: 0 }), "*");
      }
    } catch {
      // Ignore postMessage failures for unsupported providers.
    }
  }

  function changeQuantity(productId: number, delta: number): void {
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

  function validateOrderBeforeSubmit(): boolean {
    setError(null);

    if (!isOrderAvailable) {
      setError(activeBusinessStatusText);
      setShowBusinessStatusModal(true);
      return false;
    }

    if (!cartItems.length) {
      setError("장바구니에 상품을 추가해주세요.");
      return false;
    }

    const firstOverLimitItem = cartItems.find((item) => item.quantity > item.stock);
    if (firstOverLimitItem) {
      setError(`${firstOverLimitItem.name}의 남은 수량을 초과했습니다. 수량을 조정해주세요.`);
      return false;
    }

    if (purchaseType === "guest" && !guestOrderPhoneVerified) {
      setError("비회원 주문은 휴대폰 인증이 필요합니다.");
      return false;
    }

    if (!depositorName.trim()) {
      setError("입금자명을 입력해주세요.");
      return false;
    }

    if (!recipientName.trim()) {
      setError("수신자명을 입력해주세요.");
      return false;
    }

    if (!phone.trim()) {
      setError("수신자 연락처를 입력해주세요.");
      return false;
    }

    const resolvedPostalCode =
      purchaseType === "guest" ? guestPostalCode.trim() : memberPostalCode.trim();

    if (!resolvedPostalCode) {
      setError("우편번호를 입력해주세요.");
      return false;
    }

    const resolvedShippingAddress =
      purchaseType === "guest"
        ? [guestAddressBase, guestAddressDetail].filter(Boolean).join(" ").trim()
        : shippingAddress.trim();

    if (!resolvedShippingAddress) {
      setError("배송지를 입력해주세요.");
      return false;
    }

    return true;
  }

  function requestOrderSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateOrderBeforeSubmit()) {
      return;
    }

    setShowOrderConfirmModal(true);
  }

  async function submitOrder() {
    if (submitting) {
      return;
    }

    if (!validateOrderBeforeSubmit()) {
      return;
    }

    const resolvedShippingAddress =
      purchaseType === "guest"
        ? [guestAddressBase, guestAddressDetail].filter(Boolean).join(" ").trim()
        : shippingAddress.trim();
    const resolvedPostalCode = purchaseType === "guest" ? guestPostalCode.trim() : memberPostalCode.trim();
    const shippingAddressWithPostal = resolvedPostalCode
      ? `[${resolvedPostalCode}] ${resolvedShippingAddress}`
      : resolvedShippingAddress;

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName: recipientName.trim() || depositorName.trim(),
          phone,
          shippingAddress: shippingAddressWithPostal,
          requestNote: resolvedOrderRequestNote || undefined,
          depositorName,
          purchaseType,
          excludeMemberBonus: purchaseType === "member" ? excludeMemberBonus : undefined,
          lookupToken: purchaseType === "guest" ? guestOrderLookupToken : undefined,
          // 회원 전용: 주문자 계정 및 쿠폰/적립금
          accountId: purchaseType === "member" ? memberAccountId : undefined,
          couponId: ENABLE_REWARDS && purchaseType === "member" ? (selectedCouponId ?? undefined) : undefined,
          mileageToUse: ENABLE_REWARDS && purchaseType === "member" && mileageToUse > 0 ? mileageToUse : undefined,
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
      setRecipientName("");
      setShippingAddress("");
      setMemberPostalCode("");
      setGuestPostalCode("");
      setGuestAddressBase("");
      setGuestAddressDetail("");
      setGuestOrderCode("");
      setGuestOrderCodeSent(false);
      setGuestOrderLookupToken(null);
      setGuestOrderPhoneVerified(false);
      setGuestOrderCodeExpiresAt(null);
      setGuestOrderCodeRemainingSec(0);
      setOrderRequestPreset("");
      setOrderRequestCustomNote("");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "결제 요청에 실패했습니다.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function requestGuestOrderCode() {
    if (!isOrderAvailable) {
      setError(activeBusinessStatusText);
      setShowBusinessStatusModal(true);
      return;
    }

    const normalizedPhone = phone.replace(/\D/g, "");
    if (!normalizedPhone) {
      setError("전화번호를 입력해주세요.");
      return;
    }

    setGuestOrderSendingCode(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/orders/lookup/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: normalizedPhone,
          purpose: "checkout",
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "인증번호 요청에 실패했습니다.");
      }

      const data = (await response.json()) as {
        alreadyRegistered?: boolean;
        message?: string;
        expiresAt?: string;
      };

      if (data.alreadyRegistered) {
        setGuestOrderCodeSent(false);
        setGuestOrderLookupToken(null);
        setGuestOrderPhoneVerified(false);
        setGuestOrderCodeExpiresAt(null);
        setGuestOrderCodeRemainingSec(0);
        setGuestHasRegisteredAccount(true);
        setError(null);
        return;
      }

      const expiresAtMs = Date.now() + 3 * 60 * 1000;

      setGuestOrderCodeSent(true);
      setGuestOrderLookupToken(null);
      setGuestOrderPhoneVerified(false);
      setGuestHasRegisteredAccount(false);
      setGuestOrderCodeExpiresAt(Number.isFinite(expiresAtMs) ? expiresAtMs : null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "인증번호 요청 실패");
    } finally {
      setGuestOrderSendingCode(false);
    }
  }

  async function verifyGuestOrderCode() {
    if (!isOrderAvailable) {
      setError(activeBusinessStatusText);
      setShowBusinessStatusModal(true);
      return;
    }

    const normalizedPhone = phone.replace(/\D/g, "");
    if (!normalizedPhone || !guestOrderCode.trim()) {
      setError("전화번호와 인증번호를 입력해주세요.");
      return;
    }

    if (guestOrderCodeRemainingSec <= 0) {
      setError("인증번호가 만료되었습니다. 다시 요청해주세요.");
      return;
    }

    setGuestOrderVerifyingCode(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/orders/lookup/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: normalizedPhone,
          code: guestOrderCode.trim(),
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "인증번호 확인에 실패했습니다.");
      }

      const result = (await response.json()) as { lookupToken: string };
      setGuestOrderLookupToken(result.lookupToken);
      setGuestOrderPhoneVerified(true);
    } catch (verifyError) {
      setGuestOrderLookupToken(null);
      setGuestOrderPhoneVerified(false);
      setError(verifyError instanceof Error ? verifyError.message : "인증번호 확인 실패");
    } finally {
      setGuestOrderVerifyingCode(false);
    }
  }

  function searchGuestAddress() {
    if (!window.daum?.Postcode) {
      setError("주소 검색 준비 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    new window.daum.Postcode({
      oncomplete: (data) => {
        const baseAddress = data.roadAddress || data.jibunAddress;
        const buildingSuffix = data.apartment === "Y" && data.buildingName ? ` (${data.buildingName})` : "";
        setGuestPostalCode(data.zonecode?.trim() || "");
        setGuestAddressBase(`${baseAddress}${buildingSuffix}`.trim());
        setError(null);
      },
    }).open();
  }

  function searchMemberAddress() {
    if (!window.daum?.Postcode) {
      setError("주소 검색 준비 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    new window.daum.Postcode({
      oncomplete: (data) => {
        const baseAddress = data.roadAddress || data.jibunAddress;
        const buildingSuffix = data.apartment === "Y" && data.buildingName ? ` (${data.buildingName})` : "";
        setMemberPostalCode(data.zonecode?.trim() || "");
        setShippingAddress(`${baseAddress}${buildingSuffix}`.trim());
        setError(null);
      },
    }).open();
  }

  async function confirmOrderSubmit() {
    if (submitting) {
      return;
    }

    setShowOrderConfirmModal(false);
    await submitOrder();
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
      router.push("/login?callback=/");
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
      const message = submitError instanceof Error ? submitError.message : "후기 등록 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function confirmLogout() {
    setLogoutSubmitting(true);

    try {
      const userId = session?.user?.email?.trim();
      if (userId) {
        await fetch(`${API_BASE}/api/auth/kakao/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId }),
        }).catch(() => null);
      }

      const kakao = window.Kakao;
      kakao?.Auth?.setAccessToken?.(null);
      if (kakao?.Auth?.logout) {
        await new Promise<void>((resolve) => {
          kakao.Auth.logout?.(() => resolve());
          window.setTimeout(() => resolve(), 300);
        });
      }

      await signOut({ redirect: false });
      router.refresh();
      window.location.reload();
    } finally {
      setLogoutSubmitting(false);
      setShowLogoutConfirmModal(false);
    }
  }

  async function fillDefaultShippingAddress() {
    const userId = session?.user?.email?.trim();
    if (!userId) {
      setShippingAddress("");
      setMemberPostalCode("");
      return;
    }

    setLoadingDefaultShipping(true);
    try {
      const profileData = await getProfileApi(userId);

      const storedMemberPhone =
        typeof window !== "undefined" ? localStorage.getItem(MEMBER_PHONE_KEY)?.trim() || "" : "";
      const resolvedPhone =
        profileData.profile.phone?.trim() || savedMemberPhone.trim() || storedMemberPhone;

      setDepositorName(profileData.profile.name || session?.user?.name || "");
      setRecipientName(profileData.profile.name || session?.user?.name || "");
      setPhone(resolvedPhone);

      // 회원 쿠폰/적립금 로드
      const accountId = profileData.profile.id;
      setMemberAccountId(accountId);
      setSelectedCouponId(null);
      setMileageInput("");
      if (!ENABLE_REWARDS) {
        setMemberCoupons([]);
        setMileageBalance(0);
      } else {
        try {
          const [couponsData, mileageData] = await Promise.all([getMyCouponsApi(accountId), getMyMileageApi(accountId)]);
          setMemberCoupons(couponsData);
          setMileageBalance(mileageData.balance);
        } catch {
          setMemberCoupons([]);
          setMileageBalance(0);
        }
      }

      setShippingAddress([profileData.profile.address1, profileData.profile.address2].filter(Boolean).join(" ").trim());

      setMemberPostalCode(profileData.profile.kakaoShippingZoneNumber ?? "");
    } catch {
      setShippingAddress("");
      setMemberPostalCode("");
      setRecipientName("");
      setMemberCoupons([]);
      setMileageBalance(0);
    } finally {
      setLoadingDefaultShipping(false);
    }
  }

  return (
    <div className="min-h-screen bg-corn-pattern pb-24 text-stone-900">
      <header className="border-b border-amber-200/80 bg-amber-100/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="font-display text-2xl text-amber-700 sm:text-3xl">{storeConfig.shopName || "옥수수 가게"}</p>
            <p className="mt-1 text-sm text-amber-900/90 sm:text-base">
              {storeConfig.detailDescription || "상점 설명"}
            </p>
            <div
              className={`mt-2 inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                storeConfig.businessStatus === "open"
                  ? "border-lime-300 bg-lime-50 text-lime-800"
                  : storeConfig.businessStatus === "standby"
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-rose-300 bg-rose-50 text-rose-800"
              }`}
              title={activeBusinessStatusText}
            >
              <span>
                {storeConfig.businessStatus === "open"
                  ? "영업중"
                  : storeConfig.businessStatus === "standby"
                    ? "영업 대기"
                    : "영업 종료"}
              </span>
              <span className="text-[11px] font-medium">{activeBusinessStatusText}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isLoggedIn && (
              <button
                type="button"
                onClick={() => {
                  const callbackUrl = `${window.location.pathname}${window.location.search}` || "/";
                  router.push(`/login?callback=${encodeURIComponent(callbackUrl)}`);
                }}
                className="whitespace-nowrap rounded-full border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800"
              >
                로그인
              </button>
            )}
            {isLoggedIn && (
              <>
                <div className="flex items-center gap-2">
                  <p className="whitespace-nowrap text-xs font-semibold text-amber-900">
                    {session?.user?.name ?? "회원"}님
                  </p>
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowMenuDrawer(true)}
              aria-label="메뉴 열기"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-300 bg-white text-lg font-bold text-amber-800"
            >
              ☰
            </button>
          </div>
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
            <div className="grid gap-3 sm:grid-cols-2">
              {products.map((product, index) => (
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
                      priority={index === 0}
                      className="h-36 w-full object-cover"
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-lime-600 px-2 py-1 text-xs font-bold tracking-wide text-white">
                      {product.badge}
                    </span>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="font-display text-2xl text-amber-700">{product.name}</h3>
                      <p className="mt-1 text-sm text-stone-600">{product.description}</p>
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-lg font-extrabold text-stone-900">{formatCurrency(product.price)}</p>
                          <p className="text-xs text-stone-500">남은 수량 {product.stock}개</p>
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-full border border-stone-300 px-2 py-1 sm:justify-normal">
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
                                <span className="min-w-6 text-center text-sm font-bold">{quantity}</span>
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
          <div className="space-y-2">
            <h3 className="text-base font-bold text-stone-900">이미지</h3>
            {storeConfig.storyImages.length > 0 ? (
              <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                {storeConfig.storyImages.map((item, index) => (
                  <article
                    key={`${item.imageUrl}-${index}`}
                    className="w-[180px] min-w-[180px] overflow-hidden rounded-2xl border border-stone-200 sm:w-[240px] sm:min-w-[240px]"
                  >
                    <Image
                      src={item.imageUrl}
                      alt={item.title || `이미지 ${index + 1}`}
                      width={1200}
                      height={800}
                      className="h-36 w-full object-cover sm:h-44"
                    />
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-500">등록된 상점 이미지가 없습니다.</p>
            )}
          </div>

          {embeddedVideoUrl ? (
            <div className="overflow-hidden rounded-2xl border border-stone-200">
              <div className="aspect-video w-full">
                <iframe
                  ref={videoIframeRef}
                  src={embeddedVideoUrl}
                  title="상품 소개 영상"
                  className="h-full w-full"
                  onLoad={forceMuteEmbeddedVideo}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>
          ) : (
            <></>
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
                <div className="border-t border-lime-100 px-4 py-4">
                  <div>
                    <p className="font-semibold text-stone-900 text-sm">재료</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-700">
                      {recipe.ingredients.map((ingredient) => (
                        <li key={ingredient}>{ingredient}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-4">
                    <p className="font-semibold text-stone-900 text-sm">조리순서</p>
                    <div className="mt-3 flex flex-col gap-3">
                      {recipe.steps.map((step, idx) => (
                        <div key={idx} className="flex gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                          {step.imageUrl && (
                            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-md bg-stone-100">
                              <img
                                src={step.imageUrl}
                                alt={`${recipe.title} ${idx + 1}단계`}
                                className="h-full w-full object-cover rounded-md"
                              />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-stone-700">{idx + 1}단계</p>
                            <p className="mt-1 text-xs text-stone-600">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            ))}
            {storeConfig.recipes.length === 0 && <p className="text-sm text-stone-600">등록된 레시피가 없습니다.</p>}
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
                isLoggedIn ? "후기 내용을 입력하세요 (예: 달고 신선해요)" : "로그인 후 후기 작성이 가능합니다"
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
                onClick={() => router.push("/login?callback=/")}
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
                <p className="mt-1 text-xs text-stone-500">작성일 {formatKoreanDateTime(review.createdAt)}</p>
                {review.comments.length > 0 && (
                  <div className="mt-3 rounded-xl bg-stone-50 p-3 text-sm text-stone-700">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-stone-600">
                      <span
                        className={`rounded-full px-2 py-0.5 ${
                          isOperatorAuthor(review.comments[review.comments.length - 1]?.name ?? "")
                            ? "bg-lime-100 text-lime-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {isOperatorAuthor(review.comments[review.comments.length - 1]?.name ?? "") ? "운영" : "고객"}
                      </span>
                      <span>{review.comments[review.comments.length - 1]?.name ?? "댓글"}</span>
                    </p>
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

      <div className="border-t border-amber-200 bg-white p-4 sm:fixed sm:inset-x-0 sm:bottom-0 sm:z-40 sm:bg-white/95 sm:backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
          <div className="flex-1 rounded-xl bg-amber-50 px-3 py-2">
            <p className="text-xs text-stone-600">선택 수량 {totalQuantity}개</p>
            <p className="text-sm font-extrabold text-amber-700">{formatCurrency(totalPrice)}</p>
          </div>
          <div className="group relative">
            {!isOrderAvailable && (
              <div className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden w-64 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow-lg group-hover:block">
                주문 불가 사유: {activeBusinessStatusText}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (!isOrderAvailable) {
                  setShowBusinessStatusModal(true);
                  return;
                }

                setShowPurchaseModal(true);
                setShowOrderConfirmModal(false);
                if (isLoggedIn) {
                  setPurchaseType("member");
                  setMemberPostalCode("");
                  void fillDefaultShippingAddress();
                } else {
                  setPurchaseType(null);
                  setDepositorName("");
                  setPhone("");
                  setShippingAddress("");
                  setMemberPostalCode("");
                  setGuestPostalCode("");
                }
                setOrderRequestPreset("");
                setOrderRequestCustomNote("");
                setOrderDone(null);
                setError(null);
              }}
              disabled={submitting || totalQuantity === 0 || !isOrderAvailable}
              className="min-w-36 rounded-xl bg-lime-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-lime-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isOrderAvailable ? "구매 신청" : "주문 불가"}
            </button>
          </div>
        </div>
      </div>

      <footer className="mt-6 border-t border-stone-200 bg-white px-3 py-5 pt-5 text-stone-900 sm:px-4 sm:py-6 sm:pt-6">
        <div className="mx-auto w-full max-w-3xl space-y-3">
          <OperatorProductInfo
            producerName={storeConfig.sellerName}
            producerPhone={storeConfig.sellerPhone}
            origin={storeConfig.origin}
          />
          <div className="flex flex-wrap gap-2 text-xs">
            {storeConfig.termsUrl && (
              <Link
                href="/terms"
                className="rounded-full border border-stone-300 bg-white px-3 py-1.5 font-semibold hover:bg-stone-100"
              >
                이용약관
              </Link>
            )}
            <Link
              href="/privacy"
              className="rounded-full border border-stone-300 bg-white px-3 py-1.5 font-semibold hover:bg-stone-100"
            >
              개인정보처리방침
            </Link>
          </div>
        </div>
      </footer>

      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-5 shadow-2xl">
            {!orderDone ? (
              <>
                <h2 className="font-display text-3xl text-amber-800">구매 신청</h2>
                {storeConfig.memberBonusProductName && (
                  <p className="mt-3 rounded-xl bg-lime-50 px-3 py-2 text-xs font-semibold text-lime-800">
                    🎁 회원으로 주문하시면 &lsquo;{storeConfig.memberBonusProductName}&rsquo;을(를) 사은품으로 함께
                    보내드려요.
                  </p>
                )}
                {purchaseType === null ? (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm text-stone-600">구매 방식을 선택해주세요.</p>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!isLoggedIn) {
                          router.push("/login?callback=/");
                          return;
                        }
                        setPurchaseType("member");
                        setExcludeMemberBonus(false);
                        setRecipientName("");
                        setMemberPostalCode("");
                        void fillDefaultShippingAddress();
                      }}
                      className="w-full rounded-xl bg-lime-600 px-4 py-3 text-sm font-bold text-white"
                    >
                      회원 구매
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPurchaseType("guest");
                        setExcludeMemberBonus(false);
                        setDepositorName("");
                        setRecipientName("");
                        setPhone("");
                        setShippingAddress("");
                        setMemberPostalCode("");
                        setGuestPostalCode("");
                        setGuestAddressBase("");
                        setGuestAddressDetail("");
                        setGuestOrderCode("");
                        setGuestOrderCodeSent(false);
                        setGuestOrderLookupToken(null);
                        setGuestOrderPhoneVerified(false);
                        setGuestOrderCodeExpiresAt(null);
                        setGuestOrderCodeRemainingSec(0);
                        setGuestHasRegisteredAccount(false);
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
                      onClick={() => {
                        setShowPurchaseModal(false);
                        setShowOrderConfirmModal(false);
                      }}
                      className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold"
                    >
                      닫기
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-stone-600">
                      {purchaseType === "member"
                        ? "로그인 계정 정보와 기본 주소를 불러왔습니다."
                        : "입금자명, 수신자명, 수신자 연락처를 입력해주세요."}
                    </p>
                    <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                      수신자/배송지는 이번 주문에만 사용됩니다. 기본값은 자동으로 불러오며 자유롭게 수정할 수 있어요.
                    </p>

                    <form className="mt-4 space-y-3" onSubmit={requestOrderSubmit}>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-stone-700">주문자</p>
                        <input
                          value={depositorName}
                          onChange={(event) => setDepositorName(event.target.value)}
                          placeholder="입금자명"
                          className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-stone-700">받으시는 분</p>
                        <input
                          value={recipientName}
                          onChange={(event) => setRecipientName(event.target.value)}
                          placeholder="수신자명"
                          className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                          required
                        />
                      </div>
                      <input
                        value={phone}
                        onChange={(event) => {
                          setPhone(event.target.value);
                          if (purchaseType === "guest") {
                            setGuestOrderPhoneVerified(false);
                            setGuestOrderLookupToken(null);
                            setGuestOrderCodeExpiresAt(null);
                            setGuestOrderCodeRemainingSec(0);
                            setGuestHasRegisteredAccount(false);
                          }
                        }}
                        placeholder="수신자 연락처"
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                        required
                      />
                      <p className="text-xs text-stone-500">입금자명(이체 확인), 수신자 정보(배송 수령)로 사용됩니다.</p>
                      {purchaseType === "guest" && (
                        <PhoneVerificationBox
                          code={guestOrderCode}
                          onCodeChange={setGuestOrderCode}
                          codeSent={guestOrderCodeSent}
                          verified={guestOrderPhoneVerified}
                          remainingSec={guestOrderCodeRemainingSec}
                          sending={guestOrderSendingCode}
                          verifying={guestOrderVerifyingCode}
                          onSend={() => {
                            void requestGuestOrderCode();
                          }}
                          onVerify={() => {
                            void verifyGuestOrderCode();
                          }}
                          sellerPhone={storeConfig.sellerPhone}
                        >
                          {guestHasRegisteredAccount && (
                            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                              <p className="text-xs font-semibold text-amber-800">
                                해당 번호로 가입된 아이디가 있습니다.
                              </p>
                              <Link
                                href="/recover/find-id"
                                className="inline-flex rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-800"
                              >
                                아이디 찾기
                              </Link>
                            </div>
                          )}
                        </PhoneVerificationBox>
                      )}

                      {purchaseType === "member" ? (
                        <div className="space-y-2">
                          <p className="text-xs text-stone-500">기본 배송지가 자동으로 불러와지며, 직접 수정 가능합니다.</p>
                          <div className="flex gap-2">
                            <input
                              value={memberPostalCode}
                              onChange={(event) => setMemberPostalCode(event.target.value)}
                              placeholder="우편번호"
                              className="w-28 rounded-xl border border-stone-300 px-3 py-2 text-sm"
                            />
                            <button
                              type="button"
                              onClick={searchMemberAddress}
                              disabled={!postcodeReady}
                              className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-bold text-stone-700 disabled:opacity-60"
                            >
                              {postcodeReady ? "주소 검색" : "로딩 중..."}
                            </button>
                          </div>
                          <input
                            value={shippingAddress}
                            onChange={(event) => setShippingAddress(event.target.value)}
                            placeholder="배송지 주소"
                            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                            required
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-stone-500">우편번호 입력 후 주소 검색으로 기본주소를 선택해주세요.</p>
                          <div className="flex gap-2">
                            <input
                              value={guestPostalCode}
                              onChange={(event) => setGuestPostalCode(event.target.value)}
                              placeholder="우편번호"
                              className="w-28 rounded-xl border border-stone-300 px-3 py-2 text-sm"
                            />
                            <input
                              value={guestAddressBase}
                              readOnly
                              placeholder="주소 검색 버튼으로 기본주소를 선택해주세요"
                              className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                              required
                            />
                            <button
                              type="button"
                              onClick={searchGuestAddress}
                              disabled={!postcodeReady}
                              className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-bold text-stone-700 disabled:opacity-60"
                            >
                              {postcodeReady ? "주소 검색" : "로딩 중..."}
                            </button>
                          </div>
                          <input
                            value={guestAddressDetail}
                            onChange={(event) => setGuestAddressDetail(event.target.value)}
                            placeholder="상세주소"
                            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <select
                          value={orderRequestPreset}
                          onChange={(event) => setOrderRequestPreset(event.target.value as OrderRequestPresetValue)}
                          className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                        >
                          <option value="">주문시 요청 사항 선택</option>
                          <option value="문 앞에 놓아주세요">문 앞에 놓아주세요</option>
                          <option value="경비실에 맡겨 주세요">경비실에 맡겨 주세요</option>
                          <option value="전화주세요">전화주세요</option>
                          <option value={ORDER_REQUEST_CUSTOM_VALUE}>직접 입력</option>
                        </select>
                        {orderRequestPreset === ORDER_REQUEST_CUSTOM_VALUE && (
                          <textarea
                            value={orderRequestCustomNote}
                            onChange={(event) => setOrderRequestCustomNote(event.target.value)}
                            placeholder="요청 사항을 직접 입력해주세요"
                            className="h-20 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                          />
                        )}
                      </div>
                      {purchaseType === "member" && loadingDefaultShipping && (
                        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                          계정 정보와 기본 배송지를 불러오는 중입니다...
                        </p>
                      )}

                      {isMemberCheckout && ENABLE_REWARDS && (
                        <div className="space-y-3 rounded-2xl border border-lime-200 bg-lime-50/60 p-3">
                          <div className="space-y-1">
                            <span className="text-xs font-semibold text-stone-700">쿠폰</span>
                            <select
                              value={selectedCouponId ?? ""}
                              onChange={(e) => setSelectedCouponId(e.target.value ? Number(e.target.value) : null)}
                              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                            >
                              <option value="">쿠폰 미사용</option>
                              {memberCoupons.map((coupon) => {
                                const usable = totalPrice >= (coupon.minOrderAmount ?? 0);
                                return (
                                  <option key={coupon.id} value={coupon.id} disabled={!usable}>
                                    {coupon.name} (
                                    {coupon.discountType === "percent"
                                      ? `${coupon.discountValue}%`
                                      : formatCurrency(coupon.discountValue)}
                                    {coupon.minOrderAmount > 0 ? `, ${formatCurrency(coupon.minOrderAmount)} 이상` : ""}
                                    {usable ? "" : " · 최소금액 미달"})
                                  </option>
                                );
                              })}
                            </select>
                            {memberCoupons.length === 0 && (
                              <span className="block text-[11px] text-stone-500">보유한 쿠폰이 없습니다.</span>
                            )}
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs font-semibold text-stone-700">
                              적립금 사용 (보유 {formatCurrency(mileageBalance)})
                            </span>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min={0}
                                value={mileageInput}
                                onChange={(e) => setMileageInput(e.target.value)}
                                placeholder="0"
                                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => setMileageInput(String(Math.min(mileageBalance, payableBeforeMileage)))}
                                disabled={mileageBalance <= 0}
                                className="shrink-0 rounded-xl border border-stone-300 px-3 py-2 text-xs font-bold text-stone-700 disabled:opacity-50"
                              >
                                전액 사용
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="rounded-2xl bg-amber-50 p-3">
                        {(effectiveDeliveryFee > 0 || couponDiscount > 0 || mileageToUse > 0) && (
                          <div className="mb-2 space-y-0.5 text-xs text-stone-600">
                            <p className="flex justify-between">
                              <span>상품 금액</span>
                              <span>{formatCurrency(totalPrice)}</span>
                            </p>
                            {effectiveDeliveryFee > 0 && (
                              <p className="flex justify-between">
                                <span>배송료</span>
                                <span>{formatCurrency(effectiveDeliveryFee)}</span>
                              </p>
                            )}
                            {couponDiscount > 0 && (
                              <p className="flex justify-between text-lime-700">
                                <span>쿠폰 할인</span>
                                <span>-{formatCurrency(couponDiscount)}</span>
                              </p>
                            )}
                            {mileageToUse > 0 && (
                              <p className="flex justify-between text-lime-700">
                                <span>적립금 사용</span>
                                <span>-{formatCurrency(mileageToUse)}</span>
                              </p>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-stone-600">최종 결제 예정 금액</p>
                        <p className="text-2xl font-extrabold text-amber-700">{formatCurrency(finalPayable)}</p>
                        {expectedMileageEarn > 0 && (
                          <p className="mt-1 text-[11px] font-semibold text-lime-700">
                            배송완료 시 {formatCurrency(expectedMileageEarn)} 적립 예정
                          </p>
                        )}
                      </div>

                      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (isLoggedIn) {
                              setShowPurchaseModal(false);
                              setShowOrderConfirmModal(false);
                              return;
                            }
                            setPurchaseType(null);
                            setShowOrderConfirmModal(false);
                          }}
                          className="flex-1 rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold"
                        >
                          이전
                        </button>
                        <button
                          type="submit"
                          disabled={submitting || !isOrderAvailable}
                          className="flex-1 rounded-xl bg-lime-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                        >
                          {!isOrderAvailable ? "주문 불가" : submitting ? "접수 중..." : "주문 접수"}
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
                      await navigator.clipboard.writeText(String(orderDone.order.id));
                      setCopyDone(true);
                      setTimeout(() => setCopyDone(false), 1500);
                    }}
                    className="rounded-lg border border-lime-300 bg-white px-2 py-1 text-xs font-semibold text-lime-800"
                  >
                    {copyDone ? "복사됨" : "주문번호 복사"}
                  </button>
                </div>
                <p className="text-sm text-stone-700">현재상태: {getOrderStatusLabelKo(orderDone.order.status)}</p>
                {orderDone.order.deliveryFee > 0 && (
                  <p className="text-sm text-stone-700">배송료: {formatCurrency(orderDone.order.deliveryFee)}</p>
                )}
                {ENABLE_REWARDS && orderDone.order.couponDiscount > 0 && (
                  <p className="text-sm text-lime-700">쿠폰 할인: -{formatCurrency(orderDone.order.couponDiscount)}</p>
                )}
                {ENABLE_REWARDS && orderDone.order.mileageUsed > 0 && (
                  <p className="text-sm text-lime-700">적립금 사용: -{formatCurrency(orderDone.order.mileageUsed)}</p>
                )}
                <p className="text-sm text-stone-700">주문금액: {formatCurrency(orderDone.order.totalAmount)}</p>

                <div className="mt-3 rounded-2xl border border-dashed border-lime-300 bg-lime-50 p-3 text-sm text-lime-900">
                  <p className="font-bold">계좌이체 안내</p>
                  <p>{orderDone.transfer.bankName}</p>
                  <p>{orderDone.transfer.accountNumber}</p>
                  <p>{orderDone.transfer.accountHolder}</p>
                  {orderDone.order.paymentDueAt && (
                    <p className="mt-2 rounded-lg bg-white/70 px-2 py-1 text-xs font-bold text-rose-700">
                      입금 기한: {formatKoreanDateTime(orderDone.order.paymentDueAt)} 까지
                      <br />
                      기한 내 미입금 시 주문이 자동 취소됩니다.
                    </p>
                  )}
                  <p className="mt-2 text-xs">입금 확인 후 서비스 운영자가 주문 상태를 변경합니다.</p>
                </div>

                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">알림으로 발송되었습니다.</p>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPurchaseModal(false);
                      setOrderDone(null);
                      setShowOrderConfirmModal(false);
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

      {showPurchaseModal && showOrderConfirmModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            if (!submitting) {
              setShowOrderConfirmModal(false);
            }
          }}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-lime-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="font-display text-3xl text-lime-800">주문 접수 확인</h2>
            <p className="mt-1 text-sm text-stone-600">입력하신 정보로 주문을 접수할까요?</p>
            <div className="mt-3 space-y-2 rounded-2xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-700">
              <p className="font-bold text-stone-900">주문 정보</p>
              <p>구매 유형: {purchaseType === "member" ? "회원" : "비회원"}</p>
              <p>입금자명: {depositorName || "-"}</p>
              <p>수신자명: {recipientName || "-"}</p>
              <p>수신자 연락처: {phone ? formatPhone(phone) : "-"}</p>
              <p>우편번호: {confirmPostalCode || "-"}</p>
              <p>배송지: {confirmShippingAddress || "-"}</p>
              <p>요청사항: {resolvedOrderRequestNote || "없음"}</p>
            </div>

            <div className="mt-2 rounded-2xl border border-lime-200 bg-lime-50 p-3">
              <p className="text-xs font-bold text-lime-900">주문 품목 ({totalQuantity}개)</p>
              <ul className="mt-1 max-h-36 space-y-1 overflow-y-auto text-xs text-lime-900">
                {confirmCartItems.map((item) => (
                  <li
                    key={`confirm-${item.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg bg-white/80 px-2 py-1"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{item.name}</p>
                      <p className="text-[11px] text-stone-600">{formatCurrency(item.subtotal)}</p>
                    </div>
                    <div className="flex items-center gap-1 rounded-full border border-lime-300 bg-white px-1 py-0.5">
                      <button
                        type="button"
                        onClick={() => changeQuantity(item.id, -1)}
                        disabled={item.quantity <= 0}
                        className="h-6 w-6 rounded-full bg-stone-100 text-sm font-bold text-stone-700"
                        aria-label={`${item.name} 수량 감소`}
                      >
                        -
                      </button>
                      <span className="min-w-5 text-center text-[11px] font-bold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => changeQuantity(item.id, 1)}
                        disabled={item.quantity >= item.stock}
                        className="h-6 w-6 rounded-full bg-lime-100 text-sm font-bold text-lime-800 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`${item.name} 수량 증가`}
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {confirmCartItems.length === 0 && (
                <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
                  장바구니가 비었습니다. 수정 후 다시 주문해주세요.
                </p>
              )}
            </div>

            {effectiveDeliveryFee > 0 || couponDiscount > 0 || mileageToUse > 0 ? (
              <div className="mt-2 space-y-0.5 text-sm text-stone-700">
                <p>상품 금액 {formatCurrency(totalPrice)}</p>
                {effectiveDeliveryFee > 0 && <p>배송료 {formatCurrency(effectiveDeliveryFee)}</p>}
                {ENABLE_REWARDS && couponDiscount > 0 && <p className="text-lime-700">쿠폰 할인 -{formatCurrency(couponDiscount)}</p>}
                {ENABLE_REWARDS && mileageToUse > 0 && <p className="text-lime-700">적립금 사용 -{formatCurrency(mileageToUse)}</p>}
                <p className="font-semibold text-stone-900">총 결제 예정 금액 {formatCurrency(finalPayable)}</p>
                {ENABLE_REWARDS && expectedMileageEarn > 0 && (
                  <p className="text-[11px] text-lime-700">
                    배송완료 시 {formatCurrency(expectedMileageEarn)} 적립 예정
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm font-semibold text-stone-800">
                총 결제 예정 금액 {formatCurrency(totalPrice)}
              </p>
            )}
            {storeConfig.paymentDueDays > 0 && (
              <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                주문 후 {storeConfig.paymentDueDays}일 이내에 입금해주세요. 기한이 지나면 주문이 자동 취소됩니다.
              </p>
            )}
            {purchaseType === "member" && storeConfig.memberBonusProductName && (
              <label className="mt-2 flex items-center gap-2 rounded-xl border border-lime-200 bg-lime-50 px-3 py-2 text-xs font-semibold text-lime-800">
                <input
                  type="checkbox"
                  checked={!excludeMemberBonus}
                  onChange={(event) => setExcludeMemberBonus(!event.target.checked)}
                  className="h-4 w-4"
                />
                사은품 &lsquo;{storeConfig.memberBonusProductName}&rsquo; 받기
              </label>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowOrderConfirmModal(false)}
                disabled={submitting}
                className="flex-1 rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold text-stone-700"
              >
                수정하기
              </button>
              <button
                type="button"
                onClick={() => void confirmOrderSubmit()}
                disabled={submitting || !isOrderAvailable || totalQuantity === 0}
                className="flex-1 rounded-xl bg-lime-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {!isOrderAvailable ? "주문 불가" : submitting ? "접수 중..." : "주문 접수"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBusinessStatusModal && !isOrderAvailable && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-sm rounded-3xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="font-display text-3xl text-amber-800">주문 안내</h2>
            <p className="mt-2 text-sm font-bold text-stone-900">
              {storeConfig.businessStatus === "standby" ? "영업 대기" : "영업 종료"}
            </p>
            <p className="mt-1 text-sm text-stone-700">{activeBusinessStatusText}</p>
            <button
              type="button"
              onClick={() => setShowBusinessStatusModal(false)}
              className="mt-4 w-full rounded-xl bg-lime-600 px-4 py-3 text-sm font-bold text-white"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {showLogoutConfirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-sm rounded-3xl border border-amber-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="font-display text-3xl text-amber-800">로그아웃</h2>
            <p className="mt-1 text-sm text-stone-600">정말 로그아웃 하시겠어요?</p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirmModal(false)}
                disabled={logoutSubmitting}
                className="flex-1 rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold text-stone-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void confirmLogout()}
                disabled={logoutSubmitting}
                className="flex-1 rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {logoutSubmitting ? "로그아웃 중..." : "로그아웃"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMenuDrawer && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowMenuDrawer(false)}>
          <aside
            className="absolute right-0 top-0 h-full w-80 max-w-[86vw] border-l border-amber-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-3xl text-amber-800">메뉴</h2>
              <button
                type="button"
                onClick={() => setShowMenuDrawer(false)}
                className="rounded-lg border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-700"
              >
                닫기
              </button>
            </div>

            {isLoggedIn ? (
              <div className="mt-3">
                <p className="max-w-[180px] truncate whitespace-nowrap text-sm font-semibold text-amber-900">
                  {session?.user?.name ?? "회원"}님
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowMenuDrawer(false);
                  const callbackUrl = `${window.location.pathname}${window.location.search}` || "/";
                  router.push(`/login?callback=${encodeURIComponent(callbackUrl)}`);
                }}
                className="mt-3 w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-bold text-amber-800"
              >
                로그인
              </button>
            )}

            <div className="mt-4 space-y-2">
              <Link
                href="/orders"
                onClick={() => setShowMenuDrawer(false)}
                className="block w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-center text-sm font-bold text-amber-800"
              >
                주문내역
              </Link>
              {isLoggedIn && ENABLE_REWARDS && (
                <Link
                  href="/account/coupon-mileage"
                  onClick={() => setShowMenuDrawer(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-3 text-center text-sm font-bold text-amber-800"
                >
                  쿠폰/마일리지
                  {hasAvailableCouponBadge && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-extrabold leading-none text-white">
                      N
                    </span>
                  )}
                </Link>
              )}
              <Link
                href="/policy"
                onClick={() => setShowMenuDrawer(false)}
                className="block w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-center text-sm font-bold text-amber-800"
              >
                배송/환불
              </Link>
              <Link
                href="/notices"
                onClick={() => setShowMenuDrawer(false)}
                className="block w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-center text-sm font-bold text-amber-800"
              >
                공지사항
              </Link>
              <button
                type="button"
                onClick={openInquiry}
                className="w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-bold text-amber-800"
              >
                문의하기
              </button>
              {storeConfig.termsUrl && (
                <Link
                  href="/terms"
                  onClick={() => setShowMenuDrawer(false)}
                  className="block w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-center text-sm font-bold text-amber-800"
                >
                  이용약관
                </Link>
              )}

              {isLoggedIn && (
                <>
                  <Link
                    href="/account"
                    onClick={() => setShowMenuDrawer(false)}
                    className="block w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-center text-sm font-bold text-amber-800"
                  >
                    정보수정/탈퇴
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenuDrawer(false);
                      setShowLogoutConfirmModal(true);
                    }}
                    className="w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-bold text-amber-800"
                  >
                    로그아웃
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {activePopupNotice && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-amber-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700">긴급 공지</p>
            </div>
            <h3 className="mt-2 text-xl font-bold text-stone-900">{activePopupNotice.title}</h3>
            <div className="mt-3 max-h-80 overflow-auto rounded-2xl bg-amber-50 p-3">
              <p className="whitespace-pre-wrap text-sm text-stone-800">{activePopupNotice.content}</p>
            </div>
            <div className="mt-4 flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-stone-700">
                <input
                  type="checkbox"
                  checked={dismissPopupChecked}
                  onChange={(event) => setDismissPopupChecked(event.target.checked)}
                  className="h-5 w-5 rounded border-stone-300 accent-amber-600"
                />
                다시 보지 않기
              </label>
              <button
                type="button"
                onClick={closePopupNotice}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {showTermsUpdateModal && storeConfig.termsUrl && (
        <div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-md rounded-3xl border border-lime-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-lime-700">약관 변경 안내</p>
            <h3 className="mt-2 text-xl font-bold text-stone-900">이용약관이 업데이트되었습니다</h3>
            {storeConfig.termsUpdatedAt && (
              <p className="mt-1 text-xs text-stone-500">
                변경 시각: {formatKoreanDateTime(storeConfig.termsUpdatedAt)}
              </p>
            )}
            <p className="mt-3 text-sm text-stone-700">서비스 이용 전 최신 이용약관을 확인해주세요.</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeTermsUpdateModal}
                className="flex-1 rounded-xl border border-stone-300 px-4 py-2 text-sm font-bold text-stone-700"
              >
                나중에 보기
              </button>
              <Link
                href="/terms"
                onClick={closeTermsUpdateModal}
                className="flex-1 rounded-xl bg-lime-600 px-4 py-2 text-center text-sm font-bold text-white"
              >
                약관 보기
              </Link>
            </div>
          </div>
        </div>
      )}

      {showContactAuthDialog && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/45 p-4">
          <div
            className="w-full max-w-sm rounded-3xl border border-amber-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="font-display text-3xl text-amber-800">문의하기 안내</h3>
            <p className="mt-2 text-sm text-stone-700">문의하기는 로그인 후 이용할 수 있습니다.</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowContactAuthDialog(false)}
                className="flex-1 rounded-xl border border-stone-300 px-4 py-2 text-sm font-bold text-stone-700"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowContactAuthDialog(false);
                  const callbackUrl = `${window.location.pathname}${window.location.search}` || "/";
                  router.push(`/login?callback=${encodeURIComponent(callbackUrl)}`);
                }}
                className="flex-1 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white"
              >
                로그인
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
