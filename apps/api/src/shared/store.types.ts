export type OrderStatus =
  | '접수'
  | '준비중'
  | '배송중'
  | '배송완료'
  | '취소';

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl: string;
  badge: string;
  active: boolean;
};

export type OrderItem = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
};

export type Order = {
  id: string;
  customerName: string;
  phone: string;
  shippingAddress: string;
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
  depositorName: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
};

export type CreateProductInput = {
  name: string;
  description: string;
  price: number;
  stock: number;
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
};

export type CreateInquiryInput = {
  name: string;
  phone: string;
  title: string;
  message: string;
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

export type CreateReviewInput = {
  name: string;
  content: string;
};

export type CreateReviewCommentInput = {
  reviewId: string;
  name: string;
  content: string;
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
