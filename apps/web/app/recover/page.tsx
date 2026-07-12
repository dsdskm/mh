import Link from "next/link";

export default function RecoverPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-4 px-4 py-6">
      <Link href="/" className="text-sm font-semibold text-amber-700">
        ← 홈으로
      </Link>

      <section className="rounded-3xl border border-amber-200 bg-white p-5 shadow">
        <h1 className="font-display text-3xl text-amber-800">계정 찾기</h1>
        <p className="mt-2 text-sm text-stone-600">
          아이디 찾기와 비밀번호 재설정을 각각 별도 화면에서 진행할 수 있습니다.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link
            href="/recover/find-id"
            className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-left transition hover:border-amber-300 hover:bg-amber-50"
          >
            <p className="text-base font-bold text-stone-800">아이디 찾기</p>
            <p className="mt-1 text-sm text-stone-600">이름과 휴대폰 인증으로 가입 아이디를 조회합니다.</p>
          </Link>

          <Link
            href="/recover/reset-password"
            className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-left transition hover:border-lime-300 hover:bg-lime-50"
          >
            <p className="text-base font-bold text-stone-800">비밀번호 찾기</p>
            <p className="mt-1 text-sm text-stone-600">아이디와 휴대폰 인증 후 새 비밀번호를 설정합니다.</p>
          </Link>
        </div>
      </section>
    </main>
  );
}