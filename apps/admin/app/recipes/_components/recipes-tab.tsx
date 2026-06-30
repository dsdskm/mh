import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { AdminPageState } from "../../_hooks/use-admin-page";
import { saveConfigApi, uploadAdminAssetApi } from "../../_lib/api";
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
  steps: [{ description: "", imageUrl: "" }],
};

export function RecipesTab({ state }: Props) {
  const existingRecipe = useMemo(() => state.config?.recipes?.[0] ?? null, [state.config?.recipes]);
  const hasExistingRecipe = Boolean(existingRecipe);

  const [recipeForm, setRecipeForm] = useState<RecipeFormData>(INITIAL_RECIPE_FORM);
  const [selectedRecipeStepImages, setSelectedRecipeStepImages] = useState<Array<File | null>>([
    null,
  ]);
  const [uploadingRecipe, setUploadingRecipe] = useState(false);
  const [uploadingStageText, setUploadingStageText] = useState<string>("");
  const [uploadingProgressPercent, setUploadingProgressPercent] = useState(0);
  const [recipeError, setRecipeError] = useState<string | null>(null);

  useEffect(() => {
    if (!existingRecipe) {
      setRecipeForm(INITIAL_RECIPE_FORM);
      setSelectedRecipeStepImages([null]);
      return;
    }

    setRecipeForm({
      title: existingRecipe.title,
      ingredients: [...existingRecipe.ingredients],
      steps: existingRecipe.steps.map((step) => ({
        description: step.description,
        imageUrl: step.imageUrl,
      })),
    });
    setSelectedRecipeStepImages(existingRecipe.steps.map(() => null));
  }, [existingRecipe]);

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
    if (recipeForm.ingredients.length <= 1) {
      return;
    }

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

  function addRecipeStep() {
    setRecipeForm({
      ...recipeForm,
      steps: [...recipeForm.steps, { description: "", imageUrl: "" }],
    });
    setSelectedRecipeStepImages([...selectedRecipeStepImages, null]);
  }

  function removeRecipeStep(index: number) {
    if (recipeForm.steps.length <= 1) {
      return;
    }

    setRecipeForm({
      ...recipeForm,
      steps: recipeForm.steps.filter((_, i) => i !== index),
    });
    setSelectedRecipeStepImages(selectedRecipeStepImages.filter((_, i) => i !== index));
  }

  async function handleRecipeSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecipeError(null);

    const recipeTitle = recipeForm.title;
    const recipeIngredients = recipeForm.ingredients;

    if (!recipeTitle.trim()) {
      setRecipeError("레시피 이름을 입력하세요.");
      return;
    }

    if (recipeIngredients.some((ing) => !ing.trim())) {
      setRecipeError("비어있는 재료가 있습니다.");
      return;
    }

    if (recipeForm.steps.length === 0) {
      setRecipeError("최소 1개 이상의 조리 단계를 추가하세요.");
      return;
    }

    if (recipeForm.steps.some((step) => !step.description.trim())) {
      setRecipeError("비어있는 단계 설명이 있습니다.");
      return;
    }

    setUploadingRecipe(true);
    setUploadingStageText("레시피 저장 준비 중...");
    setUploadingProgressPercent(0);
    try {
      const nextSteps: StoreRecipeStep[] = recipeForm.steps.map((step) => ({ ...step }));
      const totalUnits = nextSteps.length + 1;
      let completedUnits = 0;

      for (let i = 0; i < nextSteps.length; i += 1) {
        const file = selectedRecipeStepImages[i];
        const step = nextSteps[i];
        if (file && step) {
          setUploadingStageText(`${i + 1}/${nextSteps.length} 단계 이미지 업로드 중...`);
          const { url } = await uploadAdminAssetApi(file, "recipes");
          step.imageUrl = url;
        } else {
          setUploadingStageText(`${i + 1}/${nextSteps.length} 단계 처리 중...`);
        }

        completedUnits += 1;
        setUploadingProgressPercent(Math.round((completedUnits / totalUnits) * 100));
      }

      const newRecipe: StoreRecipe = {
        title: recipeTitle,
        ingredients: recipeIngredients,
        steps: nextSteps,
      };

      if (!state.config) {
        throw new Error("기본정보를 먼저 불러온 뒤 다시 시도해주세요.");
      }

      const recipes = [newRecipe];

      setUploadingStageText("레시피 설정 저장 중...");
      await saveConfigApi({
        ...state.config,
        recipes,
      });

      completedUnits += 1;
      setUploadingProgressPercent(Math.round((completedUnits / totalUnits) * 100));

      state.setConfigSaved(false);
      if (!hasExistingRecipe) {
        setRecipeForm(INITIAL_RECIPE_FORM);
        setSelectedRecipeStepImages([null]);
      }
      state.setConfigSaved(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "레시피 저장에 실패했습니다.";
      setRecipeError(message);
    } finally {
      setUploadingStageText("");
      setUploadingProgressPercent(0);
      setUploadingRecipe(false);
    }
  }

  return (
    <>
      <h2 className="font-display text-3xl text-lime-800">레시피관리</h2>

      {existingRecipe && (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold text-stone-700">현재 레시피</h3>
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <p className="text-sm font-semibold text-stone-800">{existingRecipe.title}</p>
            <p className="text-xs text-stone-600">
              단일 레시피 모드입니다. 재료/조리 단계를 모두 수정할 수 있습니다.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {existingRecipe.steps.map((step, stepIdx) => (
                <div key={`existing-${stepIdx}`} className="flex gap-3 rounded-lg border border-stone-200 bg-white p-3">
                  <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-md bg-stone-100">
                    {step.imageUrl ? (
                      <img
                        src={step.imageUrl}
                        alt={`${existingRecipe.title} ${stepIdx + 1}단계 이미지`}
                        className="h-full w-full object-cover rounded-md"
                      />
                    ) : (
                      <span className="text-[11px] text-stone-500">이미지 없음</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-stone-700">{stepIdx + 1}단계</p>
                    <p className="mt-1 text-xs text-stone-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={(event) => void handleRecipeSave(event)}
        className="mt-4 space-y-4 rounded-lg border border-stone-200 bg-stone-50 p-4"
      >
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-stone-600">레시피 이름</span>
          <input
            type="text"
            value={recipeForm.title}
            onChange={(e) => setRecipeForm({ ...recipeForm, title: e.target.value })}
            disabled={hasExistingRecipe}
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
        </label>

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
                  x
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="block text-xs font-semibold text-stone-600">조리 단계 ({recipeForm.steps.length}단계)</span>
            <button
              type="button"
              onClick={addRecipeStep}
              className="text-xs font-semibold text-lime-600 hover:text-lime-700"
            >
              + 단계 추가
            </button>
          </div>
          {recipeForm.steps.map((step, idx) => (
            <div key={idx} className="space-y-2 rounded-lg border border-stone-300 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="block text-xs font-semibold text-stone-700">{idx + 1}단계</span>
                {recipeForm.steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRecipeStep(idx)}
                    className="rounded-lg bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-200"
                  >
                    단계 삭제
                  </button>
                )}
              </div>
              <textarea
                value={step.description}
                onChange={(e) => handleRecipeStepDescriptionChange(idx, e.target.value)}
                placeholder={`${idx + 1}단계 설명`}
                className="h-16 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
              />
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-stone-600">이미지 (선택)</label>
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
                {!selectedRecipeStepImages[idx] && <p className="text-[11px] text-stone-500">이미지 없이 저장할 수 있습니다.</p>}
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

      {uploadingRecipe && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-lime-200 border-t-lime-600" />
            <p className="mt-3 text-sm font-semibold text-stone-800">레시피 저장 중입니다</p>
            <p className="mt-1 text-xs text-stone-500">{uploadingStageText || "처리 중..."}</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-stone-200">
              <div
                className="h-full rounded-full bg-lime-600 transition-all duration-300"
                style={{ width: `${uploadingProgressPercent}%` }}
              />
            </div>
            <p className="mt-1 text-xs font-semibold text-lime-700">{uploadingProgressPercent}%</p>
          </div>
        </div>
      )}

      {state.configSaved && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-lime-100 text-2xl text-lime-700">
              ✓
            </div>
            <p className="mt-3 text-base font-bold text-stone-900">레시피를 저장했습니다</p>
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
