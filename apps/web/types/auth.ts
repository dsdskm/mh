export type RequestPhoneVerificationPayload = {
  phone: string;
};

export type CheckUserIdPayload = {
  userId: string;
};

export type CheckUserIdResponse = {
  available: boolean;
  message: string;
};

export type RequestPhoneVerificationResponse = {
  ok: boolean;
  expiresAt: string;
  devCode?: string;
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

export type SignupPayload = {
  userId: string;
  password: string;
  name: string;
  phone: string;
  address: string;
  verificationToken: string;
};

export type SignupResponse = {
  account: {
    id: number;
    userId: string;
    name: string;
    phone: string;
    address: string;
    createdAt: string;
  };
};
