"use client";

import { Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useState } from "react";
import {
  createAdminNoticeApi,
  deleteAdminNoticeApi,
  getAdminNoticesApi,
  NoticePayload,
  updateAdminNoticeApi,
} from "../../_lib/api";
import { Notice } from "../../_lib/types";
import { PaginationControls } from "../../_components/pagination-controls";
import { usePersistedPagination } from "../../_hooks/use-persisted-pagination";

type NoticeForm = {
  title: string;
  content: string;
  isImportant: boolean;
  isPublished: boolean;
  popupStartAt: string;
  popupEndAt: string;
};

const EMPTY_FORM: NoticeForm = {
  title: "",
  content: "",
  isImportant: false,
  isPublished: true,
  popupStartAt: "",
  popupEndAt: "",
};

function toInputDateTime(value?: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function toIsoOrNull(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function toNoticePayload(form: NoticeForm): NoticePayload {
  return {
    title: form.title.trim(),
    content: form.content.trim(),
    isImportant: form.isImportant,
    isPublished: form.isPublished,
    popupStartAt: form.isImportant ? toIsoOrNull(form.popupStartAt) : null,
    popupEndAt: form.isImportant ? toIsoOrNull(form.popupEndAt) : null,
  };
}

export function NoticesTab() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState<NoticeForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState<NoticeForm>(EMPTY_FORM);

  useEffect(() => {
    async function loadNotices() {
      setLoading(true);
      setError(null);
      try {
        const data = await getAdminNoticesApi();
        setNotices(data);
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "공지사항 목록을 불러오지 못했습니다.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void loadNotices();
  }, []);

  const sortedNotices = useMemo(
    () => [...notices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notices],
  );

  const { currentPage, setCurrentPage, totalPages, pageSize, setPageSize, pageSizeOptions, startIndex, endIndex } = usePersistedPagination({
    storageKey: "admin:pagination:notices",
    totalItems: sortedNotices.length,
    pageSizeOptions: [20, 50, 100],
  });

  const paginatedNotices = sortedNotices.slice(startIndex, endIndex);

  function startEdit(item: Notice) {
    setEditingId(item.id);
    setEditingForm({
      title: item.title,
      content: item.content,
      isImportant: item.isImportant,
      isPublished: item.isPublished,
      popupStartAt: toInputDateTime(item.popupStartAt),
      popupEndAt: toInputDateTime(item.popupEndAt),
    });
    setError(null);
    setNoticeMessage(null);
  }

  function openCreateModal() {
    setCreateForm(EMPTY_FORM);
    setShowCreateModal(true);
    setError(null);
    setNoticeMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingForm(EMPTY_FORM);
  }

  async function createNotice() {
    setSaving(true);
    setError(null);
    setNoticeMessage(null);
    try {
      const created = await createAdminNoticeApi(toNoticePayload(createForm));
      setNotices((prev) => [created, ...prev]);
      setCreateForm(EMPTY_FORM);
      setShowCreateModal(false);
      setNoticeMessage("공지사항을 등록했습니다.");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "공지사항 등록에 실패했습니다.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editingId) {
      return;
    }

    setSaving(true);
    setError(null);
    setNoticeMessage(null);
    try {
      const updated = await updateAdminNoticeApi(editingId, toNoticePayload(editingForm));
      setNotices((prev) => prev.map((item) => (item.id === editingId ? updated : item)));
      setNoticeMessage("공지사항을 수정했습니다.");
      cancelEdit();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "공지사항 수정에 실패했습니다.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteNotice(id: number) {

    setSaving(true);
    setError(null);
    setNoticeMessage(null);
    try {
      await deleteAdminNoticeApi(id);
      setNotices((prev) => prev.filter((item) => item.id !== id));
      if (editingId === id) {
        cancelEdit();
      }
      setNoticeMessage("공지사항을 삭제했습니다.");
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "공지사항 삭제에 실패했습니다.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteNotice() {
    if (!deleteTargetId) {
      return;
    }

    await deleteNotice(deleteTargetId);
    setDeleteTargetId(null);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl text-lime-800">공지사항</h2>
          <p className="mt-1 text-xs text-stone-500">웹 공지 및 긴급 팝업 게시를 관리합니다.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-xl bg-lime-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-lime-700"
        >
          + 공지 등록
        </button>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {noticeMessage && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{noticeMessage}</p>}

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-stone-600">공지사항 불러오는 중...</p>
        ) : sortedNotices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center text-sm text-stone-500">
            등록된 공지사항이 없습니다.
          </div>
        ) : (
          paginatedNotices.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border bg-white p-4 transition hover:shadow-md ${
                item.isImportant ? "border-amber-300" : "border-stone-200"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-stone-900">{item.title}</p>
                {item.isPublished ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">게시중</span>
                ) : (
                  <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-bold text-stone-600">비공개</span>
                )}
                {item.isImportant && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">긴급</span>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">{item.content}</p>
              <p className="mt-1 text-xs text-stone-500">
                생성 {new Date(item.createdAt).toLocaleString()} · 수정 {new Date(item.updatedAt).toLocaleString()}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  disabled={saving}
                  className="rounded-lg border border-lime-300 bg-lime-50 px-3 py-1.5 text-xs font-bold text-lime-800 transition hover:bg-lime-100 disabled:opacity-60"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTargetId(item.id)}
                  disabled={saving}
                  className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                >
                  삭제
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={sortedNotices.length}
        pageSize={pageSize}
        pageSizeOptions={pageSizeOptions}
        onPageSizeChange={setPageSize}
        onPageChange={setCurrentPage}
      />

      {showCreateModal && (
        <NoticeFormModal
          title="공지사항 등록"
          form={createForm}
          setForm={setCreateForm}
          submitting={saving}
          onClose={() => setShowCreateModal(false)}
          onSubmit={() => void createNotice()}
        />
      )}

      {editingId !== null && (
        <NoticeFormModal
          title="공지사항 수정"
          form={editingForm}
          setForm={setEditingForm}
          submitting={saving}
          onClose={cancelEdit}
          onSubmit={() => void saveEdit()}
        />
      )}

      {deleteTargetId !== null && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-stone-900">공지 삭제 확인</h3>
            <p className="mt-2 text-sm text-stone-700">공지사항을 삭제할까요?</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                disabled={saving}
                className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteNotice()}
                disabled={saving}
                className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

type NoticeFormModalProps = {
  title: string;
  form: NoticeForm;
  setForm: Dispatch<SetStateAction<NoticeForm>>;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

function NoticeFormModal({
  title,
  form,
  setForm,
  submitting,
  onClose,
  onSubmit,
}: NoticeFormModalProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-stone-900">{title}</h3>
        <p className="mt-1 text-xs text-stone-500">게시 상태와 긴급 팝업 기간을 함께 설정할 수 있습니다.</p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">제목</span>
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">내용</span>
            <textarea
              value={form.content}
              onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
              className="h-28 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              required
            />
          </label>

          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-stone-700">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(event) => setForm((prev) => ({ ...prev, isPublished: event.target.checked }))}
                  className="h-5 w-5 rounded border-stone-300 accent-lime-600"
                />
                게시
              </label>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-stone-700">
                <input
                  type="checkbox"
                  checked={form.isImportant}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      isImportant: event.target.checked,
                      popupStartAt: event.target.checked ? prev.popupStartAt : "",
                      popupEndAt: event.target.checked ? prev.popupEndAt : "",
                    }))
                  }
                  className="h-5 w-5 rounded border-stone-300 accent-amber-600"
                />
                긴급 공지(웹 진입 팝업)
              </label>
            </div>
          </div>

          {form.isImportant && (
            <div className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-stone-600">게시 시작 날짜</span>
                <input
                  type="datetime-local"
                  value={form.popupStartAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, popupStartAt: event.target.value }))}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-stone-600">게시 종료 날짜</span>
                <input
                  type="datetime-local"
                  value={form.popupEndAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, popupEndAt: event.target.value }))}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold text-stone-700 disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-xl bg-lime-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-lime-700 disabled:opacity-60"
            >
              {submitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
