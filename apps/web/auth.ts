import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const configuredApiBase =
  process.env.INTERNAL_API_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  "";

const API_BASE =
  configuredApiBase.startsWith("http://") || configuredApiBase.startsWith("https://")
    ? configuredApiBase.replace(/\/+$/, "")
    : process.env.NODE_ENV === "development"
      ? "http://localhost:9000"
      : "http://api:9000";

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
    CredentialsProvider({
      id: "kakao-rest",
      name: "Kakao REST",
      credentials: {
        code: { label: "Authorization Code", type: "text" },
        redirectUri: { label: "Redirect URI", type: "text" },
      },
      async authorize(credentials) {
        const code = credentials?.code?.trim();
        const redirectUri = credentials?.redirectUri?.trim();

        if (!code || !redirectUri) {
          throw new Error("카카오 로그인 정보가 올바르지 않습니다.");
        }

        try {
          const response = await fetch(`${API_BASE}/api/auth/kakao/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              code,
              redirectUri,
            }),
          });

          if (!response.ok) {
            const data = (await response.json()) as { message?: string };
            throw new Error(data.message ?? "카카오 로그인에 실패했습니다.");
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
          throw error instanceof Error ? error : new Error("카카오 로그인에 실패했습니다.");
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      try {
        const target = new URL(url);
        const base = new URL(baseUrl);

        if (target.origin === base.origin) {
          return url;
        }

        if (
          process.env.NODE_ENV === "development" &&
          target.protocol === "http:" &&
          target.hostname === "localhost"
        ) {
          return url;
        }
      } catch {
        return baseUrl;
      }

      return baseUrl;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.sub === "string" ? token.sub : undefined;
        session.user.name = typeof token.name === "string" ? token.name : session.user.name;
        session.user.email = typeof token.email === "string" ? token.email : session.user.email;
      }

      return session;
    },
  },
};

