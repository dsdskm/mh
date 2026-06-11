import { Review } from "../../_lib/types";

type Props = {
  reviews: Review[];
};

export function ReviewsTab({ reviews }: Props) {
  return (
    <>
      <h2 className="font-display text-3xl text-lime-800">후기 목록</h2>
      <div className="space-y-3">
        {reviews.map((review) => (
          <article key={review.id} className="rounded-2xl border border-stone-200 p-4">
            <p className="text-sm font-bold text-stone-900">{review.name}</p>
            <p className="mt-1 text-sm text-stone-800">{review.content}</p>
            {review.comments.length > 0 && (
              <div className="mt-2 space-y-1 rounded-xl bg-stone-50 p-2">
                {review.comments.map((comment) => (
                  <p key={comment.id} className="text-xs text-stone-700">ㄴ {comment.name}: {comment.content}</p>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
