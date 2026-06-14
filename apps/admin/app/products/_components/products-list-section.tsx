import { formatCurrency } from "../../_lib/constants";
import { Product } from "../../_lib/types";

type ActiveFilter = "all" | "public" | "private";

type Props = {
  searchQuery: string;
  activeFilter: ActiveFilter;
  products: Product[];
  onSearchQueryChange: (value: string) => void;
  onActiveFilterChange: (value: ActiveFilter) => void;
  onOpenCreateModal: () => void;
  onSelectProduct: (id: number) => void;
};

export function ProductsListSection({
  searchQuery,
  activeFilter,
  products,
  onSearchQueryChange,
  onActiveFilterChange,
  onOpenCreateModal,
  onSelectProduct,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-3xl text-lime-800">상품관리</h2>
        <button
          type="button"
          onClick={onOpenCreateModal}
          className="rounded-xl bg-lime-600 px-4 py-2 text-sm font-bold text-white"
        >
          + 상품 등록
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="상품명·아이디·배지 검색"
          className="min-w-40 flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm"
        />
        <select
          value={activeFilter}
          onChange={(event) => onActiveFilterChange(event.target.value as ActiveFilter)}
          className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
        >
          <option value="all">전체 상태</option>
          <option value="public">공개</option>
          <option value="private">비공개</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full bg-white text-sm">
          <thead className="bg-stone-50 text-xs font-semibold text-stone-600">
            <tr>
              <th className="px-3 py-2 text-left">아이디</th>
              <th className="px-3 py-2 text-left">이미지</th>
              <th className="px-3 py-2 text-left">상품명</th>
              <th className="px-3 py-2 text-left">가격</th>
              <th className="px-3 py-2 text-left">총 수량</th>
              <th className="px-3 py-2 text-left">재고</th>
              <th className="px-3 py-2 text-left">공개</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-stone-400">결과 없음</td>
              </tr>
            )}
            {products.map((product) => (
              <tr
                key={product.id}
                className="cursor-pointer hover:bg-stone-50"
                onClick={() => onSelectProduct(product.id)}
              >
                <td className="px-3 py-2 text-xs text-stone-500">#{product.id}</td>
                <td className="px-3 py-2">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-10 w-10 rounded-lg border border-stone-200 object-cover"
                  />
                </td>
                <td className="px-3 py-2 font-medium text-stone-900">{product.name}</td>
                <td className="px-3 py-2 text-stone-700">{formatCurrency(product.price)}</td>
                <td className="px-3 py-2 text-stone-700">{product.totalQuantity}</td>
                <td className="px-3 py-2 text-stone-700">{product.stock}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      product.active ? "bg-lime-100 text-lime-800" : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {product.active ? "공개" : "비공개"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
