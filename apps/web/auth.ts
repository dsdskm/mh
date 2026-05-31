import { NextAuthOptions } from "next-auth";
import Kakao from "next-auth/providers/kakao";

export const authOptions: NextAuthOptions = {
  providers: [
    Kakao({
      clientId: process.env.KAKAO_CLIENT_ID ?? "",
      clientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
};
