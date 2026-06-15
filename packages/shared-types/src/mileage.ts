export type MileageTxType =
  | "earn" // 주문 완료 자동 적립
  | "use" // 주문 결제 시 사용
  | "admin_grant" // 관리자 수동 지급
  | "admin_deduct" // 관리자 수동 차감
  | "restore"; // 주문 취소에 따른 복원/회수

export type MileageTransaction = {
  id: number;
  accountId: number;
  // 부호 있는 변동량 (+적립/지급/복원, -사용/차감/회수)
  amount: number;
  type: MileageTxType;
  orderId: number | null;
  reason: string | null;
  balanceAfter: number;
  createdAt: string;
};

export type MileageSummary = {
  accountId: number;
  balance: number;
  transactions: MileageTransaction[];
};
