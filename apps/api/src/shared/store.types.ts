import type { OrderStatus } from '@repo/shared-types/order';
import type {
  Notice as SharedNotice,
  CreateNoticeInput as SharedCreateNoticeInput,
  UpdateNoticeInput as SharedUpdateNoticeInput,
} from '@repo/shared-types/notice';

export type { OrderStatus };

export type Notice = SharedNotice;
export type CreateNoticeInput = SharedCreateNoticeInput;
export type UpdateNoticeInput = SharedUpdateNoticeInput;

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

export type OrderItem = {
  productId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
};

export type Order = {
  id: number;
  accountId: number | null;
  customerName: string;
  purchaseType: 'member' | 'guest';
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
  statusHistory: OrderStatusHistoryEntry[];
  items: OrderItem[];
};

export type OrderStatusHistoryEntry = {
  status: OrderStatus;
  at: string;
};

export type CreateOrderInput = {
  accountId?: number | null;
  customerName: string;
  phone: string;
  shippingAddress: string;
  requestNote?: string;
  depositorName: string;
  purchaseType?: 'member' | 'guest';
  lookupToken?: string;
  // 관리자 직접 등록처럼 휴대폰 인증 없이 비회원 주문을 생성할 때 사용합니다.
  skipGuestVerification?: boolean;
  // 회원 전용: 사용할 쿠폰 id / 사용할 적립금(원)
  couponId?: number | null;
  mileageToUse?: number;
  items: Array<{
    productId: number;
    quantity: number;
  }>;
};

export type CreateProductInput = {
  name: string;
  description: string;
  price: number;
  stock: number;
  totalQuantity: number;
  imageUrl: string;
  badge: string;
  active?: boolean;
};

export type UpdateProductInput = Partial<CreateProductInput>;

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

export type CreateInquiryInput = {
  name: string;
  phone: string;
  title: string;
  message: string;
};

export type InquiryComment = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
};

export type CreateInquiryCommentInput = {
  inquiryId: string;
  name: string;
  content: string;
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

export type CreateReviewInput = {
  name: string;
  content: string;
};

export type CreateReviewCommentInput = {
  reviewId: string;
  name: string;
  content: string;
};

export type AdminNotificationType =
  | 'order'
  | 'review'
  | 'inquiry'
  | 'review-comment'
  | 'inquiry-comment';

export type AdminNotification = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  type: AdminNotificationType;
  isRead: boolean;
  url: string;
};

export type StoreStoryImage = {
  title: string;
  imageUrl: string;
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

export type StoreTermsHistoryItem = {
  termsUrl: string;
  termsVersion: string;
  termsUpdatedAt: string;
};

export type StoreConfig = {
  shopName: string;
  sellerName: string;
  sellerPhone: string;
  origin: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  transferNote: string;
  detailDescription: string;
  storyImages: StoreStoryImage[];
  videoUrl: string;
  termsUrl: string;
  termsVersion: string;
  termsUpdatedAt: string | null;
  termsHistory: StoreTermsHistoryItem[];
  recipes: StoreRecipe[];
  // 주문 후 입금 기한(일). 0 이하이면 기한 없음(자동 취소 안 함).
  paymentDueDays: number;
  // 배송료 금액 및 청구 여부
  deliveryFee: number;
  chargeDeliveryFee: boolean;
  // 회원 주문 시 무료로 포함할 사은품 상품 ID (없으면 null)
  memberBonusProductId: number | null;
  // 사은품 상품명 (응답 전용 파생 값, 저장하지 않음). 사은품이 없으면 null
  memberBonusProductName: string | null;
  // 마일리지 적립률(%). 0이면 자동 적립 안 함
  mileageEarnRate: number;
};

export type RequestPhoneVerificationInput = {
  phone: string;
  purpose?: 'signup' | 'recover';
};

export type VerifyPhoneCodeInput = {
  phone: string;
  code: string;
};

export type CreateLocalAccountInput = {
  userId: string;
  password: string;
  name: string;
  phone: string;
  address1: string;
  address2: string;
  termsAgreed: boolean;
  verificationToken: string;
};

export type LocalAccountProfile = {
  id: number;
  userId: string;
  name: string;
  phone: string;
  address1: string;
  address2: string;
  createdAt: string;
};
