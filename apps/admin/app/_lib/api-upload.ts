import { API_BASE } from "./constants";
import { adminFetch, parseJsonOrThrow } from "./api-common";

export type AdminUploadTarget = "products" | "videos" | "terms" | "recipes";

type PresignUploadResponse = {
  uploadUrl: string;
  objectPath: string;
  downloadToken: string;
};

export async function uploadAdminAssetApi(
  file: File,
  target: AdminUploadTarget,
  productId?: string,
): Promise<{ url: string }> {
  const presignResponse = await adminFetch(`${API_BASE}/api/backoffice/uploads/presign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target,
      productId,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
    }),
    timeoutMs: 30000,
  });

  const session = await parseJsonOrThrow<PresignUploadResponse>(
    presignResponse,
    "업로드 준비에 실패했습니다.",
  );

  const uploadRes = await fetch(session.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error("파일 업로드에 실패했습니다.");
  }

  const completeResponse = await adminFetch(`${API_BASE}/api/backoffice/uploads/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target,
      objectPath: session.objectPath,
      downloadToken: session.downloadToken,
      contentType: file.type || "application/octet-stream",
    }),
    timeoutMs: 30000,
  });

  return parseJsonOrThrow<{ url: string }>(completeResponse, "파일 업로드에 실패했습니다.");
}
