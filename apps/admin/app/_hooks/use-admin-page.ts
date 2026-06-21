import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  clearAdminAccessToken,
  fetchAdminNotificationsApi,
  getAdminAccessToken,
  createAdminAccountApi,
  createBackofficeOrderApi,
  createProductApi,
  deleteAdminAccountApi,
  deleteProductApi,
  fetchAdminInquiriesApi,
  fetchAdminOrdersApi,
  fetchAdminReviewsApi,
  getConfigApi,
  listAdminAccountsApi,
  listProductsApi,
  loginAdminApi,
  saveConfigApi,
  updateAdminAccountApi,
  updateBackofficeOrderApi,
  updateOrderStatusApi,
  updateProductApi,
  listCouponsApi,
  listCouponTemplatesApi,
  createCouponTemplateApi,
  issueCouponApi,
  issueCouponByTemplateApi,
  revokeCouponApi,
  getAccountMileageApi,
  setAdminAccessToken,
} from "../_lib/api";
import { useFirestoreTriggers } from "./use-firestore-triggers";
import {
  AdminUser,
  AdminUserCreatePayload,
  AdminUserUpdatePayload,
  AdminTab,
  AdminOrderCreatePayload,
  AdminOrderUpdatePayload,
  Inquiry,
  AdminNotification,
  Order,
  OrderStatus,
  Product,
  Review,
  StoreConfig,
  Coupon,
  CouponTemplate,
  CreateCouponTemplateInput,
  IssueCouponByTemplateInput,
  IssueCouponInput,
  MileageSummary,
} from "../_lib/types";

export type AdminPageState = {
  isAuthed: boolean;
  loginUserId: string;
  loginPassword: string;
  loginError: string | null;
  activeTab: AdminTab;
  config: StoreConfig | null;
  products: Product[];
  accounts: AdminUser[];
  orders: Order[];
  inquiries: Inquiry[];
  reviews: Review[];
  notifications: AdminNotification[];
  readAlertIds: string[];
  loading: boolean;
  error: string | null;
  notice: string | null;
  newName: string;
  newDescription: string;
  newPrice: string;
  newStock: string;
  newTotalQuantity: string;
  newImageUrl: string;
  newBadge: string;
  newProductPublic: boolean;
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
  videoUrl: string;
  termsUrl: string;
  privacyUrl: string;
  paymentDueDays: string;
  deliveryFee: string;
  chargeDeliveryFee: boolean;
  memberBonusProductId: number | null;
  configSaved: boolean;
  setLoginUserId: (value: string) => void;
  setLoginPassword: (value: string) => void;
  setActiveTab: (tab: AdminTab) => void;
  setNewName: (value: string) => void;
  setNewDescription: (value: string) => void;
  setNewPrice: (value: string) => void;
  setNewStock: (value: string) => void;
  setNewTotalQuantity: (value: string) => void;
  setNewImageUrl: (value: string) => void;
  setNewBadge: (value: string) => void;
  setNewProductPublic: (value: boolean) => void;
  setShopName: (value: string) => void;
  setSellerName: (value: string) => void;
  setSellerPhone: (value: string) => void;
  setTrusteeBusinessName: (value: string) => void;
  setTrusteeBusinessNumber: (value: string) => void;
  setTrusteeRepresentative: (value: string) => void;
  setTrusteePhone: (value: string) => void;
  setOrigin: (value: string) => void;
  setBankName: (value: string) => void;
  setAccountNumber: (value: string) => void;
  setAccountHolder: (value: string) => void;
  setTransferNote: (value: string) => void;
  setDetailDescription: (value: string) => void;
  setVideoUrl: (value: string) => void;
  setTermsUrl: (value: string) => void;
  setPrivacyUrl: (value: string) => void;
  setPaymentDueDays: (value: string) => void;
  setDeliveryFee: (value: string) => void;
  setChargeDeliveryFee: (value: boolean) => void;
  setMemberBonusProductId: (value: number | null) => void;
  setConfigSaved: (value: boolean) => void;
  submitLogin: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  logout: () => void;
  updateOrderStatus: (orderId: number, status: OrderStatus) => Promise<void>;
  createOrder: (payload: AdminOrderCreatePayload) => Promise<void>;
  updateOrder: (orderId: number, payload: AdminOrderUpdatePayload) => Promise<void>;
  submitProduct: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  createProduct: (payload: {
    name: string;
    description: string;
    price: number;
    stock: number;
    totalQuantity: number;
    imageUrl: string;
    badge: string;
    active: boolean;
  }) => Promise<void>;
  updateProduct: (id: number, payload: {
    name: string;
    description: string;
    price: number;
    stock: number;
    totalQuantity: number;
    imageUrl: string;
    badge: string;
    active: boolean;
  }) => Promise<void>;
  deleteProduct: (id: number) => Promise<void>;
  saveConfig: (
    event: FormEvent<HTMLFormElement>,
    overrides?: Partial<
      Pick<
        StoreConfig,
        | "videoUrl"
        | "termsUrl"
        | "privacyUrl"
        | "businessStatus"
        | "businessStatusOpenText"
        | "businessStatusStandbyText"
        | "businessStatusClosedText"
      >
    >,
  ) => Promise<boolean>;
  saveConfigDirect: (
    overrides?: Partial<
      Pick<
        StoreConfig,
        | "videoUrl"
        | "termsUrl"
        | "privacyUrl"
        | "businessStatus"
        | "businessStatusOpenText"
        | "businessStatusStandbyText"
        | "businessStatusClosedText"
      >
    >,
  ) => Promise<boolean>;
  createAccount: (payload: AdminUserCreatePayload) => Promise<void>;
  updateAccount: (id: number, payload: AdminUserUpdatePayload) => Promise<void>;
  deleteAccount: (id: number) => Promise<void>;
  // 쿠폰 · 적립금
  coupons: Coupon[];
  couponTemplates: CouponTemplate[];
  mileageEarnRate: string;
  setMileageEarnRate: (value: string) => void;
  createCouponTemplate: (input: CreateCouponTemplateInput) => Promise<boolean>;
  issueCouponByTemplate: (input: IssueCouponByTemplateInput) => Promise<boolean>;
  issueCoupon: (input: IssueCouponInput) => Promise<boolean>;
  revokeCoupon: (id: number) => Promise<void>;
  getAccountMileage: (accountId: number) => Promise<MileageSummary | null>;
};

export function useAdminPage(initialTab: AdminTab): AdminPageState {

  const [isAuthed, setIsAuthed] = useState(false);
  const [loginUserId, setLoginUserId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<AdminUser[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [readAlertIds, setReadAlertIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrice, setNewPrice] = useState("9900");
  const [newStock, setNewStock] = useState("20");
  const [newTotalQuantity, setNewTotalQuantity] = useState("20");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newBadge, setNewBadge] = useState("NEW");
  const [newProductPublic, setNewProductPublic] = useState(true);

  const [shopName, setShopName] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [trusteeBusinessName, setTrusteeBusinessName] = useState("");
  const [trusteeBusinessNumber, setTrusteeBusinessNumber] = useState("");
  const [trusteeRepresentative, setTrusteeRepresentative] = useState("");
  const [trusteePhone, setTrusteePhone] = useState("");
  const [origin, setOrigin] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [detailDescription, setDetailDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [termsUrl, setTermsUrl] = useState("");
  const [privacyUrl, setPrivacyUrl] = useState("");
  const [paymentDueDays, setPaymentDueDays] = useState("0");
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [chargeDeliveryFee, setChargeDeliveryFee] = useState(false);
  const [memberBonusProductId, setMemberBonusProductId] = useState<number | null>(null);
  const [mileageEarnRate, setMileageEarnRate] = useState("0");
  const [configSaved, setConfigSaved] = useState(false);

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponTemplates, setCouponTemplates] = useState<CouponTemplate[]>([]);

  function normalizeInquiries(inquiries: Inquiry[]): Inquiry[] {
    return inquiries.map((inquiry) => ({
      ...inquiry,
      comments: Array.isArray((inquiry as { comments?: unknown }).comments)
        ? inquiry.comments
        : [],
    }));
  }

  function normalizeReviews(reviews: Review[]): Review[] {
    return reviews.map((review) => ({
      ...review,
      comments: Array.isArray((review as { comments?: unknown }).comments)
        ? review.comments
        : [],
    }));
  }

  function applyConfig(configValue: StoreConfig) {
    setConfig(configValue);
    setShopName(configValue.shopName ?? "");
    setSellerName(configValue.sellerName ?? "");
    setSellerPhone(configValue.sellerPhone ?? "");
    setTrusteeBusinessName(configValue.trusteeBusinessName ?? "");
    setTrusteeBusinessNumber(configValue.trusteeBusinessNumber ?? "");
    setTrusteeRepresentative(configValue.trusteeRepresentative ?? "");
    setTrusteePhone(configValue.trusteePhone ?? "");
    setOrigin(configValue.origin ?? "");
    setBankName(configValue.bankName ?? "");
    setAccountNumber(configValue.accountNumber ?? "");
    setAccountHolder(configValue.accountHolder ?? "");
    setTransferNote(configValue.transferNote ?? "");
    setDetailDescription(configValue.detailDescription ?? "");
    setVideoUrl(configValue.videoUrl ?? "");
    setTermsUrl(configValue.termsUrl ?? "");
    setPrivacyUrl(configValue.privacyUrl ?? "");
    setPaymentDueDays(String(configValue.paymentDueDays ?? 0));
    setDeliveryFee(String(configValue.deliveryFee ?? 0));
    setChargeDeliveryFee(Boolean(configValue.chargeDeliveryFee));
    setMemberBonusProductId(configValue.memberBonusProductId ?? null);
    setMileageEarnRate(String(configValue.mileageEarnRate ?? 0));
  }

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const token = getAdminAccessToken();
    if (token) {
      setIsAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthed) {
      return;
    }

    async function loadAdminData() {
      setLoading(true);
      setError(null);
      try {
        const [notifications, config] = await Promise.all([
          fetchAdminNotificationsApi(),
          getConfigApi(),
        ]);
        setNotifications(notifications);
        applyConfig(config);

        if (initialTab === "주문내역") {
          const [orders, products, accounts] = await Promise.all([
            fetchAdminOrdersApi(),
            listProductsApi(),
            listAdminAccountsApi(),
          ]);
          setOrders(orders);
          setProducts(products);
          setAccounts(accounts);
        } else if (initialTab === "매출 상세") {
          setOrders(await fetchAdminOrdersApi());
        } else if (initialTab === "상품관리") {
          setProducts(await listProductsApi());
        } else if (initialTab === "문의내역") {
          setInquiries(normalizeInquiries(await fetchAdminInquiriesApi()));
        } else if (initialTab === "후기") {
          setReviews(normalizeReviews(await fetchAdminReviewsApi()));
        } else if (initialTab === "계정관리" || initialTab === "문자전송") {
          setAccounts(await listAdminAccountsApi());
        } else if (initialTab === "기본정보" || initialTab === "약관관리") {
        } else if (initialTab === "쿠폰·적립금") {
          const [accounts, couponRows, templateRows] = await Promise.all([
            listAdminAccountsApi(),
            listCouponsApi(),
            listCouponTemplatesApi(),
          ]);
          setAccounts(accounts);
          setCoupons(couponRows);
          setCouponTemplates(templateRows);
        }
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "관리자 데이터를 불러오지 못했습니다.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void loadAdminData();
  }, [isAuthed]);

  const refreshOrders = useCallback(async () => {
    try {
      const orders = await fetchAdminOrdersApi();
      setOrders(orders);
    } catch {
      // 실시간 갱신 실패는 조용히 무시
    }
  }, []);

  const refreshInquiries = useCallback(async () => {
    try {
      const inquiries = await fetchAdminInquiriesApi();
      setInquiries(inquiries);
    } catch {
      // 실시간 갱신 실패는 조용히 무시
    }
  }, []);

  const refreshReviews = useCallback(async () => {
    try {
      const reviews = await fetchAdminReviewsApi();
      setReviews(reviews);
    } catch {
      // 실시간 갱신 실패는 조용히 무시
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const notifications = await fetchAdminNotificationsApi();
      setNotifications(notifications);
    } catch {
      // 실시간 갱신 실패는 조용히 무시
    }
  }, []);

  useFirestoreTriggers({
    onOrders: isAuthed
      ? async () => {
          await refreshOrders();
          await refreshNotifications();
        }
      : undefined,
    onInquiries: isAuthed
      ? async () => {
          await refreshInquiries();
          await refreshNotifications();
        }
      : undefined,
    onReviews: isAuthed
      ? async () => {
          await refreshReviews();
          await refreshNotifications();
        }
      : undefined,
  });

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError(null);

    try {
      const loginResult = await loginAdminApi(loginUserId.trim(), loginPassword.trim());
      setAdminAccessToken(loginResult.accessToken);
      setIsAuthed(true);
      window.localStorage.setItem("admin-authed", "true");
    } catch {
      setLoginError("아이디 또는 비밀번호를 확인해주세요.");
    }
  }

  function logout() {
    setIsAuthed(false);
    setLoginPassword("");
    clearAdminAccessToken();
    window.localStorage.removeItem("admin-authed");
  }

  async function updateOrderStatus(orderId: number, status: OrderStatus) {
    try {
      await updateOrderStatusApi(orderId, status);
      setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status } : order)));
    } catch {
      setError("주문 상태 변경에 실패했습니다.");
    }
  }

  async function createOrder(payload: AdminOrderCreatePayload) {
    setError(null);
    setNotice(null);
    try {
      const created = await createBackofficeOrderApi(payload);
      setOrders((prev) => [created, ...prev]);
      setNotice("주문을 등록했습니다.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "주문 등록에 실패했습니다.");
      throw createError;
    }
  }

  async function updateOrder(orderId: number, payload: AdminOrderUpdatePayload) {
    setError(null);
    setNotice(null);
    try {
      const updated = await updateBackofficeOrderApi(orderId, payload);
      setOrders((prev) => prev.map((order) => (order.id === orderId ? updated : order)));
      setNotice("주문을 수정했습니다.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "주문 수정에 실패했습니다.");
      throw updateError;
    }
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return createProduct({
      name: newName,
      description: newDescription,
      price: Number(newPrice),
      stock: Number(newStock),
      totalQuantity: Number(newTotalQuantity),
      imageUrl: newImageUrl,
      badge: newBadge,
      active: newProductPublic,
    });
  }

  async function createProduct(payload: {
    name: string;
    description: string;
    price: number;
    stock: number;
    totalQuantity: number;
    imageUrl: string;
    badge: string;
    active: boolean;
  }) {
    setError(null);
    setNotice(null);

    try {
      const created = await createProductApi(payload);
      setProducts((prev) => [created, ...prev]);
      setNewName("");
      setNewDescription("");
      setNewPrice("9900");
      setNewStock("20");
      setNewTotalQuantity("20");
      setNewImageUrl("");
      setNewBadge("NEW");
      setNewProductPublic(true);
      setNotice("상품을 등록했습니다.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "상품 등록에 실패했습니다.");
      throw createError;
    }
  }

  async function updateProduct(
    id: number,
    payload: {
      name: string;
      description: string;
      price: number;
      stock: number;
      totalQuantity: number;
      imageUrl: string;
      badge: string;
      active: boolean;
    },
  ) {
    setError(null);
    setNotice(null);
    try {
      const updated = await updateProductApi(id, payload);
      setProducts((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setNotice("상품을 수정했습니다.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "상품 수정에 실패했습니다.");
      throw updateError;
    }
  }

  async function deleteProduct(id: number) {
    setError(null);
    setNotice(null);
    try {
      await deleteProductApi(id);
      setProducts((prev) => prev.filter((item) => item.id !== id));
      setNotice("상품을 삭제했습니다.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "상품 삭제에 실패했습니다.");
      throw deleteError;
    }
  }

  async function saveConfig(
    event: FormEvent<HTMLFormElement>,
    overrides?: Partial<
      Pick<
        StoreConfig,
        | "videoUrl"
        | "termsUrl"
        | "privacyUrl"
        | "businessStatus"
        | "businessStatusOpenText"
        | "businessStatusStandbyText"
        | "businessStatusClosedText"
      >
    >,
  ): Promise<boolean> {
    event.preventDefault();

    return saveConfigDirect(overrides);
  }

  async function saveConfigDirect(
    overrides?: Partial<
      Pick<
        StoreConfig,
        | "videoUrl"
        | "termsUrl"
        | "privacyUrl"
        | "businessStatus"
        | "businessStatusOpenText"
        | "businessStatusStandbyText"
        | "businessStatusClosedText"
      >
    >,
  ): Promise<boolean> {

    if (!config) {
      return false;
    }

    try {
      const saved = await saveConfigApi({
        ...config,
        shopName,
        sellerName,
        sellerPhone,
        trusteeBusinessName,
        trusteeBusinessNumber,
        trusteeRepresentative,
        trusteePhone,
        origin,
        bankName,
        accountNumber,
        accountHolder,
        transferNote,
        detailDescription,
        videoUrl: overrides?.videoUrl ?? videoUrl,
        termsUrl: overrides?.termsUrl ?? termsUrl,
        privacyUrl: overrides?.privacyUrl ?? privacyUrl,
        businessStatus: overrides?.businessStatus ?? config.businessStatus,
        businessStatusOpenText:
          overrides?.businessStatusOpenText ?? config.businessStatusOpenText,
        businessStatusStandbyText:
          overrides?.businessStatusStandbyText ?? config.businessStatusStandbyText,
        businessStatusClosedText:
          overrides?.businessStatusClosedText ?? config.businessStatusClosedText,
        paymentDueDays: Math.max(0, Math.floor(Number(paymentDueDays) || 0)),
        deliveryFee: Math.max(0, Math.floor(Number(deliveryFee) || 0)),
        chargeDeliveryFee,
        memberBonusProductId,
        mileageEarnRate: Math.max(0, Math.floor(Number(mileageEarnRate) || 0)),
      });

      setConfig(saved);
      setTermsUrl(saved.termsUrl ?? "");
      setPrivacyUrl(saved.privacyUrl ?? "");
      setPaymentDueDays(String(saved.paymentDueDays ?? 0));
      setDeliveryFee(String(saved.deliveryFee ?? 0));
      setChargeDeliveryFee(Boolean(saved.chargeDeliveryFee));
      setMemberBonusProductId(saved.memberBonusProductId ?? null);
      setMileageEarnRate(String(saved.mileageEarnRate ?? 0));
      setNotice("기본정보를 저장했습니다.");
      setConfigSaved(true);
      return true;
    } catch {
      setError("기본정보 저장에 실패했습니다.");
      return false;
    }
  }

  async function createAccount(payload: AdminUserCreatePayload) {
    setError(null);
    setNotice(null);
    try {
      const created = await createAdminAccountApi(payload);
      setAccounts((prev) => [created, ...prev]);
      setNotice("계정을 생성했습니다.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "계정 생성에 실패했습니다.");
      throw createError;
    }
  }

  async function updateAccount(id: number, payload: AdminUserUpdatePayload) {
    setError(null);
    setNotice(null);
    try {
      const updated = await updateAdminAccountApi(id, payload);
      setAccounts((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setNotice("계정을 수정했습니다.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "계정 수정에 실패했습니다.");
      throw updateError;
    }
  }

  async function deleteAccount(id: number) {
    setError(null);
    setNotice(null);
    try {
      await deleteAdminAccountApi(id);
      setAccounts((prev) => prev.filter((item) => item.id !== id));
      setNotice("계정을 삭제했습니다.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "계정 삭제에 실패했습니다.");
      throw deleteError;
    }
  }

  async function createCouponTemplate(
    input: CreateCouponTemplateInput,
  ): Promise<boolean> {
    setError(null);
    setNotice(null);
    try {
      const created = await createCouponTemplateApi(input);
      setCouponTemplates((prev) => [created, ...prev]);
      setNotice("쿠폰을 생성했습니다.");
      return true;
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "쿠폰 생성에 실패했습니다.");
      return false;
    }
  }

  async function issueCouponByTemplate(
    input: IssueCouponByTemplateInput,
  ): Promise<boolean> {
    setError(null);
    setNotice(null);
    try {
      const result = await issueCouponByTemplateApi(input);
      setCoupons(await listCouponsApi());
      setNotice(`쿠폰 ${result.issued}건을 발급했습니다.`);
      return true;
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : "쿠폰 발급에 실패했습니다.");
      return false;
    }
  }

  async function issueCoupon(input: IssueCouponInput): Promise<boolean> {
    setError(null);
    setNotice(null);
    try {
      const result = await issueCouponApi(input);
      setCoupons(await listCouponsApi());
      setNotice(`쿠폰 ${result.issued}건을 지급했습니다.`);
      return true;
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : "쿠폰 지급에 실패했습니다.");
      return false;
    }
  }

  async function revokeCoupon(id: number) {
    setError(null);
    setNotice(null);
    try {
      await revokeCouponApi(id);
      setCoupons((prev) =>
        prev.map((coupon) =>
          coupon.id === id ? { ...coupon, status: "revoked" } : coupon,
        ),
      );
      setNotice("쿠폰을 회수했습니다.");
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "쿠폰 회수에 실패했습니다.");
      throw revokeError;
    }
  }

  async function getAccountMileage(
    accountId: number,
  ): Promise<MileageSummary | null> {
    setError(null);
    try {
      return await getAccountMileageApi(accountId);
    } catch (mileageError) {
      setError(
        mileageError instanceof Error
          ? mileageError.message
          : "적립금 정보를 불러오지 못했습니다.",
      );
      return null;
    }
  }

  return {
    isAuthed,
    loginUserId,
    loginPassword,
    loginError,
    activeTab,
    config,
    products,
    accounts,
    orders,
    inquiries,
    reviews,
    notifications,
    readAlertIds,
    loading,
    error,
    notice,
    newName,
    newDescription,
    newPrice,
    newStock,
    newTotalQuantity,
    newImageUrl,
    newBadge,
    newProductPublic,
    shopName,
    sellerName,
    sellerPhone,
    trusteeBusinessName,
    trusteeBusinessNumber,
    trusteeRepresentative,
    trusteePhone,
    origin,
    bankName,
    accountNumber,
    accountHolder,
    transferNote,
    detailDescription,
    videoUrl,
    termsUrl,
    privacyUrl,
    paymentDueDays,
    deliveryFee,
    chargeDeliveryFee,
    memberBonusProductId,
    mileageEarnRate,
    configSaved,
    coupons,
    couponTemplates,
    setMileageEarnRate,
    createCouponTemplate,
    issueCouponByTemplate,
    issueCoupon,
    revokeCoupon,
    getAccountMileage,
    setLoginUserId,
    setLoginPassword,
    setActiveTab,
    setNewName,
    setNewDescription,
    setNewPrice,
    setNewStock,
    setNewTotalQuantity,
    setNewImageUrl,
    setNewBadge,
    setNewProductPublic,
    setShopName,
    setSellerName,
    setSellerPhone,
    setTrusteeBusinessName,
    setTrusteeBusinessNumber,
    setTrusteeRepresentative,
    setTrusteePhone,
    setOrigin,
    setBankName,
    setAccountNumber,
    setAccountHolder,
    setTransferNote,
    setDetailDescription,
    setVideoUrl,
    setTermsUrl,
    setPrivacyUrl,
    setPaymentDueDays,
    setDeliveryFee,
    setChargeDeliveryFee,
    setMemberBonusProductId,
    setConfigSaved,
    submitLogin,
    logout,
    updateOrderStatus,
    createOrder,
    updateOrder,
    submitProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    saveConfig,
    saveConfigDirect,
    createAccount,
    updateAccount,
    deleteAccount,
  };
}
