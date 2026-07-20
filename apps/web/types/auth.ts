export type RequestPhoneVerificationPayload = {
  phone: string;
};

export type RequestPhoneVerificationResponse = {
  ok: boolean;
  expiresAt: string;
};

export type VerifyPhoneCodePayload = {
  phone: string;
  code: string;
};

export type VerifyPhoneCodeResponse = {
  ok: boolean;
  verificationToken: string;
  expiresAt: string;
};

export type UserProfileResponse = {
  profile: {
    id: number;
    userId: string;
    accountType?: "NORMAL" | "KAKAO" | "NAVER" | "MASTER";
    name: string;
    phone: string;
    address1: string;
    address2: string;
    kakaoNickname?: string;
    kakaoProfileImageUrl?: string;
    kakaoThumbnailImageUrl?: string;
    kakaoShippingZoneNumber?: string;
    status?: "active" | "deactive" | "withdraw";
    statusReason?: string | null;
  };
};

export type UpdateProfilePayload = {
  userId: string;
  name: string;
  address1: string;
  address2: string;
  currentPassword?: string;
  newPassword?: string;
};

export type WithdrawPayload = {
  userId: string;
  password?: string;
  reason?: string;
};

export type ShippingAddress = {
  id: number;
  name: string;
  address1: string;
  address2: string;
  isDefault: boolean;
};

export type ShippingAddressesResponse = {
  shippingAddresses: ShippingAddress[];
};

export type SaveShippingAddressPayload = {
  userId: string;
  id?: number;
  name: string;
  address1: string;
  address2: string;
  isDefault?: boolean;
};
