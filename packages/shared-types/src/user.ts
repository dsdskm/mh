export type UserType = "NORMAL" | "KAKAO" | "NAVER" | "MASTER";

export type UserStatus = "active" | "deactive" | "withdraw";

export type SharedUser = {
  id: number;
  userId: string | null;
  type: UserType;
  username: string | null;
  providerUserId: string | null;
  displayName: string | null;
  kakaoNickname?: string | null;
  kakaoProfileImageUrl?: string | null;
  kakaoThumbnailImageUrl?: string | null;
  phone: string | null;
  address1: string | null;
  address2: string | null;
  status: UserStatus;
  statusReason: string | null;
  isActive: boolean;
  termsAgreed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserCreateInput = {
  type: UserType;
  userId?: string;
  username?: string;
  password?: string;
  providerUserId?: string;
  displayName?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  status?: UserStatus;
  statusReason?: string;
  isActive?: boolean;
};

export type AdminUserUpdateInput = {
  type?: UserType;
  userId?: string;
  username?: string;
  password?: string;
  providerUserId?: string;
  displayName?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  status?: UserStatus;
  statusReason?: string;
  isActive?: boolean;
};
