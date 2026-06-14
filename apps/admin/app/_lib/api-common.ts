type ApiErrorBody = {
  message?: string;
};

export async function parseJsonOrThrow<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.message ?? fallbackMessage);
  }

  return (await response.json()) as T;
}
