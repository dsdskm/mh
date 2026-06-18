"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AdminPageState } from "../../_hooks/use-admin-page";
import { uploadAdminAssetApi } from "../../_lib/api";

type Props = {
  state: AdminPageState;
};

export function TermsTab({ state }: Props) {
  const [termsUrlInput, setTermsUrlInput] = useState(state.termsUrl);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTermsUrlInput(state.termsUrl);
  }, [state.termsUrl]);

  const history = useMemo(
    () => [...(state.config?.termsHistory ?? [])].sort((a, b) => new Date(b.termsUpdatedAt).getTime() - new Date(a.termsUpdatedAt).getTime()),
    [state.config?.termsHistory],
  );

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSelectedFile(file ?? null);
    setSaveError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setUploading(true);

    try {
      let nextTermsUrl = termsUrlInput.trim();

      if (selectedFile) {
        const { url } = await uploadAdminAssetApi(selectedFile, "terms");
        nextTermsUrl = url;
        setTermsUrlInput(url);
      }

      state.setTermsUrl(nextTermsUrl);
      const ok = await state.saveConfigDirect({ termsUrl: nextTermsUrl });
      if (!ok) {
        setSaveError("약관 저장에 실패했습니다.");
        return;
      }

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "약관 저장에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  }

  async function restoreHistory(url: string) {
    if (!window.confirm("선택한 약관 버전으로 복원할까요?")) {
      return;
    }

    setSaveError(null);
    setUploading(true);

    try {
      setTermsUrlInput(url);
      state.setTermsUrl(url);
      const ok = await state.saveConfigDirect({ termsUrl: url });
      if (!ok) {
        setSaveError("약관 복원에 실패했습니다.");
        return;
      }

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "약관 복원에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-3xl text-lime-800">약관관리</h2>
        <p className="mt-1 text-xs text-stone-500">약관 파일 업로드, 현재 버전 확인, 변경 내역(히스토리) 복원을 관리합니다.</p>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-stone-600">약관 파일 URL</span>
          <input
            value={termsUrlInput}
            onChange={(event) => setTermsUrlInput(event.target.value)}
            placeholder="약관 파일 URL"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-stone-600">약관 파일 업로드</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm,.txt,.md,.pdf"
            onChange={handleFileSelect}
            disabled={uploading}
            className="block w-full text-xs text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white disabled:opacity-60"
          />
          <p className="text-[11px] text-stone-500">
            {uploading
              ? "업로드/저장 중..."
              : selectedFile
                ? `선택됨: ${selectedFile.name} (저장 시 업로드)`
                : "파일을 선택하지 않으면 URL 값으로 저장됩니다."}
          </p>
        </label>

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
            {uploading ? "저장 중..." : "약관 저장"}
          </button>
          {termsUrlInput && (
            <a
              href={termsUrlInput}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700"
            >
              약관 파일 열기
            </a>
          )}
        </div>
      </form>

      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-stone-800">약관 변경 내역</h3>
          <span className="text-xs text-stone-500">총 {history.length}건</span>
        </div>

        {history.length === 0 ? (
          <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-500">저장된 약관 변경 내역이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {history.map((item) => {
              const isCurrent = item.termsVersion === state.config?.termsVersion;
              return (
                <div key={item.termsVersion} className="rounded-xl border border-stone-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-stone-700">
                      버전: {item.termsVersion}
                      {isCurrent ? " (현재)" : ""}
                    </p>
                    <p className="text-xs text-stone-500">{new Date(item.termsUpdatedAt).toLocaleString("ko-KR")}</p>
                  </div>
                  <p className="mt-1 break-all text-xs text-stone-500">{item.termsUrl}</p>
                  <div className="mt-2 flex gap-2">
                    <a
                      href={item.termsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-700"
                    >
                      열기
                    </a>
                    <button
                      type="button"
                      onClick={() => void restoreHistory(item.termsUrl)}
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
    </section>
  );
}
