import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  fetchAdminNotificationsApi,
  createAdminAccountApi,
  createBackofficeOrderApi,
  createProductApi,
  deleteAdminAccountApi,
  deleteProductApi,
  fetchAdminInquiriesApi,
  fetchAdminOrdersApi,
  fetchAdminReviewsApi,
  loadAdminInitialDataApi,
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
  origin: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  transferNote: string;
  detailDescription: string;
  videoUrl: string;
  termsUrl: string;
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
  setOrigin: (value: string) => void;
  setBankName: (value: string) => void;
  setAccountNumber: (value: string) => void;
  setAccountHolder: (value: string) => void;
  setTransferNote: (value: string) => void;
  setDetailDescription: (value: string) => void;
  setVideoUrl: (value: string) => void;
  setTermsUrl: (value: string) => void;
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
    overrides?: Partial<Pick<StoreConfig, "videoUrl" | "termsUrl">>,
  ) => Promise<boolean>;
  saveConfigDirect: (
    overrides?: Partial<Pick<StoreConfig, "videoUrl" | "termsUrl">>,
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
  const [origin, setOrigin] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [detailDescription, setDetailDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [termsUrl, setTermsUrl] = useState("");
  const [paymentDueDays, setPaymentDueDays] = useState("0");
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [chargeDeliveryFee, setChargeDeliveryFee] = useState(false);
  const [memberBonusProductId, setMemberBonusProductId] = useState<number | null>(null);
  const [mileageEarnRate, setMileageEarnRate] = useState("0");
  const [configSaved, setConfigSaved] = useState(false);

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponTemplates, setCouponTemplates] = useState<CouponTemplate[]>([]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const saved = window.localStorage.getItem("admin-authed");
    if (saved === "true") {
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
        const [data, notifications] = await Promise.all([
          loadAdminInitialDataApi(),
          fetchAdminNotificationsApi(),
        ]);
        setConfig(data.config);
        setProducts(data.products);
        setAccounts(data.accounts);
        setOrders(data.orders);
        setInquiries(data.inquiries);
        setReviews(data.reviews);
        setNotifications(notifications);

        setShopName(data.config.shopName ?? "");
        setSellerName(data.config.sellerName ?? "");
        setSellerPhone(data.config.sellerPhone ?? "");
        setOrigin(data.config.origin ?? "");
        setBankName(data.config.bankName ?? "");
        setAccountNumber(data.config.accountNumber ?? "");
        setAccountHolder(data.config.accountHolder ?? "");
        setTransferNote(data.config.transferNote ?? "");
        setDetailDescription(data.config.detailDescription ?? "");
        setVideoUrl(data.config.videoUrl ?? "");
        setTermsUrl(data.config.termsUrl ?? "");
        setPaymentDueDays(String(data.config.paymentDueDays ?? 0));
        setDeliveryFee(String(data.config.deliveryFee ?? 0));
        setChargeDeliveryFee(Boolean(data.config.chargeDeliveryFee));
        setMemberBonusProductId(data.config.memberBonusProductId ?? null);
        setMileageEarnRate(String(data.config.mileageEarnRate ?? 0));

        try {
          const [couponRows, templateRows] = await Promise.all([
            listCouponsApi(),
            listCouponTemplatesApi(),
          ]);
          setCoupons(couponRows);
          setCouponTemplates(templateRows);
        } catch {
          // 쿠폰 목록 로드 실패는 조용히 무시
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
      await loginAdminApi(loginUserId.trim(), loginPassword.trim());
      setIsAuthed(true);
      window.localStorage.setItem("admin-authed", "true");
    } catch {
      setLoginError("아이디 또는 비밀번호를 확인해주세요.");
    }
  }

  function logout() {
    setIsAuthed(false);
    setLoginPassword("");
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
    overrides?: Partial<Pick<StoreConfig, "videoUrl" | "termsUrl">>,
  ): Promise<boolean> {
    event.preventDefault();

    return saveConfigDirect(overrides);
  }

  async function saveConfigDirect(
    overrides?: Partial<Pick<StoreConfig, "videoUrl" | "termsUrl">>,
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
        origin,
        bankName,
        accountNumber,
        accountHolder,
        transferNote,
        detailDescription,
        videoUrl: overrides?.videoUrl ?? videoUrl,
        termsUrl: overrides?.termsUrl ?? termsUrl,
        paymentDueDays: Math.max(0, Math.floor(Number(paymentDueDays) || 0)),
        deliveryFee: Math.max(0, Math.floor(Number(deliveryFee) || 0)),
        chargeDeliveryFee,
        memberBonusProductId,
        mileageEarnRate: Math.max(0, Math.floor(Number(mileageEarnRate) || 0)),
      });

      setConfig(saved);
      setTermsUrl(saved.termsUrl ?? "");
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
    origin,
    bankName,
    accountNumber,
    accountHolder,
    transferNote,
    detailDescription,
    videoUrl,
    termsUrl,
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
    setOrigin,
    setBankName,
    setAccountNumber,
    setAccountHolder,
    setTransferNote,
    setDetailDescription,
    setVideoUrl,
    setTermsUrl,
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
