import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  API_BASE,
  parseTabFromQueryKey,
  TAB_QUERY_KEY_BY_LABEL,
} from "../_lib/constants";
import {
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
  newImageUrl: string;
  newBadge: string;
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
  setNewImageUrl: (value: string) => void;
  setNewBadge: (value: string) => void;
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
  saveConfig: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function useAdminPage(): AdminPageState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isAuthed, setIsAuthed] = useState(false);
  const [loginUserId, setLoginUserId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("대시보드");

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
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
  const [newImageUrl, setNewImageUrl] = useState(
    "https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=1200&q=80",
  );
  const [newBadge, setNewBadge] = useState("NEW");

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
    const parsedTab = parseTabFromQueryKey(searchParams.get("tab"));
    if (parsedTab) {
      setActiveTab(parsedTab);
      return;
    }

    setActiveTab("대시보드");
  }, [searchParams]);

  useEffect(() => {
    const saved = window.localStorage.getItem("admin-authed");
    if (saved === "true") {
      setIsAuthed(true);
    }
  }, []);

  function setActiveTabWithRoute(tab: AdminTab) {
    setActiveTab(tab);

    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", TAB_QUERY_KEY_BY_LABEL[tab]);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  useEffect(() => {
    if (!isAuthed) {
      return;
    }

    async function loadAdminData() {
      setLoading(true);
      setError(null);
      try {
        const [dashRes, configRes, productsRes, ordersRes, inquiriesRes, reviewsRes] = await Promise.all([
          fetch(`${API_BASE}/api/admin/dashboard`, { cache: "no-store" }),
          fetch(`${API_BASE}/api/admin/config`, { cache: "no-store" }),
          fetch(`${API_BASE}/api/admin/products`, { cache: "no-store" }),
          fetch(`${API_BASE}/api/admin/orders`, { cache: "no-store" }),
          fetch(`${API_BASE}/api/admin/inquiries`, { cache: "no-store" }),
          fetch(`${API_BASE}/api/admin/reviews`, { cache: "no-store" }),
        ]);

        if (
          !dashRes.ok ||
          !configRes.ok ||
          !productsRes.ok ||
          !ordersRes.ok ||
          !inquiriesRes.ok ||
          !reviewsRes.ok
        ) {
          throw new Error("관리자 인증에 실패했거나 데이터를 불러오지 못했습니다.");
        }

        setDashboard((await dashRes.json()) as Dashboard);
        const configData = (await configRes.json()) as StoreConfig;
        setConfig(configData);
        setProducts((await productsRes.json()) as Product[]);
        setOrders((await ordersRes.json()) as Order[]);
        setInquiries((await inquiriesRes.json()) as Inquiry[]);
        setReviews((await reviewsRes.json()) as Review[]);

        setShopName(configData.shopName ?? "");
        setSellerName(configData.sellerName ?? "");
        setSellerPhone(configData.sellerPhone ?? "");
        setOrigin(configData.origin ?? "");
        setBankName(configData.bankName ?? "");
        setAccountNumber(configData.accountNumber ?? "");
        setAccountHolder(configData.accountHolder ?? "");
        setTransferNote(configData.transferNote ?? "");
        setDetailDescription(configData.detailDescription ?? "");
        setVideoUrl(configData.videoUrl ?? "");
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

    const response = await fetch(`${API_BASE}/api/admin/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: loginUserId.trim(),
        password: loginPassword.trim(),
      }),
    });

    if (!response.ok) {
      setLoginError("아이디 또는 비밀번호를 확인해주세요.");
      return;
    }

    setIsAuthed(true);
    window.localStorage.setItem("admin-authed", "true");
  }

  function logout() {
    setIsAuthed(false);
    setLoginPassword("");
    window.localStorage.removeItem("admin-authed");
  }

  async function updateOrderStatus(orderId: string, status: OrderStatus) {
    const response = await fetch(`${API_BASE}/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      setError("주문 상태 변경에 실패했습니다.");
      return;
    }

    setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status } : order)));
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const response = await fetch(`${API_BASE}/api/admin/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: newName,
        description: newDescription,
        price: Number(newPrice),
        stock: Number(newStock),
        imageUrl: newImageUrl,
        badge: newBadge,
        active: true,
      }),
    });

    if (!response.ok) {
      setError("상품 등록에 실패했습니다.");
      return;
    }

    const created = (await response.json()) as Product;
    setProducts((prev) => [created, ...prev]);
    setNewName("");
    setNewDescription("");
    setNotice("상품을 등록했습니다.");
  }

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!config) {
      return;
    }

    const response = await fetch(`${API_BASE}/api/admin/config`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
      }),
    });

    if (!response.ok) {
      setError("기본정보 저장에 실패했습니다.");
      return;
    }

    const saved = (await response.json()) as StoreConfig;
    setConfig(saved);
    setNotice("기본정보를 저장했습니다.");
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
    newImageUrl,
    newBadge,
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
    setActiveTab: setActiveTabWithRoute,
    setNewName,
    setNewDescription,
    setNewPrice,
    setNewStock,
    setNewImageUrl,
    setNewBadge,
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
    saveConfig,
  };
}
