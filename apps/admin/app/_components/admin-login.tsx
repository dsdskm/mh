import { FormEvent } from "react";

type Props = {
  userId: string;
  password: string;
  error: string | null;
  onUserIdChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function AdminLogin({
  userId,
  password,
  error,
  onUserIdChange,
  onPasswordChange,
  onSubmit,
}: Props) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-admin-pattern px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-3xl border border-lime-200 bg-white/95 p-6 shadow-2xl"
      >
        <h1 className="font-display text-4xl text-lime-700">옥수수마켓 관리자</h1>
        <p className="mt-2 text-sm text-stone-600">마스터 계정으로 로그인하세요.</p>
        {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}
        <input
          value={userId}
          onChange={(event) => onUserIdChange(event.target.value)}
          className="mt-4 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
          placeholder="userId"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          className="mt-3 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
          placeholder="password"
          required
        />
        <button
          type="submit"
          className="mt-4 w-full rounded-xl bg-lime-600 px-4 py-3 text-sm font-bold text-white"
        >
          로그인
        </button>
      </form>
    </main>
  );
}
