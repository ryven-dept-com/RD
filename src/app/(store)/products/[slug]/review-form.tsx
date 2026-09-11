"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReviewForm({ productId }: { productId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [author, setAuthor] = useState("");
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!author.trim() || !body.trim()) {
      setError("Please add your name and a few words.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, author, rating, title, body }),
      });
      if (!res.ok) throw new Error("Failed");
      setDone(true);
      setAuthor("");
      setTitle("");
      setBody("");
      setRating(5);
      router.refresh();
      setTimeout(() => {
        setDone(false);
        setOpen(false);
      }, 2000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-ink px-6 py-3 text-xs font-semibold uppercase tracking-widest transition-colors hover:bg-ink hover:text-bone"
      >
        Write a review
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="animate-scale-in rounded-2xl border border-black/10 bg-brand-50 p-6"
    >
      <h3 className="font-display text-xl uppercase tracking-wide">
        Write a review
      </h3>

      {done ? (
        <p className="mt-4 rounded-lg bg-olive/10 px-4 py-3 text-sm font-medium text-olive">
          Thanks! Your review has been posted.
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRating(s)}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(0)}
                className="p-0.5"
                aria-label={`${s} star${s > 1 ? "s" : ""}`}
              >
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill={(hover || rating) >= s ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.4"
                  className={
                    (hover || rating) >= s ? "text-amber-500" : "text-black/30"
                  }
                >
                  <path d="M12 2.5l2.9 6.2 6.6.7-4.9 4.6 1.3 6.5L12 17.9 6.1 21l1.3-6.5L2.5 9.9l6.6-.7L12 2.5z" />
                </svg>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Your name"
              className="rounded-lg border border-black/15 bg-bone px-4 py-2.5 text-sm focus:border-ink focus:outline-none"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Review title (optional)"
              className="rounded-lg border border-black/15 bg-bone px-4 py-2.5 text-sm focus:border-ink focus:outline-none"
            />
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What did you think?"
            rows={4}
            className="mt-3 w-full rounded-lg border border-black/15 bg-bone px-4 py-2.5 text-sm focus:border-ink focus:outline-none"
          />

          {error && (
            <p className="mt-2 text-xs font-medium text-red-600">{error}</p>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-ink px-6 py-3 text-xs font-semibold uppercase tracking-widest text-bone transition-transform hover:scale-105 disabled:opacity-50"
            >
              {submitting ? "Posting…" : "Submit review"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-medium uppercase tracking-widest text-black/50 hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </form>
  );
}
