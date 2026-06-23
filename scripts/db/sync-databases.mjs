#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const projectRoot = path.resolve(import.meta.dirname, "../..");

function loadEnvFile(fileName) {
  const filePath = path.join(projectRoot, fileName);
  if (!existsSync(filePath)) return {};

  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        return [key, value];
      }),
  );
}

const localEnv = loadEnvFile(".env");
const productionEnv = loadEnvFile(".env.prd");
const args = new Set(process.argv.slice(2));
const direction = process.argv[2];
const batchSize = Number(process.env.DATABASE_SYNC_BATCH_SIZE || 200);

if (!["pull", "push"].includes(direction)) {
  console.error(
    "사용법: node scripts/db/sync-databases.mjs <pull|push> [--confirm-server-write]",
  );
  process.exit(1);
}

if (direction === "push" && !args.has("--confirm-server-write")) {
  console.error(
    "서버 DB 쓰기를 확인하려면 --confirm-server-write 플래그가 필요합니다.",
  );
  process.exit(1);
}

if (!Number.isInteger(batchSize) || batchSize <= 0) {
  console.error("DATABASE_SYNC_BATCH_SIZE는 1 이상의 정수여야 합니다.");
  process.exit(1);
}

const localApiUrl = (
  process.env.LOCAL_API_BASE_URL ||
  localEnv.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:9000"
).replace(/\/+$/, "");
const serverApiUrl = (
  process.env.SERVER_API_BASE_URL ||
  productionEnv.NEXT_PUBLIC_API_BASE_URL ||
  ""
).replace(/\/+$/, "");

if (!serverApiUrl) {
  console.error(
    "SERVER_API_BASE_URL 또는 .env.prd의 NEXT_PUBLIC_API_BASE_URL이 필요합니다.",
  );
  process.exit(1);
}

const source =
  direction === "pull"
    ? {
        name: "서버",
        url: serverApiUrl,
        secret: process.env.SERVER_DATABASE_SYNC_SECRET,
        token: process.env.SERVER_ADMIN_TOKEN,
      }
    : {
        name: "로컬",
        url: localApiUrl,
        secret:
          process.env.LOCAL_DATABASE_SYNC_SECRET ||
          "dev-database-sync-secret-change-me",
        token: process.env.LOCAL_ADMIN_TOKEN,
      };
const target =
  direction === "pull"
    ? {
        name: "로컬",
        url: localApiUrl,
        secret:
          process.env.LOCAL_DATABASE_SYNC_SECRET ||
          "dev-database-sync-secret-change-me",
        token: process.env.LOCAL_ADMIN_TOKEN,
      }
    : {
        name: "서버",
        url: serverApiUrl,
        secret: process.env.SERVER_DATABASE_SYNC_SECRET,
        token: process.env.SERVER_ADMIN_TOKEN,
      };

function authHeaders(endpoint) {
  if (endpoint.secret) {
    return { "x-database-sync-secret": endpoint.secret };
  }
  if (endpoint.token) {
    return { Authorization: `Bearer ${endpoint.token}` };
  }
  throw new Error(
    `${endpoint.name} 인증값이 없습니다. DATABASE_SYNC_SECRET 또는 ADMIN_TOKEN을 설정해주세요.`,
  );
}

async function request(endpoint, pathname, init = {}) {
  const response = await fetch(`${endpoint.url}${pathname}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...authHeaders(endpoint),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message;
    throw new Error(
      `${endpoint.name} API ${response.status}: ${message || response.statusText}`,
    );
  }
  return body;
}

async function main() {
  if (source.url === target.url) {
    throw new Error(`원본과 대상 API 주소가 같습니다: ${source.url}`);
  }

  console.log(
    `[database-sync] ${source.name}(${source.url}) → ${target.name}(${target.url})`,
  );
  const manifest = await request(
    source,
    "/api/backoffice/database-sync/manifest",
  );
  const targetManifest = await request(
    target,
    "/api/backoffice/database-sync/manifest",
  );

  if (
    manifest.version !== targetManifest.version ||
    JSON.stringify(manifest.tables) !== JSON.stringify(targetManifest.tables)
  ) {
    throw new Error(
      "원본과 대상의 데이터베이스 동기화 API 버전/테이블 구성이 다릅니다.",
    );
  }

  let total = 0;
  for (const table of manifest.tables) {
    const exported = await request(
      source,
      `/api/backoffice/database-sync/tables/${encodeURIComponent(table)}`,
    );
    let tableTotal = 0;
    for (let offset = 0; offset < exported.rows.length; offset += batchSize) {
      const rows = exported.rows.slice(offset, offset + batchSize);
      const imported = await request(
        target,
        `/api/backoffice/database-sync/tables/${encodeURIComponent(table)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows }),
        },
      );
      tableTotal += imported.upserted;
    }
    total += tableTotal;
    console.log(`  ${table}: ${tableTotal}건`);
  }

  console.log(`[database-sync] 완료: 총 ${total}건 추가/갱신`);
}

main().catch((error) => {
  console.error(`[database-sync] 실패: ${error.message}`);
  process.exitCode = 1;
});
