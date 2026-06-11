import { FormEvent, useEffect, useState } from "react";
import {
  createAdminAccountApi,
  createProductApi,
  deleteAdminAccountApi,
  deleteProductApi,
  loadAdminInitialDataApi,
  loginAdminApi,
  saveConfigApi,
  updateAdminAccountApi,
  updateOrderStatusApi,
  updateProductApi,
} from "../_lib/api";
import {
  AdminUser,
  AdminUserCreatePayload,
  AdminUserUpdatePayload,
  AdminTab,
  Dashboard,
  Inquiry,
  Order,
  OrderStatus,
  Product,
  Review,
  StoreConfig,
} from "../_lib/types";

export type AdminPageState = {
  isAuthed: boolean;
  loginUserId: string;
  loginPassword: string;
  loginError: string | null;
  activeTab: AdminTab;
  dashboard: Dashboard | null;
  config: StoreConfig | null;
  products: Product[];
  accounts: AdminUser[];
  orders: Order[];
  inquiries: Inquiry[];
  reviews: Review[];
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
  submitLogin: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  logout: () => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
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
  saveConfig: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  createAccount: (payload: AdminUserCreatePayload) => Promise<void>;
  updateAccount: (id: number, payload: AdminUserUpdatePayload) => Promise<void>;
  deleteAccount: (id: number) => Promise<void>;
};

export function useAdminPage(initialTab: AdminTab): AdminPageState {

  const [isAuthed, setIsAuthed] = useState(false);
  const [loginUserId, setLoginUserId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<AdminUser[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
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
        const data = await loadAdminInitialDataApi();
        setDashboard(data.dashboard);
        setConfig(data.config);
        setProducts(data.products);
        setAccounts(data.accounts);
        setOrders(data.orders);
        setInquiries(data.inquiries);
        setReviews(data.reviews);

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

  async function updateOrderStatus(orderId: string, status: OrderStatus) {
    try {
      await updateOrderStatusApi(orderId, status);
      setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status } : order)));
    } catch {
      setError("주문 상태 변경에 실패했습니다.");
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

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!config) {
      return;
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
        videoUrl,
      });

      setConfig(saved);
      setNotice("기본정보를 저장했습니다.");
    } catch {
      setError("기본정보 저장에 실패했습니다.");
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

  return {
    isAuthed,
    loginUserId,
    loginPassword,
    loginError,
    activeTab,
    dashboard,
    config,
    products,
    accounts,
    orders,
    inquiries,
    reviews,
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
    submitLogin,
    logout,
    updateOrderStatus,
    submitProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    saveConfig,
    createAccount,
    updateAccount,
    deleteAccount,
  };
}
