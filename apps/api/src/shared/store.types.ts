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
  id: string;
  customerName: string;
  purchaseType: 'member' | 'guest';
  phone: string;
  shippingAddress: string;
  requestNote?: string | null;
  cancelReason?: string | null;
  depositorName: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
};

export type CreateOrderInput = {
  customerName: string;
  phone: string;
  shippingAddress: string;
  requestNote?: string;
  depositorName: string;
  purchaseType?: 'member' | 'guest';
  lookupToken?: string;
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

export type StoreRecipe = {
  title: string;
  ingredients: string[];
  steps: string[];
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
  recipes: StoreRecipe[];
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
