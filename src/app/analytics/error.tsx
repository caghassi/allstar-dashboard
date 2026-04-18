"use client";

import { Shell } from "@/components/Shell";

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Shell active="/analytics">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-red-400">
          Analytics failed to load
        </h1>
        <pre className="overflow-x-auto rounded border border-[var(--border)] bg-[var(--surface-solid)] p-4 text-xs text-red-300">
          {error.message}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          {error.stack ? `\n\n${error.stack}` : ""}
        </pre>
        <button
          onClick={reset}
          className="rounded border border-[var(--border)] bg-[var(--surface-solid)] px-4 py-2 text-sm hover:bg-[var(--border)]"
        >
          Try again
        </button>
      </div>
    </Shell>
  );
}
