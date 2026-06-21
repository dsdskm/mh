import { API_BASE } from "./constants";
import { adminFetch, parseJsonOrThrow } from "./api-common";
import { Product } from "./types";

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

export async function listProductsApi(): Promise<Product[]> {
  const response = await adminFetch(`${API_BASE}/api/backoffice/products`, {
    cache: "no-store",
  });

  return parseJsonOrThrow<Product[]>(response, "상품 목록을 불러오지 못했습니다.");
}

export async function createProductApi(payload: ProductPayload): Promise<Product> {
  const response = await adminFetch(`${API_BASE}/api/backoffice/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonOrThrow<Product>(response, "상품 등록에 실패했습니다.");
}

export async function updateProductApi(id: number, payload: ProductPayload): Promise<Product> {
  const response = await adminFetch(`${API_BASE}/api/backoffice/products/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonOrThrow<Product>(response, "상품 수정에 실패했습니다.");
}

export async function deleteProductApi(id: number): Promise<void> {
  const response = await adminFetch(`${API_BASE}/api/backoffice/products/${id}`, {
    method: "DELETE",
  });

  await parseJsonOrThrow<{ ok: boolean }>(response, "상품 삭제에 실패했습니다.");
}
