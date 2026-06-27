import { ChangeEvent, FormEvent, useState } from "react";
import { AdminPageState } from "../../_hooks/use-admin-page";

export type CreateProductForm = {
  name: string;
  description: string;
  price: number;
  stock: number;
  totalQuantity: number;
  imageUrl: string;
  badge: string;
  active: boolean;
};

type Props = {
  open: boolean;
  submitting: boolean;
  state: AdminPageState;
  onClose: () => void;
  onRequestConfirm: (form: CreateProductForm, selectedImageFile: File) => void;
};

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export function ProductCreateModal({ open, submitting, state, onClose, onRequestConfirm }: Props) {
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  const stock = parseNumber(state.newStock);
  const totalQuantity = parseNumber(state.newTotalQuantity);
  const isStockOverTotal = stock !== null && totalQuantity !== null && stock > totalQuantity;

  function handleImageSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSelectedImageFile(file || null);
    setUploadError(null);
    event.target.value = "";
  }

  async function submitCreateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isStockOverTotal) {
      return;
    }

    if (!selectedImageFile) {
      setUploadError("이미지 파일을 선택해주세요.");
      return;
    }

    setUploadError(null);

    onRequestConfirm({
      name: state.newName,
      description: state.newDescription,
      price: Number(state.newPrice),
      stock: Number(state.newStock),
      totalQuantity: Number(state.newTotalQuantity),
      imageUrl: "",
      badge: state.newBadge,
      active: state.newProductPublic,
    }, selectedImageFile);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-stone-900">상품 등록</h3>

        <form onSubmit={submitCreateProduct} className="mt-4 space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">상품명</span>
            <input
              value={state.newName}
              onChange={(event) => state.setNewName(event.target.value)}
              placeholder="상품명"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">상품 설명</span>
            <textarea
              value={state.newDescription}
              onChange={(event) => state.setNewDescription(event.target.value)}
              placeholder="상품 설명"
              className="h-20 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              required
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-stone-600">가격</span>
              <input
                type="number"
                min={0}
                value={state.newPrice}
                onChange={(event) => state.setNewPrice(event.target.value)}
                placeholder="가격"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-stone-600">총 수량</span>
              <input
                type="number"
                min={0}
                value={state.newTotalQuantity}
                onChange={(event) => state.setNewTotalQuantity(event.target.value)}
                placeholder="총 수량"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-stone-600">재고</span>
              <input
                type="number"
                min={0}
                value={state.newStock}
                onChange={(event) => state.setNewStock(event.target.value)}
                placeholder="재고"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                required
              />
            </label>
          </div>

          {isStockOverTotal && (
            <p className="-mt-1 text-xs font-medium text-red-600">
              재고는 총 수량보다 클 수 없습니다.
            </p>
          )}

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">상품 이미지</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => void handleImageSelect(event)}
              disabled={submitting}
              className="block w-full text-xs text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-lime-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white disabled:opacity-60"
            />
            <p className="text-[11px] text-stone-500">
              {selectedImageFile ? `선택됨: ${selectedImageFile.name}` : "이미지 파일을 선택해주세요."}
            </p>
            {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-stone-600">배지</span>
              <input
                value={state.newBadge}
                onChange={(event) => state.setNewBadge(event.target.value)}
                placeholder="배지"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                required
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-stone-600">공개 여부</span>
              <select
                value={state.newProductPublic ? "public" : "private"}
                onChange={(event) => state.setNewProductPublic(event.target.value === "public")}
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              >
                <option value="public">공개</option>
                <option value="private">비공개</option>
              </select>
            </label>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold text-stone-700 disabled:opacity-60"
            >
              닫기
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-xl bg-lime-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              상품 등록
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
