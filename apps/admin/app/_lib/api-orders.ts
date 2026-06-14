import { API_BASE } from "./constants";
import { parseJsonOrThrow } from "./api-common";
import { AdminOrderCreatePayload, AdminOrderUpdatePayload, Order, OrderStatus } from "./types";

export async function updateOrderStatusApi(orderId: string, status: OrderStatus): Promise<void> {
  const response = await fetch(`${API_BASE}/api/backoffice/orders/${orderId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  await parseJsonOrThrow<{ ok: boolean }>(response, "주문 상태 변경에 실패했습니다.");
}

export async function createBackofficeOrderApi(payload: AdminOrderCreatePayload): Promise<Order> {
  const response = await fetch(`${API_BASE}/api/backoffice/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonOrThrow<Order>(response, "주문 생성에 실패했습니다.");
}

export async function updateBackofficeOrderApi(orderId: string, payload: AdminOrderUpdatePayload): Promise<Order> {
  const response = await fetch(`${API_BASE}/api/backoffice/orders/${orderId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonOrThrow<Order>(response, "주문 수정에 실패했습니다.");
}
