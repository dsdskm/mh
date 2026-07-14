import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { AdminPageState } from "../../_hooks/use-admin-page";
import { saveConfigApi, uploadAdminAssetApi } from "../../_lib/api";

type Props = {
  state: AdminPageState;
};

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed);
    const parsed = new URL(hasProtocol ? trimmed : `https://${trimmed}`);
    return parsed.toString();
  } catch {
    return null;
  }
}

function pickYouTubeVideoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id ?? null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") {
      return url.searchParams.get("v");
    }

    if (url.pathname.startsWith("/embed/")) {
      const id = url.pathname.split("/")[2];
      return id ?? null;
    }

    if (url.pathname.startsWith("/shorts/")) {
      const id = url.pathname.split("/")[2];
      return id ?? null;
    }
  }

  return null;
}

export function SettingsTab({ state }: Props) {
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [selectedStoryImageFiles, setSelectedStoryImageFiles] = useState<Array<{ file: File; title: string }>>([]);

  useEffect(() => {
    console.log("[admin/settings] uploadingVideo changed", {
      uploadingVideo,
      at: new Date().toISOString(),
    });
  }, [uploadingVideo]);

  useEffect(() => {
    console.log("[admin/settings] configSaved changed", {
      configSaved: state.configSaved,
      at: new Date().toISOString(),
    });
  }, [state.configSaved]);

  const normalizedVideoUrl = useMemo(() => {
    const normalized = normalizeUrl(state.videoUrl);
    if (!normalized) {
      return null;
    }

    return normalized;
  }, [state.videoUrl]);

  const videoPreview = useMemo(() => {
    if (!normalizedVideoUrl) {
      return null;
    }

    try {
      const parsed = new URL(normalizedVideoUrl);
      const videoId = pickYouTubeVideoId(parsed);
      if (videoId) {
        return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0`;
      }

      return null;
    } catch {
      return null;
    }
  }, [normalizedVideoUrl]);

  const showDirectVideoPreview = useMemo(() => {
    return Boolean(normalizedVideoUrl) && !videoPreview;
  }, [normalizedVideoUrl, videoPreview]);

  function handleVideoSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setUploadError(null);
    setSelectedVideoFile(file ?? null);
    console.log("[admin/settings] video file selected", {
      hasFile: Boolean(file),
      name: file?.name,
      size: file?.size,
      type: file?.type,
      at: new Date().toISOString(),
    });
  }

  function handleStoryImageSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    if (files.length === 0) {
      return;
    }

    setImageUploadError(null);
    setSelectedStoryImageFiles((prev) => {
      const baseIndex = state.storyImages.length + prev.length;
      const nextItems = files.map((file, idx) => ({
        file,
        title: file.name.replace(/\.[^/.]+$/, "") || `상점 이미지 ${baseIndex + idx + 1}`,
      }));
      return [...prev, ...nextItems];
    });
  }

  function handleSelectedStoryImageTitleChange(index: number, title: string) {
    setSelectedStoryImageFiles((prev) => prev.map((item, idx) => (idx === index ? { ...item, title } : item)));
  }

  function handleSelectedStoryImageRemove(index: number) {
    setSelectedStoryImageFiles((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleStoryImageTitleChange(index: number, title: string) {
    state.updateStoryImageTitle(index, title);
  }

  async function handleStoryImageTitleBlur() {
    state.setConfigSaved(false);
    const saved = await state.saveConfigDirect({ storyImages: state.storyImages });
    if (!saved) {
      setImageUploadError("상점 이미지 제목 저장에 실패했습니다.");
    }
  }

  async function handleStoryImageRemove(index: number) {
    const nextStoryImages = state.storyImages.filter((_, idx) => idx !== index);
    state.setStoryImages(nextStoryImages);
    state.setConfigSaved(false);
    const saved = await state.saveConfigDirect({ storyImages: nextStoryImages });
    if (!saved) {
      setImageUploadError("상점 이미지 삭제 저장에 실패했습니다.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);
    setImageUploadError(null);
    const startedAt = Date.now();
    const hasSelectedStoryImages = selectedStoryImageFiles.length > 0;
    console.log("[admin/settings] handleSubmit start", {
      hasSelectedVideoFile: Boolean(selectedVideoFile),
      selectedVideoFileName: selectedVideoFile?.name,
      selectedVideoFileSize: selectedVideoFile?.size,
      selectedStoryImageCount: selectedStoryImageFiles.length,
      currentVideoUrl: state.videoUrl,
      at: new Date().toISOString(),
    });

    if (!selectedVideoFile && !hasSelectedStoryImages) {
      console.log("[admin/settings] saveConfig only (no asset upload)", {
        videoUrl: state.videoUrl,
        storyImageCount: state.storyImages.length,
      });
      state.setConfigSaved(false);
      const saved = await state.saveConfig(event, { videoUrl: state.videoUrl, storyImages: state.storyImages });
      console.log("[admin/settings] saveConfig only result (no asset upload)", {
        saved,
        elapsedMs: Date.now() - startedAt,
      });
      return;
    }

    let nextVideoUrl = state.videoUrl;
    let nextStoryImages = state.storyImages;
    setUploadingVideo(Boolean(selectedVideoFile));
    setUploadingImage(hasSelectedStoryImages);
    console.log("[admin/settings] asset upload state set", {
      uploadingVideo: Boolean(selectedVideoFile),
      uploadingImage: hasSelectedStoryImages,
      fileName: selectedVideoFile?.name,
      fileSize: selectedVideoFile?.size,
      fileType: selectedVideoFile?.type,
    });
    try {
      if (selectedVideoFile) {
        console.log("[admin/settings] uploadAdminAssetApi start", {
          fileName: selectedVideoFile.name,
          fileSize: selectedVideoFile.size,
          fileType: selectedVideoFile.type,
        });
        const { url } = await uploadAdminAssetApi(selectedVideoFile, "videos");
        nextVideoUrl = url;
        state.setVideoUrl(url);
        console.log("[admin/settings] uploadAdminAssetApi success", {
          uploadedUrl: url,
        });
      }

      if (hasSelectedStoryImages) {
        const uploadedStoryImages: Array<{ title: string; imageUrl: string }> = [];
        for (const [index, item] of selectedStoryImageFiles.entries()) {
          console.log("[admin/settings] story image upload start", {
            index,
            fileName: item.file.name,
            fileSize: item.file.size,
            fileType: item.file.type,
          });
          const { url } = await uploadAdminAssetApi(item.file, "products", "story");
          uploadedStoryImages.push({
            title: item.title.trim() || item.file.name.replace(/\.[^/.]+$/, "") || `상점 이미지 ${state.storyImages.length + index + 1}`,
            imageUrl: url,
          });
          console.log("[admin/settings] story image upload success", {
            index,
            uploadedUrl: url,
          });
        }

        nextStoryImages = [...state.storyImages, ...uploadedStoryImages];
        state.setStoryImages(nextStoryImages);
      }

      state.setConfigSaved(false);
      console.log("[admin/settings] saveConfig with uploaded assets start", {
        nextVideoUrl,
        nextStoryImageCount: nextStoryImages.length,
      });
      const saved = await state.saveConfig(event, { videoUrl: nextVideoUrl, storyImages: nextStoryImages });
      console.log("[admin/settings] saveConfig with uploaded assets result", {
        saved,
      });
      setSelectedVideoFile(null);
      setSelectedStoryImageFiles([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "파일 업로드에 실패했습니다.";
      if (hasSelectedStoryImages) {
        setImageUploadError(message);
      }
      if (selectedVideoFile) {
        setUploadError(message);
      }
      console.error("[admin/settings] handleSubmit error", {
        message,
        rawError: error,
      });
      event.preventDefault();
    } finally {
      setUploadingVideo(false);
      setUploadingImage(false);
      console.log("[admin/settings] setUploadingVideo(false)", {
        elapsedMs: Date.now() - startedAt,
        at: new Date().toISOString(),
      });
    }
  }

  return (
    <>
      <h2 className="font-display text-3xl text-lime-800">기본정보</h2>
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
        <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-stone-900">판매자 기본 정보</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-stone-600">상점명</span>
              <input
                value={state.shopName}
                onChange={(e) => state.setShopName(e.target.value)}
                placeholder="상점명"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-stone-600">판매자명</span>
              <input
                value={state.sellerName}
                onChange={(e) => state.setSellerName(e.target.value)}
                placeholder="판매자명"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-stone-600">연락처</span>
              <input
                value={state.sellerPhone}
                onChange={(e) => state.setSellerPhone(e.target.value)}
                placeholder="연락처"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold text-stone-600">카카오 채널 문의 URL</span>
              <input
                value={state.kakaoChannelUrl}
                onChange={(e) => state.setKakaoChannelUrl(e.target.value)}
                placeholder="https://pf.kakao.com/..."
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-stone-600">원산지</span>
              <input
                value={state.origin}
                onChange={(e) => state.setOrigin(e.target.value)}
                placeholder="원산지"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-stone-900">서비스 운영자 정보</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-stone-600">서비스 운영자 상호</span>
              <input
                value={state.trusteeBusinessName}
                onChange={(e) => state.setTrusteeBusinessName(e.target.value)}
                placeholder="서비스 운영자 상호"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-stone-600">서비스 운영자 사업자등록번호</span>
              <input
                value={state.trusteeBusinessNumber}
                onChange={(e) => state.setTrusteeBusinessNumber(e.target.value)}
                placeholder="서비스 운영자 사업자등록번호"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-stone-600">서비스 운영자 대표</span>
              <input
                value={state.trusteeRepresentative}
                onChange={(e) => state.setTrusteeRepresentative(e.target.value)}
                placeholder="서비스 운영자 대표"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-stone-600">서비스 운영자 연락처</span>
              <input
                value={state.trusteePhone}
                onChange={(e) => state.setTrusteePhone(e.target.value)}
                placeholder="서비스 운영자 연락처"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-stone-900">정산 및 배송 정보</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-stone-600">은행명</span>
              <input
                value={state.bankName}
                onChange={(e) => state.setBankName(e.target.value)}
                placeholder="은행명"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-stone-600">계좌번호</span>
              <input
                value={state.accountNumber}
                onChange={(e) => state.setAccountNumber(e.target.value)}
                placeholder="계좌번호"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-stone-600">예금주</span>
              <input
                value={state.accountHolder}
                onChange={(e) => state.setAccountHolder(e.target.value)}
                placeholder="예금주"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-stone-600">배송료 (원)</span>
              <input
                type="number"
                min={0}
                value={state.deliveryFee}
                onChange={(e) => state.setDeliveryFee(e.target.value)}
                placeholder="예: 3000"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
              <span className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  checked={state.chargeDeliveryFee}
                  onChange={(e) => state.setChargeDeliveryFee(e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-lime-600"
                />
                <span className="text-[11px] text-stone-600">
                  배송료 청구 (체크 시 주문 금액에 배송료가 더해집니다)
                </span>
              </span>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">입금 안내</span>
            <textarea
              value={state.transferNote}
              onChange={(e) => state.setTransferNote(e.target.value)}
              placeholder="입금 안내"
              className="h-20 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
        </section>

        <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-stone-900">주문 및 혜택 설정</h3>
          <div className="space-y-3">
            <label className="grid gap-2 sm:grid-cols-[150px_220px_1fr] sm:items-start sm:gap-3">
              <span className="pt-2 text-xs font-semibold text-stone-600">입금 기한 (일)</span>
              <input
                type="number"
                min={0}
                value={state.paymentDueDays}
                onChange={(e) => state.setPaymentDueDays(e.target.value)}
                placeholder="예: 3 (0이면 기한 없음)"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
              <span className="pt-2 text-[11px] leading-5 text-stone-500">
                주문 후 이 일수가 지나도록 미입금이면 자동으로 취소됩니다. 0이면 자동 취소하지 않습니다.
              </span>
            </label>
            <label className="grid gap-2 sm:grid-cols-[150px_220px_1fr] sm:items-start sm:gap-3">
              <span className="pt-2 text-xs font-semibold text-stone-600">적립금 적립률 (%)</span>
              <input
                type="number"
                min={0}
                value={state.mileageEarnRate}
                onChange={(e) => state.setMileageEarnRate(e.target.value)}
                placeholder="예: 5 (0이면 적립 안 함)"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
              <span className="pt-2 text-[11px] leading-5 text-stone-500">
                회원 주문이 배송완료되면 결제 금액의 이 비율만큼 적립금이 자동 적립됩니다. 0이면 자동 적립하지 않습니다.
              </span>
            </label>
          </div>
          <label className="grid gap-2 sm:grid-cols-[150px_220px_1fr] sm:items-start sm:gap-3">
            <span className="pt-2 text-xs font-semibold text-stone-600">회원 주문 포함 상품</span>
            <select
              value={state.memberBonusProductId ?? ""}
              onChange={(e) => state.setMemberBonusProductId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            >
              <option value="">없음</option>
              {state.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <span className="pt-2 text-[11px] leading-5 text-stone-500">
              회원(로그인) 주문 시 선택한 상품이 0원 사은품으로 함께 발송됩니다. 재고는 차감되지 않으며, 매장에 노출하고
              싶지 않으면 상품관리에서 비노출(숨김) 상태로 등록해도 사은품으로 사용할 수 있습니다.
            </span>
          </label>
          <label className="grid gap-2 sm:grid-cols-[150px_220px_1fr] sm:items-start sm:gap-3">
            <span className="pt-2 text-xs font-semibold text-stone-600">가입 쿠폰</span>
            <select
              value={state.signupCouponTemplateId ?? ""}
              onChange={(e) => state.setSignupCouponTemplateId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            >
              <option value="">없음</option>
              {state.couponTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <span className="pt-2 text-[11px] leading-5 text-stone-500">
              회원 가입 완료 시 선택한 쿠폰이 자동으로 발급됩니다. 쿠폰은 쿠폰·적립금 탭에서 먼저 등록해주세요.
            </span>
          </label>
        </section>

        <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-stone-900">콘텐츠</h3>
          <div className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">영상 업로드</span>
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoSelect}
              disabled={uploadingVideo}
              className="mt-2 block w-full text-xs text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-lime-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white disabled:opacity-60"
            />
            <p className="text-[11px] text-stone-500">
              {uploadingVideo
                ? "영상 업로드 중..."
                : selectedVideoFile
                  ? `선택됨: ${selectedVideoFile.name} (저장 시 업로드)`
                  : "파일 선택 후 기본정보 저장 시 업로드됩니다."}
            </p>
            {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

            {videoPreview && (
              <div className="mt-3 max-w-md overflow-hidden rounded-xl border border-stone-200 bg-white">
                <div className="aspect-video w-full">
                  <iframe
                    src={videoPreview}
                    title="영상 미리보기"
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            {showDirectVideoPreview && normalizedVideoUrl && (
              <div className="mt-3 max-w-md overflow-hidden rounded-xl border border-stone-200 bg-white p-2">
                <video
                  src={normalizedVideoUrl}
                  controls
                  preload="metadata"
                  playsInline
                  className="aspect-video w-full rounded-lg bg-black"
                />
              </div>
            )}
          </div>

          <div className="block space-y-2">
            <span className="text-xs font-semibold text-stone-600">상점 이미지 (무제한)</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleStoryImageSelect}
              disabled={uploadingImage}
              className="block w-full text-xs text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-lime-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white disabled:opacity-60"
            />
            <p className="text-[11px] text-stone-500">
              {uploadingImage
                ? "이미지 업로드 중..."
                : selectedStoryImageFiles.length > 0
                  ? `${selectedStoryImageFiles.length}개 파일 선택됨 (저장 시 업로드)`
                  : "여러 이미지를 계속 추가할 수 있습니다. 파일 선택 후 저장 시 업로드됩니다."}
            </p>
            {imageUploadError && <p className="text-xs text-red-600">{imageUploadError}</p>}

            {selectedStoryImageFiles.length > 0 && (
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-2">
                <p className="text-[11px] font-semibold text-amber-800">저장 대기 이미지</p>
                {selectedStoryImageFiles.map((item, index) => (
                  <div key={`${item.file.name}-${item.file.size}-${index}`} className="rounded-lg border border-amber-200 bg-white p-2">
                    <p className="truncate text-[11px] text-stone-600">{item.file.name}</p>
                    <input
                      value={item.title}
                      onChange={(e) => handleSelectedStoryImageTitleChange(index, e.target.value)}
                      placeholder={`상점 이미지 ${state.storyImages.length + index + 1}`}
                      className="mt-1 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleSelectedStoryImageRemove(index)}
                      className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-xs font-semibold text-stone-700"
                    >
                      선택 취소
                    </button>
                  </div>
                ))}
              </div>
            )}

            {state.storyImages.length > 0 ? (
              <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                {state.storyImages.map((item, index) => (
                  <div
                    key={`${item.imageUrl}-${index}`}
                    className="w-[220px] min-w-[220px] rounded-xl border border-stone-200 p-2"
                  >
                    <img src={item.imageUrl} alt={item.title || `상점 이미지 ${index + 1}`} className="h-28 w-full rounded-lg object-cover" />
                    <input
                      value={item.title}
                      onChange={(e) => handleStoryImageTitleChange(index, e.target.value)}
                      onBlur={() => void handleStoryImageTitleBlur()}
                      placeholder={`상점 이미지 ${index + 1}`}
                      className="mt-2 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => void handleStoryImageRemove(index)}
                      className="mt-2 w-full rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-700"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-500">등록된 상점 이미지가 없습니다.</p>
            )}
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">상점 설명</span>
            <textarea
              value={state.detailDescription}
              onChange={(e) => state.setDetailDescription(e.target.value)}
              placeholder="상점 설명"
              className="h-28 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">배송/환불 정책</span>
            <textarea
              value={state.shippingRefundPolicy}
              onChange={(e) => state.setShippingRefundPolicy(e.target.value)}
              placeholder="배송/환불 정책"
              className="h-36 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-stone-500">web 배송/환불 정책 페이지에 그대로 노출됩니다.</p>
          </label>
        </section>
        <button
          type="submit"
          disabled={uploadingVideo || uploadingImage}
          className="rounded-xl bg-lime-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          기본정보 저장
        </button>
      </form>

      {uploadingVideo && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-2xl">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-lime-200 border-t-lime-600" />
            <p className="mt-3 text-sm font-semibold text-stone-800">영상 업로드 중입니다</p>
            <p className="mt-1 text-xs text-stone-500">완료될 때까지 잠시만 기다려주세요.</p>
          </div>
        </div>
      )}

      {state.configSaved && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4">
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-lime-100 text-2xl text-lime-700">
              ✓
            </div>
            <p className="mt-3 text-base font-bold text-stone-900">기본정보를 저장했습니다</p>
            <button
              type="button"
              onClick={() => state.setConfigSaved(false)}
              className="mt-4 w-full rounded-xl bg-lime-600 px-3 py-2 text-sm font-bold text-white"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
