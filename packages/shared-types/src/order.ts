export const ORDER_STATUS = {
  RECEIVED: "received",
  PAID: "paid",
  PREPARING: "preparing",
  SHIPPING: "shipping",
  DELIVERED: "delivered",
  CANCEL_REQUESTED: "cancel_requested",
  CANCEL_COMPLETED: "cancel_completed",
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  ORDER_STATUS.RECEIVED,
  ORDER_STATUS.PAID,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.SHIPPING,
  ORDER_STATUS.DELIVERED,
];

export const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  ...ORDER_STATUS_FLOW,
  ORDER_STATUS.CANCEL_REQUESTED,
  ORDER_STATUS.CANCEL_COMPLETED,
];

export const ORDER_STATUS_LABELS_KO: Record<OrderStatus, string> = {
  [ORDER_STATUS.RECEIVED]: "접수",
  [ORDER_STATUS.PAID]: "입금 확인",
  [ORDER_STATUS.PREPARING]: "상품 준비중",
  [ORDER_STATUS.SHIPPING]: "배송중",
  [ORDER_STATUS.DELIVERED]: "배송완료",
  [ORDER_STATUS.CANCEL_REQUESTED]: "취소 요청",
  [ORDER_STATUS.CANCEL_COMPLETED]: "취소 완료",
};

export function getOrderStatusLabelKo(status: OrderStatus): string {
  return ORDER_STATUS_LABELS_KO[status] ?? status;
}
