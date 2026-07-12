import type { Metadata } from "next";
import { Bagel_Fat_One, Noto_Sans_KR } from "next/font/google";
import Script from "next/script";
import sharedIcon from "@repo/ui/assets/icon.png";
import WebSessionProvider from "./session-provider";
import "./globals.css";

const display = Bagel_Fat_One({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-display",
});

const body = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Corn",
  description: "모바일/PC 최적화 옥수수 쇼핑몰",
  icons: {
    icon: sharedIcon.src,
    shortcut: sharedIcon.src,
    apple: sharedIcon.src,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${display.variable} ${body.variable} font-body`}>
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.8.1/kakao.min.js"
          integrity="sha384-OL+ylM/iuPLtW5U3XcvLSGhE8JzReKDank5InqlHGWPhb4140/yrBw0bg0y7+C9J"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <WebSessionProvider>{children}</WebSessionProvider>
      </body>
    </html>
  );
}
