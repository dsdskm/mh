import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import Kakao from "next-auth/providers/kakao";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:9000";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        userId: { label: "User ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.userId || !credentials?.password) {
          throw new Error("아이디와 비밀번호를 입력해주세요.");
        }

        try {
          const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId: credentials.userId,
              password: credentials.password,
            }),
          });

          if (!response.ok) {
            const data = (await response.json()) as { message?: string };
            throw new Error(data.message ?? "로그인에 실패했습니다.");
          }

          const data = (await response.json()) as {
            account: { id: number; userId: string; name: string };
          };
          return {
            id: String(data.account.id),
            name: data.account.name,
            email: data.account.userId,
          };
        } catch (error) {
          throw error instanceof Error ? error : new Error("로그인에 실패했습니다.");
        }
      },
    }),
    Kakao({
      clientId: process.env.KAKAO_CLIENT_ID ?? "",
      clientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
};

