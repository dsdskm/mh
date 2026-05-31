export type OrderStatus = "접수" | "준비중" | "배송중" | "배송완료" | "취소";

export type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  badge: string;
  active: boolean;
};

export type Order = {
  id: string;
  customerName: string;
  phone: string;
  depositorName: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
};

export type Dashboard = {
  totalProducts: number;
  totalOrders: number;
  totalSales: number;
  pendingTransfers: number;
  preparing: number;
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
  | "대시보드"
  | "기본정보"
  | "상품관리"
  | "주문내역"
  | "문의내역"
  | "후기 목록"
  | "계정관리";
