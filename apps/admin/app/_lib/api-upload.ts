import { API_BASE } from "./constants";
import { parseJsonOrThrow } from "./api-common";

export type AdminUploadTarget = "products" | "videos";

export async function uploadAdminAssetApi(
  file: File,
  target: AdminUploadTarget,
  productId?: string,
): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("target", target);

  if (productId) {
    formData.append("productId", productId);
  }

  const response = await fetch(`${API_BASE}/api/backoffice/uploads`, {
    method: "POST",
    body: formData,
  });

  return parseJsonOrThrow<{ url: string }>(response, "파일 업로드에 실패했습니다.");
}
