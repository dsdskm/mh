import type {
  AdminUserCreateInput,
  AdminUserUpdateInput,
  SharedUser,
  UserStatus,
  UserType,
} from "@repo/shared-types/user";
import type { OrderStatus } from "@repo/shared-types/order";

export type { OrderStatus };

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
  id: string;
  customerName: string;
  purchaseType: "member" | "guest";
  phone: string;
  shippingAddress: string;
  requestNote?: string | null;
  cancelReason?: string | null;
  depositorName: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  items: Array<{
    productId: number;
    name: string;
    unitPrice: number;
    quantity: number;
    subtotal: number;
  }>;
};

export type Dashboard = {
  totalProducts: number;
  totalOrders: number;
  totalSales: number;
  receivedOrders: number;
  paidOrders: number;
  preparingOrders: number;
};

export type Inquiry = {
  id: string;
  name: string;
  phone: string;
  title: string;
  message: string;
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
  comments: ReviewComment[];
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
  storyImages: Array<{ title: string; imageUrl: string }>;
  videoUrl: string;
  recipes: Array<{ title: string; ingredients: string[]; steps: string[] }>;
};

export type AdminTab =
  | "주문내역"
  | "공지사항"
  | "매출 상세"
  | "기본정보"
  | "상품관리"
  | "문의내역"
  | "후기 목록"
  | "계정관리";
