type Props = {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize: number;
  pageSizeOptions: number[];
  onPageSizeChange: (size: number) => void;
  onPageChange: (page: number) => void;
};

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  onPageChange,
}: Props) {
  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <p className="text-xs text-stone-500">
        {`총 ${totalItems ?? 0}건 · ${safeCurrentPage}/${safeTotalPages}페이지`}
      </p>
      <div className="flex flex-wrap items-center gap-2 sm:justify-center">
        <label className="flex items-center gap-1 text-xs text-stone-500">
          <span>보기</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-lg border border-stone-300 px-2 py-1 text-xs text-stone-700"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span>개씩</span>
        </label>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
          disabled={safeCurrentPage === 1}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-600 disabled:opacity-50"
        >
          이전
        </button>
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
          {Array.from({ length: safeTotalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                page === safeCurrentPage
                  ? "bg-lime-600 text-white"
                  : "border border-stone-300 text-stone-600 hover:bg-stone-50"
              }`}
            >
              {page}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(safeTotalPages, safeCurrentPage + 1))}
          disabled={safeCurrentPage === safeTotalPages}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-600 disabled:opacity-50"
        >
          다음
        </button>
      </div>
    </div>
  );
}
