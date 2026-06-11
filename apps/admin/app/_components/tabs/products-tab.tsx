import { FormEvent, useMemo, useState } from "react";
import { AdminPageState } from "../../_hooks/use-admin-page";
import { formatCurrency } from "../../_lib/constants";
import { ProductCreateModal, CreateProductForm } from "./product-create-modal";
import { ProductsListSection } from "./products-list-section";

type Props = {
  state: AdminPageState;
};

type EditForm = {
  id: number;
  name: string;
  description: string;
  price: string;
  stock: string;
  totalQuantity: string;
  imageUrl: string;
  badge: string;
  active: boolean;
};

type ConfirmAction = 
  | { kind: "create"; form: CreateProductForm }
  | { kind: "update"; id: number; form: EditForm }
  | { kind: "delete"; id: number; name: string };

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

export function ProductsTab({ state }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "public" | "private">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailProductId, setDetailProductId] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState<EditForm | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return [...state.products].filter((product) => {
      if (activeFilter === "public" && !product.active) {
        return false;
      }

      if (activeFilter === "private" && product.active) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [String(product.id), product.name, product.badge].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [state.products, searchQuery, activeFilter]);

  const detailProduct = useMemo(
    () => state.products.find((product) => product.id === detailProductId) ?? null,
    [state.products, detailProductId],
  );

  const isEditingStockOverTotal = useMemo(() => {
    if (!editingForm) {
      return false;
    }

    const stock = parseNumber(editingForm.stock);
    const totalQuantity = parseNumber(editingForm.totalQuantity);
    return stock !== null && totalQuantity !== null && stock > totalQuantity;
  }, [editingForm]);

  function openCreateModal() {
    state.setNewName("");
    state.setNewDescription("");
    state.setNewPrice("9900");
    state.setNewStock("50");
    state.setNewTotalQuantity("50");
    state.setNewImageUrl("");
    state.setNewBadge("NEW");
    state.setNewProductPublic(true);
    setShowCreateModal(true);
  }

  function requestCreateConfirmation(form: CreateProductForm) {
    setConfirmAction({ kind: "create", form });
    setConfirmError(null);
  }

  function openEditModal() {
    if (!detailProduct) {
      return;
    }

    const form: EditForm = {
      id: detailProduct.id,
      name: detailProduct.name,
      description: detailProduct.description,
      price: String(detailProduct.price),
      stock: String(detailProduct.stock),
      totalQuantity: String(detailProduct.totalQuantity),
      imageUrl: detailProduct.imageUrl,
      badge: detailProduct.badge,
      active: detailProduct.active,
    };

    setEditingForm(form);
    setDetailProductId(null);
    setConfirmError(null);
  }

  function requestDeleteConfirmation() {
    if (!detailProduct) {
      return;
    }

    setConfirmAction({
      kind: "delete",
      id: detailProduct.id,
      name: detailProduct.name,
    });
    setConfirmError(null);
  }

  async function executeConfirmedAction() {
    if (!confirmAction) {
      return;
    }

    setSubmitting(true);
    setConfirmError(null);
    try {
      if (confirmAction.kind === "create") {
        await state.createProduct(confirmAction.form);
        setShowCreateModal(false);
      } else if (confirmAction.kind === "update") {
        const form = confirmAction.form;
        await state.updateProduct(form.id, {
          name: form.name,
          description: form.description,
          price: Number(form.price),
          stock: Number(form.stock),
          totalQuantity: Number(form.totalQuantity),
          imageUrl: form.imageUrl,
          badge: form.badge,
          active: form.active,
        });
        setDetailProductId(null);
        setEditingForm(null);
      } else {
        await state.deleteProduct(confirmAction.id);
        setDetailProductId(null);
      }

      setConfirmAction(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "처리에 실패했습니다.";
      setConfirmError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEditProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingForm) {
      return;
    }

    if (isEditingStockOverTotal) {
      return;
    }

    setConfirmAction({
      kind: "update",
      id: editingForm.id,
      form: editingForm,
    });
    setConfirmError(null);
  }

  return (
    <>
      <ProductsListSection
        searchQuery={searchQuery}
        activeFilter={activeFilter}
        products={filteredProducts}
        onSearchQueryChange={setSearchQuery}
        onActiveFilterChange={setActiveFilter}
        onOpenCreateModal={openCreateModal}
        onSelectProduct={setDetailProductId}
      />

      {detailProduct && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetailProductId(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-stone-900">{detailProduct.name}</h3>
                <p className="mt-0.5 text-xs text-stone-500">#{detailProduct.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailProductId(null)}
                className="rounded-lg border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-600"
              >
                닫기
              </button>
            </div>

            <img
              src={detailProduct.imageUrl}
              alt={detailProduct.name}
              className="mt-4 h-48 w-full rounded-xl border border-stone-200 object-cover"
            />

            <dl className="mt-4 space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-x-3 gap-y-2">
                <div>
                  <dt className="text-xs font-semibold text-stone-500">가격</dt>
                  <dd className="mt-0.5 text-stone-800">{formatCurrency(detailProduct.price)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-stone-500">총 수량</dt>
                  <dd className="mt-0.5 text-stone-800">{detailProduct.totalQuantity}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-stone-500">재고</dt>
                  <dd className="mt-0.5 text-stone-800">{detailProduct.stock}</dd>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-xs font-semibold text-stone-500">배지</dt>
                <dd className="mt-0.5 text-stone-800">{detailProduct.badge}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-stone-500">공개</dt>
                <dd className="mt-0.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      detailProduct.active ? "bg-lime-100 text-lime-800" : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {detailProduct.active ? "공개" : "비공개"}
                  </span>
                </dd>
              </div>
              </div>
            </dl>

            <div className="mt-4 rounded-xl bg-stone-50 p-3">
              <p className="text-xs font-semibold text-stone-500">상품 설명</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">{detailProduct.description}</p>
            </div>

            <div className="mt-4 rounded-xl bg-stone-50 p-3">
              <p className="text-xs font-semibold text-stone-500">이미지 URL</p>
              <p className="mt-1 break-all text-xs text-stone-700">{detailProduct.imageUrl}</p>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={openEditModal}
                className="flex-1 rounded-xl border border-lime-300 bg-lime-50 px-4 py-2.5 text-sm font-bold text-lime-800"
              >
                수정
              </button>
              <button
                type="button"
                onClick={requestDeleteConfirmation}
                disabled={submitting}
                className="flex-1 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 disabled:opacity-60"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      <ProductCreateModal
        open={showCreateModal}
        submitting={submitting}
        state={state}
        onClose={() => setShowCreateModal(false)}
        onRequestConfirm={requestCreateConfirmation}
      />

      {editingForm && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          onClick={() => !submitting && setEditingForm(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-stone-900">상품 수정</h3>

            <form onSubmit={submitEditProduct} className="mt-4 space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-stone-600">상품명</span>
                <input
                  value={editingForm.name}
                  onChange={(event) => setEditingForm((prev) => prev ? { ...prev, name: event.target.value } : prev)}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                  required
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-stone-600">상품 설명</span>
                <textarea
                  value={editingForm.description}
                  onChange={(event) => setEditingForm((prev) => prev ? { ...prev, description: event.target.value } : prev)}
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
                    value={editingForm.price}
                    onChange={(event) => setEditingForm((prev) => prev ? { ...prev, price: event.target.value } : prev)}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                    required
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-stone-600">총 수량</span>
                  <input
                    type="number"
                    min={0}
                    value={editingForm.totalQuantity}
                    onChange={(event) => setEditingForm((prev) => prev ? { ...prev, totalQuantity: event.target.value } : prev)}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                    required
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-stone-600">재고</span>
                  <input
                    type="number"
                    min={0}
                    value={editingForm.stock}
                    onChange={(event) => setEditingForm((prev) => prev ? { ...prev, stock: event.target.value } : prev)}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                    required
                  />
                </label>
              </div>

              {isEditingStockOverTotal && (
                <p className="-mt-1 text-xs font-medium text-red-600">
                  재고는 총 수량보다 클 수 없습니다.
                </p>
              )}

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-stone-600">이미지 URL</span>
                <input
                  value={editingForm.imageUrl}
                  onChange={(event) => setEditingForm((prev) => prev ? { ...prev, imageUrl: event.target.value } : prev)}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                  required
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-stone-600">배지</span>
                  <input
                    value={editingForm.badge}
                    onChange={(event) => setEditingForm((prev) => prev ? { ...prev, badge: event.target.value } : prev)}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                    required
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-stone-600">공개 여부</span>
                  <select
                    value={editingForm.active ? "public" : "private"}
                    onChange={(event) => setEditingForm((prev) => prev ? { ...prev, active: event.target.value === "public" } : prev)}
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
                  onClick={() => setEditingForm(null)}
                  disabled={submitting}
                  className="flex-1 rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold text-stone-700 disabled:opacity-60"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-lime-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {submitting ? "처리 중..." : "상품 수정"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmAction && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
          onClick={() => !submitting && setConfirmAction(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 className="text-base font-bold text-stone-900">
              {confirmAction.kind === "create"
                ? "상품 등록 확인"
                : confirmAction.kind === "update"
                  ? "상품 수정 확인"
                  : "상품 삭제 확인"}
            </h4>
            <p className="mt-2 text-sm text-stone-600">
              {confirmAction.kind === "create"
                ? `상품 \"${confirmAction.form.name}\"을(를) 등록할까요?`
                : confirmAction.kind === "update"
                  ? `상품 #${confirmAction.id} 정보를 수정할까요?`
                  : `상품 \"${confirmAction.name}\"을(를) 삭제할까요?`}
            </p>
            {confirmError && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {confirmError}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={submitting}
                className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void executeConfirmedAction()}
                disabled={submitting}
                className="flex-1 rounded-xl bg-lime-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {submitting ? "처리 중..." : "확인"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
