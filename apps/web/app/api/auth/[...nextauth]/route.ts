import { NextRequest, NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "../../../../auth";

const BACKEND_BASE =
  process.env.INTERNAL_API_BASE_URL?.trim() ||
  (process.env.NODE_ENV === "development" ? "http://localhost:9000" : "http://api:9000");

// NextAuth 자체가 처리하는 경로 (첫 번째 세그먼트 기준)
const NEXTAUTH_SEGMENTS = new Set([
  "signin",
  "signout",
  "session",
  "csrf",
  "providers",
  "error",
  "verify-request",
  "callback",
]);

const nextAuthHandler = NextAuth(authOptions);

type RouteContext = { params: Promise<{ nextauth: string[] }> };

async function handleRequest(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const params = await context.params;
  const [firstSegment] = params.nextauth;

  if (typeof firstSegment === "string" && NEXTAUTH_SEGMENTS.has(firstSegment)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (nextAuthHandler as any)(request, context) as Promise<NextResponse>;
  }

  // 백엔드 API로 프록시
  const { pathname, search } = new URL(request.url);
  const backendUrl = `${BACKEND_BASE}${pathname}${search}`;

  const init: RequestInit = {
    method: request.method,
    headers: { "Content-Type": "application/json" },
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  const res = await fetch(backendUrl, init);
  const data: unknown = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export const GET = handleRequest;
export const POST = handleRequest;
