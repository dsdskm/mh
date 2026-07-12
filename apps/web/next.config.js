import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadRootEnvFiles() {
	const workspaceRoot = path.resolve(__dirname, "../../");
	const envPath = path.join(workspaceRoot, ".env");
	const envPrdPath = path.join(workspaceRoot, ".env.prd");
	const isProduction = process.env.NODE_ENV === "production";

	for (const filePath of [envPath, ...(isProduction ? [envPrdPath] : [])]) {
		if (!fs.existsSync(filePath)) {
			continue;
		}

		const content = fs.readFileSync(filePath, "utf8");
		for (const line of content.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) {
				continue;
			}

			const separatorIndex = trimmed.indexOf("=");
			if (separatorIndex <= 0) {
				continue;
			}

			const key = trimmed.slice(0, separatorIndex).trim();
			const value = trimmed.slice(separatorIndex + 1).trim();
			process.env[key] = value;
		}
	}
}

loadRootEnvFiles();

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
