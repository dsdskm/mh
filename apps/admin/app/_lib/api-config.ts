import { API_BASE } from "./constants";
import { adminFetch, parseJsonOrThrow } from "./api-common";
import { StoreConfig } from "./types";

export async function getConfigApi(): Promise<StoreConfig> {
  const response = await adminFetch(`${API_BASE}/api/backoffice/config`, {
    cache: "no-store",
  });

  return parseJsonOrThrow<StoreConfig>(response, "기본정보를 불러오지 못했습니다.");
}

export async function saveConfigApi(config: StoreConfig): Promise<StoreConfig> {
  const response = await adminFetch(`${API_BASE}/api/backoffice/config`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  });

  return parseJsonOrThrow<StoreConfig>(response, "기본정보 저장에 실패했습니다.");
}
