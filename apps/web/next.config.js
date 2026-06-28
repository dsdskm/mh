import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
	// Cloud Run 용 단독 실행 서버 번들 (.next/standalone)
	output: "standalone",
	// 모노레포 루트 기준으로 의존성 트레이싱
	outputFileTracingRoot: path.join(__dirname, "../../"),
	// 워크스페이스 소스 패키지를 빌드 시 트랜스파일
	transpilePackages: ["@repo/ui", "@repo/shared-types"],
	async rewrites() {
		return [
			{
				source: "/api/auth/signin",
				destination: "/api/auth/signin",
			},
			{
				source: "/api/auth/signout",
				destination: "/api/auth/signout",
			},
			{
				source: "/api/auth/session",
				destination: "/api/auth/session",
			},
			{
				source: "/api/auth/csrf",
				destination: "/api/auth/csrf",
			},
			{
				source: "/api/auth/providers",
				destination: "/api/auth/providers",
			},
			{
				source: "/api/auth/error",
				destination: "/api/auth/error",
			},
			{
				source: "/api/auth/verify-request",
				destination: "/api/auth/verify-request",
			},
			{
				source: "/api/auth/callback/:path*",
				destination: "/api/auth/callback/:path*",
			},
			{
				source: "/api/:path*",
				destination: "http://api:9000/api/:path*",
			},
		];
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "**",
			},
			{
				protocol: "http",
				hostname: "**",
			},
		],
	},
};

export default nextConfig;
