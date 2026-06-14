import { DependencyList, useEffect, useMemo, useState } from "react";

type UsePersistedPaginationOptions = {
  storageKey: string;
  totalItems: number;
  pageSizeOptions?: number[];
  initialPageSize?: number;
  resetDeps?: DependencyList;
};

export function usePersistedPagination({
  storageKey,
  totalItems,
  pageSizeOptions = [20, 50, 100],
  initialPageSize,
  resetDeps = [],
}: UsePersistedPaginationOptions) {
  const defaultPageSize = initialPageSize ?? pageSizeOptions[0] ?? 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const pageSizeStorageKey = `${storageKey}:size`;

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalItems / pageSize)), [totalItems, pageSize]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return;
    }

    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed >= 1) {
      setCurrentPage(parsed);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(pageSizeStorageKey);
    if (!raw) {
      return;
    }

    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed >= 1 && pageSizeOptions.includes(parsed)) {
      setPageSize(parsed);
    }
  }, [pageSizeStorageKey, pageSizeOptions]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(storageKey, String(currentPage));
  }, [storageKey, currentPage]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(pageSizeStorageKey, String(pageSize));
  }, [pageSizeStorageKey, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, resetDeps);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    pageSize,
    setPageSize,
    pageSizeOptions,
    startIndex,
    endIndex,
  };
}
