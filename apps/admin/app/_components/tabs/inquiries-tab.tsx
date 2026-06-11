import { formatPhone } from "../../_lib/constants";
import { Inquiry } from "../../_lib/types";

type Props = {
  inquiries: Inquiry[];
};

export function InquiriesTab({ inquiries }: Props) {
  return (
    <>
      <h2 className="font-display text-3xl text-lime-800">문의내역</h2>
      <div className="space-y-3">
        {inquiries.map((inquiry) => (
          <article key={inquiry.id} className="rounded-2xl border border-stone-200 p-4">
            <p className="text-sm font-bold text-stone-900">{inquiry.title}</p>
            <p className="text-xs text-stone-600">{inquiry.name} · {formatPhone(inquiry.phone)}</p>
            <p className="mt-2 text-sm text-stone-800">{inquiry.message}</p>
          </article>
        ))}
      </div>
    </>
  );
}
