import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { AdminPageState } from "../../_hooks/use-admin-page";
import { uploadAdminAssetApi } from "../../_lib/api";
import { StoreRecipe, StoreRecipeStep } from "../../_lib/types";

type Props = {
  state: AdminPageState;
};

type RecipeFormData = {
  title: string;
  ingredients: string[];
  steps: Array<{
    description: string;
    imageUrl: string;
  }>;
};

const INITIAL_RECIPE_FORM: RecipeFormData = {
  title: "",
  ingredients: [""],
  steps: [
    { description: "", imageUrl: "" },
    { description: "", imageUrl: "" },
    { description: "", imageUrl: "" },
    { description: "", imageUrl: "" },
  ],
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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);

  // 레시피 폼 상태
  const [recipeForm, setRecipeForm] = useState<RecipeFormData>(INITIAL_RECIPE_FORM);
  const [selectedRecipeStepImages, setSelectedRecipeStepImages] = useState<Array<File | null>>([null, null, null, null]);
  const [uploadingRecipe, setUploadingRecipe] = useState(false);
  const [recipeError, setRecipeError] = useState<string | null>(null);

  const videoPreview = useMemo(() => {
    const normalized = normalizeUrl(state.videoUrl);
    if (!normalized) {
      return null;
    }

    try {
      const parsed = new URL(normalized);
      const videoId = pickYouTubeVideoId(parsed);
      if (videoId) {
        return {
          type: "embed" as const,
          src: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0`,
        };
      }

      return {
        type: "video" as const,
        src: normalized,
      };
    } catch {
      return null;
    }
  }, [state.videoUrl]);

  function handleVideoSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setUploadError(null);
    setSelectedVideoFile(file ?? null);
  }

  function handleRecipeIngredientChange(index: number, value: string) {
    const nextIngredients = [...recipeForm.ingredients];
    nextIngredients[index] = value;
    setRecipeForm({ ...recipeForm, ingredients: nextIngredients });
  }

  function addRecipeIngredient() {
    setRecipeForm({
      ...recipeForm,
      ingredients: [...recipeForm.ingredients, ""],
    });
  }

  function removeRecipeIngredient(index: number) {
    setRecipeForm({
      ...recipeForm,
      ingredients: recipeForm.ingredients.filter((_, i) => i !== index),
    });
  }

  function handleRecipeStepDescriptionChange(index: number, value: string) {
    const nextSteps = recipeForm.steps.map((step) => ({ ...step }));
    if (nextSteps[index]) {
      nextSteps[index].description = value;
    }
    setRecipeForm({ ...recipeForm, steps: nextSteps });
  }

  function handleRecipeStepImageSelect(index: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    const nextImages = [...selectedRecipeStepImages];
    nextImages[index] = file;
    setSelectedRecipeStepImages(nextImages);
  }

  async function handleRecipeSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecipeError(null);

    if (!recipeForm.title.trim()) {
      setRecipeError("레시피 이름을 입력하세요.");
      return;
    }

    if (recipeForm.ingredients.some((ing) => !ing.trim())) {
      setRecipeError("비어있는 재료가 있습니다.");
      return;
    }

    if (recipeForm.steps.some((step) => !step.description.trim())) {
      setRecipeError("비어있는 단계 설명이 있습니다.");
      return;
    }

    setUploadingRecipe(true);
    try {
      // 선택된 이미지 업로드
      const nextSteps: StoreRecipeStep[] = recipeForm.steps.map((step) => ({ ...step }));
      for (let i = 0; i < selectedRecipeStepImages.length; i++) {
        const file = selectedRecipeStepImages[i];
        const step = nextSteps[i];
        if (file && step) {
          const { url } = await uploadAdminAssetApi(file, "recipes");
          step.imageUrl = url;
        }
      }

      // 새 레시피 추가
      const newRecipe: StoreRecipe = {
        title: recipeForm.title,
        ingredients: recipeForm.ingredients,
        steps: nextSteps,
      };

      const recipes = [...(state.config?.recipes ?? []), newRecipe];

      // 설정 저장 (현재는 config 저장만 필요)
      // 임시로 직접 API 호출
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/backoffice/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipes }),
      });

      setRecipeForm(INITIAL_RECIPE_FORM);
      setSelectedRecipeStepImages([null, null, null, null]);
      state.setConfigSaved(true);
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "레시피 저장에 실패했습니다.";
      setRecipeError(message);
    } finally {
      setUploadingRecipe(false);
    }
  }

  async function handleRecipeDelete(index: number) {
    if (!state.config?.recipes || !state.config.recipes[index]) return;
    if (!confirm(`"${state.config.recipes[index]?.title}" 레시피를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const recipes = state.config.recipes.filter((_, i) => i !== index);
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/backoffice/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipes }),
      });

      state.setConfigSaved(true);
      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : "레시피 삭제에 실패했습니다.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);

    if (!selectedVideoFile) {
      await state.saveConfig(event, { videoUrl: state.videoUrl });
      return;
    }

    let nextVideoUrl = state.videoUrl;
    setUploadingVideo(Boolean(selectedVideoFile));
    try {
      if (selectedVideoFile) {
        const { url } = await uploadAdminAssetApi(selectedVideoFile, "videos");
        nextVideoUrl = url;
        state.setVideoUrl(url);
      }

      await state.saveConfig(event, { videoUrl: nextVideoUrl });
      setSelectedVideoFile(null);
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "파일 업로드에 실패했습니다.";
      setUploadError(message);
      event.preventDefault();
    } finally {
      setUploadingVideo(false);
    }
  }

  return (
    <>
      <h2 className="font-display text-3xl text-lime-800">기본정보</h2>
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">상점명</span>
            <input value={state.shopName} onChange={(e) => state.setShopName(e.target.value)} placeholder="상점명" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">판매자명</span>
            <input value={state.sellerName} onChange={(e) => state.setSellerName(e.target.value)} placeholder="판매자명" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">연락처</span>
            <input value={state.sellerPhone} onChange={(e) => state.setSellerPhone(e.target.value)} placeholder="연락처" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">원산지</span>
            <input value={state.origin} onChange={(e) => state.setOrigin(e.target.value)} placeholder="원산지" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">은행명</span>
            <input value={state.bankName} onChange={(e) => state.setBankName(e.target.value)} placeholder="은행명" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">계좌번호</span>
            <input value={state.accountNumber} onChange={(e) => state.setAccountNumber(e.target.value)} placeholder="계좌번호" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">예금주</span>
            <input value={state.accountHolder} onChange={(e) => state.setAccountHolder(e.target.value)} placeholder="예금주" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">입금 기한 (일)</span>
            <input
              type="number"
              min={0}
              value={state.paymentDueDays}
              onChange={(e) => state.setPaymentDueDays(e.target.value)}
              placeholder="예: 3 (0이면 기한 없음)"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
            <span className="block text-[11px] text-stone-500">주문 후 이 일수가 지나도록 미입금이면 자동으로 취소됩니다. 0이면 자동 취소하지 않습니다.</span>
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
              <span className="text-[11px] text-stone-600">배송료 청구 (체크 시 주문 금액에 배송료가 더해집니다)</span>
            </span>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">회원 주문 포함 상품 (무료 사은품)</span>
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
            <span className="block text-[11px] text-stone-500">회원(로그인) 주문 시 선택한 상품이 0원 사은품으로 함께 발송됩니다. 재고는 차감되지 않으며, 매장에 노출하고 싶지 않으면 상품관리에서 비노출(숨김) 상태로 등록해도 사은품으로 사용할 수 있습니다.</span>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">적립금 적립률 (%)</span>
            <input
              type="number"
              min={0}
              value={state.mileageEarnRate}
              onChange={(e) => state.setMileageEarnRate(e.target.value)}
              placeholder="예: 5 (0이면 적립 안 함)"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
            <span className="block text-[11px] text-stone-500">회원 주문이 배송완료되면 결제 금액의 이 비율만큼 적립금이 자동 적립됩니다. 0이면 자동 적립하지 않습니다.</span>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">영상 URL</span>
            <input value={state.videoUrl} onChange={(e) => state.setVideoUrl(e.target.value)} placeholder="영상 URL" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
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
              <div className="mt-3 overflow-hidden rounded-xl border border-stone-200 bg-white">
                <div className="aspect-video w-full">
                  {videoPreview.type === "embed" ? (
                    <iframe
                      src={videoPreview.src}
                      title="영상 미리보기"
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={videoPreview.src}
                      className="h-full w-full object-cover"
                      controls
                      muted
                      playsInline
                    />
                  )}
                </div>
              </div>
            )}
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-stone-600">입금 안내</span>
          <textarea value={state.transferNote} onChange={(e) => state.setTransferNote(e.target.value)} placeholder="입금 안내" className="h-20 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-stone-600">상품 상세 설명</span>
          <textarea value={state.detailDescription} onChange={(e) => state.setDetailDescription(e.target.value)} placeholder="상품 상세 설명" className="h-28 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
        </label>
        <button type="submit" disabled={uploadingVideo} className="rounded-xl bg-lime-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">기본정보 저장</button>
      </form>

      {/* 레시피 입력 섹션 */}
      <div className="mt-8 space-y-4 border-t border-stone-300 pt-8">
        <h2 className="font-display text-3xl text-lime-800">레시피</h2>

        {/* 기존 레시피 목록 */}
        {state.config?.recipes && state.config.recipes.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-stone-700">저장된 레시피</h3>
            <div className="space-y-2">
              {state.config.recipes.map((recipe, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-800">{recipe.title}</p>
                    <p className="text-xs text-stone-600">{recipe.steps.length}단계 · {recipe.ingredients.length}개 재료</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRecipeDelete(idx)}
                    className="rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-200"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 레시피 입력 폼 */}
        <form onSubmit={(event) => void handleRecipeSave(event)} className="space-y-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">레시피 이름</span>
            <input
              type="text"
              value={recipeForm.title}
              onChange={(e) => setRecipeForm({ ...recipeForm, title: e.target.value })}
              placeholder="예: 무순 초절임"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </label>

          {/* 재료 입력 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-600">재료</span>
              <button
                type="button"
                onClick={addRecipeIngredient}
                className="text-xs font-semibold text-lime-600 hover:text-lime-700"
              >
                + 추가
              </button>
            </div>
            {recipeForm.ingredients.map((ingredient, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={ingredient}
                  onChange={(e) => handleRecipeIngredientChange(idx, e.target.value)}
                  placeholder={`재료 ${idx + 1}`}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                />
                {recipeForm.ingredients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRecipeIngredient(idx)}
                    className="rounded-lg bg-red-100 px-2 py-2 text-xs text-red-700 hover:bg-red-200"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* 4단계 입력 */}
          <div className="space-y-3">
            <span className="block text-xs font-semibold text-stone-600">조리 단계 (4단계)</span>
            {recipeForm.steps.map((step, idx) => (
              <div key={idx} className="space-y-2 rounded-lg border border-stone-300 bg-white p-3">
                <span className="block text-xs font-semibold text-stone-700">{idx + 1}단계</span>
                <textarea
                  value={step.description}
                  onChange={(e) => handleRecipeStepDescriptionChange(idx, e.target.value)}
                  placeholder={`${idx + 1}단계 설명`}
                  className="h-16 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
                />
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-stone-600">이미지</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleRecipeStepImageSelect(idx, e)}
                    disabled={uploadingRecipe}
                    className="block w-full text-xs text-stone-600 file:mr-2 file:rounded-lg file:border-0 file:bg-lime-600 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white disabled:opacity-60"
                  />
                  {selectedRecipeStepImages[idx] && (
                    <p className="text-[11px] text-stone-500">선택됨: {selectedRecipeStepImages[idx]!.name}</p>
                  )}
                  {step.imageUrl && !selectedRecipeStepImages[idx] && (
                    <p className="text-[11px] text-lime-600">이미지 저장됨 ✓</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {recipeError && <p className="text-xs text-red-600">{recipeError}</p>}
          <button
            type="submit"
            disabled={uploadingRecipe}
            className="w-full rounded-xl bg-lime-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {uploadingRecipe ? "레시피 저장 중..." : "레시피 저장"}
          </button>
        </form>
      </div>

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
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
          onClick={() => state.setConfigSaved(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-lime-100 text-2xl text-lime-700">✓</div>
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
