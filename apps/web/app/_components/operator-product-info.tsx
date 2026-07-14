import { formatPhone } from "../_lib/format";

const SERVICE_OPERATOR = {
  businessName: "에이비에이테크(ABA TECH)",
  representative: "김기훈",
  businessNumber: "179-73-00483",
  phone: "010-5405-5939",
} as const;

type OperatorProductInfoProps = {
  producerName: string;
  producerPhone: string;
  origin: string;
};

export function OperatorProductInfo({ producerName, producerPhone, origin }: OperatorProductInfoProps) {
  return (
    <div className="space-y-1 text-sm text-stone-900">
      <p className="pt-2 text-[11px] font-bold uppercase tracking-[0.12em]">서비스 운영자 정보</p>
      <p>상호: {SERVICE_OPERATOR.businessName}</p>
      <p>대표: {SERVICE_OPERATOR.representative}</p>
      <p>사업자등록번호: {SERVICE_OPERATOR.businessNumber}</p>
      <p>연락처: {SERVICE_OPERATOR.phone}</p>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em]">상품 정보</p>
      <p>생산자: {producerName || "-"}</p>
      <p>연락처: {producerPhone ? formatPhone(producerPhone) : "-"}</p>
      <p>원산지: {origin || "-"}</p>
    </div>
  );
}