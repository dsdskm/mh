export type Notice = {
  id: number;
  title: string;
  content: string;
  isImportant: boolean;
  isPublished: boolean;
  popupStartAt: string | null;
  popupEndAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateNoticeInput = {
  title: string;
  content: string;
  isImportant?: boolean;
  isPublished?: boolean;
  popupStartAt?: string | null;
  popupEndAt?: string | null;
};

export type UpdateNoticeInput = Partial<CreateNoticeInput>;