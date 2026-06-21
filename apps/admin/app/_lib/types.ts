import type {
  AdminUserCreateInput,
  AdminUserUpdateInput,
  SharedUser,
  UserStatus,
  UserType,
} from "@repo/shared-types/user";
import type { OrderStatus } from "@repo/shared-types/order";
import type { Notice } from "@repo/shared-types/notice";
import type {
  Coupon,
  CouponDiscountType,
  CouponTemplate,
  CreateCouponTemplateInput,
  IssueCouponByTemplateInput,
  IssueCouponInput,
} from "@repo/shared-types/coupon";
import type { MileageTransaction, MileageSummary } from "@repo/shared-types/mileage";

export type { OrderStatus };
export type { Notice };
export type {
  Coupon,
  CouponDiscountType,
  CouponTemplate,
  CreateCouponTemplateInput,
  IssueCouponByTemplateInput,
  IssueCouponInput,
};
export type { MileageTransaction, MileageSummary };

export type AdminUser = SharedUser;
export type AdminUserCreatePayload = AdminUserCreateInput;
export type AdminUserUpdatePayload = AdminUserUpdateInput;
export type AdminUserType = UserType;
export type AdminUserStatus = UserStatus;

export type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  totalQuantity: number;
  imageUrl: string;
  badge: string;
  active: boolean;
};

export type Order = {
  id: number;
  accountId: number | null;
  customerName: string;
  purchaseType: "member" | "guest";
  phone: string;
  shippingAddress: string;
  requestNote?: string | null;
  cancelReason?: string | null;
  depositorName: string;
  status: OrderStatus;
  deliveryFee: number;
  couponId?: number | null;
  couponDiscount: number;
  mileageUsed: number;
  mileageEarned: number;
  totalAmount: number;
  createdAt: string;
  paymentDueAt: string | null;
  statusHistory: Array<{ status: OrderStatus; at: string }>;
  items: Array<{
    productId: number;
    name: string;
    unitPrice: number;
    quantity: number;
    subtotal: number;
  }>;
};

export type AdminOrderCreatePayload = {
  customerName: string;
  phone: string;
  shippingAddress: string;
  requestNote?: string;
  depositorName: string;
  purchaseType: "member" | "guest";
  accountId?: number | null;
  items: Array<{
    productId: number;
    quantity: number;
  }>;
};

export type AdminOrderUpdatePayload = {
  customerName?: string;
  phone?: string;
  shippingAddress?: string;
  requestNote?: string;
  depositorName?: string;
  cancelReason?: string | null;
};

export type Inquiry = {
  id: string;
  name: string;
  phone: string;
  title: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  comments: InquiryComment[];
};

export type InquiryComment = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
};

export type ReviewComment = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
};

export type Review = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  comments: ReviewComment[];
};

export type AdminNotificationType =
  | "order"
  | "review"
  | "inquiry"
  | "review-comment"
  | "inquiry-comment";

export type AdminNotification = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  type: AdminNotificationType;
  isRead: boolean;
  url: string;
};

export type AdminSmsHistoryStatus = "success" | "failed" | "cancelled";

export type AdminSmsHistoryItem = {
  id: number;
  createdAt: string;
  corpNum: string;
  sender: string;
  senderName: string | null;
  userID: string | null;
  receiver: string;
  receiverName: string | null;
  content: string;
  reserveDT: string | null;
  adsYN: boolean;
  receiptNum: string | null;
  status: AdminSmsHistoryStatus;
  errorMessage: string | null;
};

export type AdminSmsHistoryPage = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: AdminSmsHistoryItem[];
};

export type StoreRecipeStep = {
  description: string;
  imageUrl: string;
};

export type StoreRecipe = {
  title: string;
  ingredients: string[];
  steps: StoreRecipeStep[];
};

export type StoreConfig = {
  shopName: string;
  sellerName: string;
  sellerPhone: string;
  trusteeBusinessName: string;
  trusteeBusinessNumber: string;
  trusteeRepresentative: string;
  trusteePhone: string;
  origin: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  transferNote: string;
  detailDescription: string;
  storyImages: Array<{ title: string; imageUrl: string }>;
  videoUrl: string;
  termsUrl: string;
  privacyUrl: string;
  termsVersion: string;
  termsUpdatedAt: string | null;
  termsHistory: Array<{
    documentType: "terms" | "privacy";
    documentUrl: string;
    termsVersion: string;
    termsUpdatedAt: string;
  }>;
  recipes: StoreRecipe[];
  paymentDueDays: number;
  deliveryFee: number;
  chargeDeliveryFee: boolean;
  memberBonusProductId: number | null;
  // 응답 전용 파생 값 (저장 시에는 무시됨)
  memberBonusProductName?: string | null;
  mileageEarnRate: number;
  businessStatus: "open" | "standby" | "closed";
  businessStatusOpenText: string;
  businessStatusStandbyText: string;
  businessStatusClosedText: string;
};

export type AdminTab =
  | "주문내역"
  | "문자전송"
  | "공지사항"
  | "매출 상세"
  | "기본정보"
  | "레시피관리"
  | "약관관리"
  | "상품관리"
  | "문의내역"
  | "후기"
  | "계정관리"
  | "쿠폰·적립금";
