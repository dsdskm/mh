"use client";

import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { AdminPageState } from "../../_hooks/use-admin-page";
import { uploadAdminAssetApi } from "../../_lib/api";

type Props = {
  state: AdminPageState;
};

export function TermsTab({ state }: Props) {
  const [selectedTermsFile, setSelectedTermsFile] = useState<File | null>(null);
  const [selectedPrivacyFile, setSelectedPrivacyFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<{
    documentType: "terms" | "privacy";
    documentUrl: string;
  } | null>(null);
  const termsFileInputRef = useRef<HTMLInputElement | null>(null);
  const privacyFileInputRef = useRef<HTMLInputElement | null>(null);

  const history = useMemo(
    () => [...(state.config?.termsHistory ?? [])].sort((a, b) => new Date(b.termsUpdatedAt).getTime() - new Date(a.termsUpdatedAt).getTime()),
    [state.config?.termsHistory],
  );

  function handleTermsFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSelectedTermsFile(file ?? null);
    setSaveError(null);
  }

  function handlePrivacyFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSelectedPrivacyFile(file ?? null);
    setSaveError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setUploading(true);

    try {
      let nextTermsUrl = state.termsUrl.trim();
      let nextPrivacyUrl = state.privacyUrl.trim();

      if (selectedTermsFile) {
        const { url } = await uploadAdminAssetApi(selectedTermsFile, "terms");
        nextTermsUrl = url;
      }

      if (selectedPrivacyFile) {
        const { url } = await uploadAdminAssetApi(selectedPrivacyFile, "terms");
        nextPrivacyUrl = url;
      }

      state.setTermsUrl(nextTermsUrl);
      state.setPrivacyUrl(nextPrivacyUrl);
      const ok = await state.saveConfigDirect({
        termsUrl: nextTermsUrl,
        privacyUrl: nextPrivacyUrl,
      });
      if (!ok) {
        setSaveError("문서 저장에 실패했습니다.");
        return;
      }

      setSelectedTermsFile(null);
      setSelectedPrivacyFile(null);
      if (termsFileInputRef.current) {
        termsFileInputRef.current.value = "";
      }
      if (privacyFileInputRef.current) {
        privacyFileInputRef.current.value = "";
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "문서 저장에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  }

  function restoreHistory(item: {
    documentType: "terms" | "privacy";
    documentUrl: string;
  }) {
    setRestoreTarget(item);
  }

  async function confirmRestoreHistory() {
    if (!restoreTarget) {
      return;
    }

    const item = restoreTarget;
    const label = item.documentType === "terms" ? "이용약관" : "개인정보처리방침";

    setSaveError(null);
    setUploading(true);
    setRestoreTarget(null);

    try {
      if (item.documentType === "terms") {
        state.setTermsUrl(item.documentUrl);
      } else {
        state.setPrivacyUrl(item.documentUrl);
      }

      const ok = await state.saveConfigDirect(
        item.documentType === "terms"
          ? { termsUrl: item.documentUrl }
          : { privacyUrl: item.documentUrl },
      );
      if (!ok) {
        setSaveError(`${label} 복원에 실패했습니다.`);
        return;
      }

      setSelectedTermsFile(null);
      if (termsFileInputRef.current) {
        termsFileInputRef.current.value = "";
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : `${label} 복원에 실패했습니다.`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-3xl text-lime-800">약관관리</h2>
        <p className="mt-1 text-xs text-stone-500">이용약관/개인정보처리방침 파일 업로드를 관리합니다. 약관은 버전 히스토리 복원이 가능합니다.</p>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
        <section className="space-y-3 rounded-xl border border-stone-200 p-3">
          <h3 className="text-sm font-bold text-stone-800">이용약관</h3>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">약관 파일 업로드</span>
            <input
              ref={termsFileInputRef}
              type="file"
              accept=".html,.htm,.txt,.md,.pdf"
              onChange={handleTermsFileSelect}
              disabled={uploading}
              className="block w-full text-xs text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white disabled:opacity-60"
            />
            <p className="text-[11px] text-stone-500">
              {uploading
                ? "업로드/저장 중..."
                : selectedTermsFile
                  ? `선택됨: ${selectedTermsFile.name} (저장 시 업로드)`
                  : "파일 선택 후 문서 저장 시 업로드됩니다."}
            </p>
          </label>
        </section>

        <section className="space-y-3 rounded-xl border border-stone-200 p-3">
          <h3 className="text-sm font-bold text-stone-800">개인정보처리방침</h3>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">개인정보처리방침 파일 업로드</span>
            <input
              ref={privacyFileInputRef}
              type="file"
              accept=".html,.htm,.txt,.md,.pdf"
              onChange={handlePrivacyFileSelect}
              disabled={uploading}
              className="block w-full text-xs text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white disabled:opacity-60"
            />
            <p className="text-[11px] text-stone-500">
              {uploading
                ? "업로드/저장 중..."
                : selectedPrivacyFile
                  ? `선택됨: ${selectedPrivacyFile.name} (저장 시 업로드)`
                  : "파일 선택 후 문서 저장 시 업로드됩니다."}
            </p>
          </label>
        </section>

        <div className="rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-600">
          <p>현재 버전: {state.config?.termsVersion || "-"}</p>
          <p>
            최근 변경: {state.config?.termsUpdatedAt ? new Date(state.config.termsUpdatedAt).toLocaleString("ko-KR") : "-"}
          </p>
        </div>

        {saveError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={uploading}
            className="rounded-xl bg-lime-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {uploading ? "저장 중..." : "문서 저장"}
          </button>
          {state.termsUrl && (
            <a
              href={state.termsUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700"
            >
              약관 파일 열기
            </a>
          )}
          {state.privacyUrl && (
            <a
              href={state.privacyUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700"
            >
              개인정보처리방침 파일 열기
            </a>
          )}
        </div>
      </form>

      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-stone-800">app_settings_terms_history</h3>
          <span className="text-xs text-stone-500">총 {history.length}건</span>
        </div>

        {history.length === 0 ? (
          <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-500">저장된 약관 변경 내역이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {history.map((item) => {
              const isCurrent =
                item.documentType === "terms"
                  ? item.documentUrl === state.termsUrl
                  : item.documentUrl === state.privacyUrl;
              const typeLabel = item.documentType === "terms" ? "이용약관" : "개인정보처리방침";
              return (
                <div key={`${item.documentType}:${item.termsVersion}:${item.documentUrl}`} className="rounded-xl border border-stone-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-stone-700">
                      {typeLabel} · 버전: {item.termsVersion}
                      {isCurrent ? " (현재)" : ""}
                    </p>
                    <p className="text-xs text-stone-500">{new Date(item.termsUpdatedAt).toLocaleString("ko-KR")}</p>
                  </div>
                  <p className="mt-1 break-all text-xs text-stone-500">{item.documentUrl}</p>
                  <div className="mt-2 flex gap-2">
                    <a
                      href={item.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-700"
                    >
                      열기
                    </a>
                    <button
                      type="button"
                      onClick={() => void restoreHistory(item)}
                      disabled={uploading || isCurrent}
                      className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 disabled:opacity-50"
                    >
                      복원
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {restoreTarget && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-stone-900">히스토리 복원 확인</h3>
            <p className="mt-2 text-sm text-stone-700">
              선택한 {restoreTarget.documentType === "terms" ? "이용약관" : "개인정보처리방침"} 버전으로 복원할까요?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                disabled={uploading}
                className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void confirmRestoreHistory()}
                disabled={uploading}
                className="flex-1 rounded-xl bg-amber-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {uploading ? "복원 중..." : "복원"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
