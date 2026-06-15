import type { Metadata } from "next";
import { Bagel_Fat_One, Noto_Sans_KR } from "next/font/google";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${display.variable} ${body.variable} font-body`}>
        <WebSessionProvider>{children}</WebSessionProvider>
      </body>
    </html>
  );
}
