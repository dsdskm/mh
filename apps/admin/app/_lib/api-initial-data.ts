import { API_BASE } from "./constants";
import {
  AdminUser,
  Inquiry,
  Order,
  Product,
  Review,
  StoreConfig,
} from "./types";

export async function loadAdminInitialDataApi(): Promise<{
  config: StoreConfig;
  products: Product[];
  orders: Order[];
  inquiries: Inquiry[];
  reviews: Review[];
  accounts: AdminUser[];
}> {
  const [configRes, productsRes, ordersRes, inquiriesRes, reviewsRes, accountsRes] = await Promise.all([
    fetch(`${API_BASE}/api/backoffice/config`, { cache: "no-store" }),
    fetch(`${API_BASE}/api/backoffice/products`, { cache: "no-store" }),
    fetch(`${API_BASE}/api/backoffice/orders`, { cache: "no-store" }),
    fetch(`${API_BASE}/api/backoffice/inquiries`, { cache: "no-store" }),
    fetch(`${API_BASE}/api/backoffice/reviews`, { cache: "no-store" }),
    fetch(`${API_BASE}/api/backoffice/accounts`, { cache: "no-store" }),
  ]);

  if (
    !configRes.ok ||
    !productsRes.ok ||
    !ordersRes.ok ||
    !inquiriesRes.ok ||
    !reviewsRes.ok ||
    !accountsRes.ok
  ) {
    throw new Error("관리자 인증에 실패했거나 데이터를 불러오지 못했습니다.");
  }

  const [config, products, orders, inquiries, reviews, accounts] = await Promise.all([
    configRes.json() as Promise<StoreConfig>,
    productsRes.json() as Promise<Product[]>,
    ordersRes.json() as Promise<Order[]>,
    inquiriesRes.json() as Promise<Inquiry[]>,
    reviewsRes.json() as Promise<Review[]>,
    accountsRes.json() as Promise<AdminUser[]>,
  ]);

  const normalizedInquiries = inquiries.map((inquiry) => ({
    ...inquiry,
    comments: Array.isArray((inquiry as { comments?: unknown }).comments)
      ? inquiry.comments
      : [],
  }));

  const normalizedReviews = reviews.map((review) => ({
    ...review,
    comments: Array.isArray((review as { comments?: unknown }).comments)
      ? review.comments
      : [],
  }));

  return {
    config,
    products,
    orders,
    inquiries: normalizedInquiries,
    reviews: normalizedReviews,
    accounts,
  };
}

export async function fetchAdminOrdersApi(): Promise<Order[]> {
  const res = await fetch(`${API_BASE}/api/backoffice/orders`, { cache: "no-store" });
  if (!res.ok) throw new Error("주문 데이터를 불러오지 못했습니다.");
  return res.json() as Promise<Order[]>;
}

export async function fetchAdminInquiriesApi(): Promise<Inquiry[]> {
  const res = await fetch(`${API_BASE}/api/backoffice/inquiries`, { cache: "no-store" });
  if (!res.ok) throw new Error("문의 데이터를 불러오지 못했습니다.");
  const inquiries = await res.json() as Inquiry[];
  return inquiries.map((inquiry) => ({
    ...inquiry,
    comments: Array.isArray((inquiry as { comments?: unknown }).comments)
      ? inquiry.comments
      : [],
  }));
}

export async function fetchAdminReviewsApi(): Promise<Review[]> {
  const res = await fetch(`${API_BASE}/api/backoffice/reviews`, { cache: "no-store" });
  if (!res.ok) throw new Error("후기 데이터를 불러오지 못했습니다.");
  const reviews = await res.json() as Review[];
  return reviews.map((review) => ({
    ...review,
    comments: Array.isArray((review as { comments?: unknown }).comments)
      ? review.comments
      : [],
  }));
}