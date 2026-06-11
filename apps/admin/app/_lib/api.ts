import { API_BASE } from "./constants";
import {
  AdminUser,
  AdminUserCreatePayload,
  AdminUserUpdatePayload,
  Dashboard,
  Inquiry,
  Order,
  OrderStatus,
  Product,
  Review,
  StoreConfig,
} from "./types";

type ApiErrorBody = {
  message?: string;
};

async function parseJsonOrThrow<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.message ?? fallbackMessage);
  }

  return (await response.json()) as T;
}

export async function loginAdminApi(userId: string, password: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, password }),
  });

  if (!response.ok) {
    throw new Error("아이디 또는 비밀번호를 확인해주세요.");
  }
}

export async function loadAdminInitialDataApi(): Promise<{
  dashboard: Dashboard;
  config: StoreConfig;
  products: Product[];
  orders: Order[];
  inquiries: Inquiry[];
  reviews: Review[];
  accounts: AdminUser[];
}> {
  const [dashRes, configRes, productsRes, ordersRes, inquiriesRes, reviewsRes, accountsRes] = await Promise.all([
    fetch(`${API_BASE}/api/admin/dashboard`, { cache: "no-store" }),
    fetch(`${API_BASE}/api/admin/config`, { cache: "no-store" }),
    fetch(`${API_BASE}/api/admin/products`, { cache: "no-store" }),
    fetch(`${API_BASE}/api/admin/orders`, { cache: "no-store" }),
    fetch(`${API_BASE}/api/admin/inquiries`, { cache: "no-store" }),
    fetch(`${API_BASE}/api/admin/reviews`, { cache: "no-store" }),
    fetch(`${API_BASE}/api/admin/accounts`, { cache: "no-store" }),
  ]);

  if (
    !dashRes.ok ||
    !configRes.ok ||
    !productsRes.ok ||
    !ordersRes.ok ||
    !inquiriesRes.ok ||
    !reviewsRes.ok ||
    !accountsRes.ok
  ) {
    throw new Error("관리자 인증에 실패했거나 데이터를 불러오지 못했습니다.");
  }

  const [dashboard, config, products, orders, inquiries, reviews, accounts] = await Promise.all([
    dashRes.json() as Promise<Dashboard>,
    configRes.json() as Promise<StoreConfig>,
    productsRes.json() as Promise<Product[]>,
    ordersRes.json() as Promise<Order[]>,
    inquiriesRes.json() as Promise<Inquiry[]>,
    reviewsRes.json() as Promise<Review[]>,
    accountsRes.json() as Promise<AdminUser[]>,
  ]);

  return {
    dashboard,
    config,
    products,
    orders,
    inquiries,
    reviews,
    accounts,
  };
}

export async function updateOrderStatusApi(orderId: string, status: OrderStatus): Promise<void> {
  const response = await fetch(`${API_BASE}/api/admin/orders/${orderId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  await parseJsonOrThrow<{ ok: boolean }>(response, "주문 상태 변경에 실패했습니다.");
}

export async function createProductApi(payload: {
  name: string;
  description: string;
  price: number;
  stock: number;
  totalQuantity: number;
  imageUrl: string;
  badge: string;
  active: boolean;
}): Promise<Product> {
  const response = await fetch(`${API_BASE}/api/admin/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonOrThrow<Product>(response, "상품 등록에 실패했습니다.");
}

export type ProductPayload = {
  name: string;
  description: string;
  price: number;
  stock: number;
  totalQuantity: number;
  imageUrl: string;
  badge: string;
  active: boolean;
};

export async function updateProductApi(id: number, payload: ProductPayload): Promise<Product> {
  const response = await fetch(`${API_BASE}/api/admin/products/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonOrThrow<Product>(response, "상품 수정에 실패했습니다.");
}

export async function deleteProductApi(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/api/admin/products/${id}`, {
    method: "DELETE",
  });

  await parseJsonOrThrow<{ ok: boolean }>(response, "상품 삭제에 실패했습니다.");
}

export async function saveConfigApi(config: StoreConfig): Promise<StoreConfig> {
  const response = await fetch(`${API_BASE}/api/admin/config`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  });

  return parseJsonOrThrow<StoreConfig>(response, "기본정보 저장에 실패했습니다.");
}

export async function createAdminAccountApi(
  payload: AdminUserCreatePayload,
): Promise<AdminUser> {
  const response = await fetch(`${API_BASE}/api/admin/accounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonOrThrow<AdminUser>(response, "계정 생성에 실패했습니다.");
}

export async function updateAdminAccountApi(
  id: number,
  payload: AdminUserUpdatePayload,
): Promise<AdminUser> {
  const response = await fetch(`${API_BASE}/api/admin/accounts/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonOrThrow<AdminUser>(response, "계정 수정에 실패했습니다.");
}

export async function deleteAdminAccountApi(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/api/admin/accounts/${id}`, {
    method: "DELETE",
  });

  await parseJsonOrThrow<{ ok: boolean }>(response, "계정 삭제에 실패했습니다.");
}

export type AdminShippingAddress = {
  id: number;
  name: string;
  address1: string;
  address2: string;
  isDefault: boolean;
};

export async function getAdminAccountShippingAddressesApi(
  accountId: number,
): Promise<AdminShippingAddress[]> {
  const response = await fetch(`${API_BASE}/api/admin/accounts/${accountId}/shipping-addresses`, {
    cache: "no-store",
  });
  const data = await parseJsonOrThrow<{ shippingAddresses: AdminShippingAddress[] }>(
    response,
    "배송지 목록을 불러오지 못했습니다.",
  );
  return data.shippingAddresses;
}

export async function checkAdminUserIdApi(
  userId: string,
): Promise<{ available: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/api/auth/check-user-id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  return parseJsonOrThrow<{ available: boolean; message: string }>(response, "아이디 중복확인에 실패했습니다.");
}

export async function checkAdminPhoneApi(
  phone: string,
): Promise<{ available: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/api/auth/check-phone`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  return parseJsonOrThrow<{ available: boolean; message: string }>(response, "전화번호 중복확인에 실패했습니다.");
}
