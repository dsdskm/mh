import { API_BASE } from "./constants";
import { parseJsonOrThrow } from "./api-common";
import { StoreConfig } from "./types";

export async function saveConfigApi(config: StoreConfig): Promise<StoreConfig> {
  const response = await fetch(`${API_BASE}/api/backoffice/config`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  });

  return parseJsonOrThrow<StoreConfig>(response, "기본정보 저장에 실패했습니다.");
}
