"use client";

import { useRouter, usePathname } from "next/navigation";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const TAG_OPTIONS = [
  { value: "high_value", label: "$200+" },
  { value: "recurring", label: "Recurring" },
  { value: "event_keyword", label: "Event keyword" },
];

export function FilterBar({
  availableMonths,
  selectedMonth,
  selectedTags,
}: {
  availableMonths: number[];
  selectedMonth: number | null;
  selectedTags: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  function navigate(month: number | null, tags: string[]) {
    const params = new URLSearchParams();
    if (month) params.set("month", String(month));
    if (tags.length) params.set("tags", tags.join(","));
    const qs = params.size ? "?" + params.toString() : "";
    router.push(pathname + qs);
  }

  function toggleTag(value: string) {
    const next = selectedTags.includes(value)
      ? selectedTags.filter((t) => t !== value)
      : [...selectedTags, value];
    navigate(selectedMonth, next);
  }

  const hasFilters = selectedMonth !== null || selectedTags.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2">
      <select
        value={selectedMonth ?? ""}
        onChange={(e) =>
          navigate(e.target.value ? parseInt(e.target.value) : null, selectedTags)
        }
        className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
      >
        <option value="">All months</option>
        {availableMonths.map((m) => (
          <option key={m} value={m}>
            {MONTH_NAMES[m - 1]}
          </option>
        ))}
      </select>

      <span className="text-xs text-[var(--muted)]">Tags:</span>
      {TAG_OPTIONS.map((opt) => {
        const checked = selectedTags.includes(opt.value);
        return (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-1 text-sm select-none"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggleTag(opt.value)}
            />
            {opt.label}
          </label>
        );
      })}

      {hasFilters && (
        <button
          onClick={() => navigate(null, [])}
          className="ml-auto text-xs text-[var(--muted)] hover:text-white"
        >
          Clear
        </button>
      )}
    </div>
  );
}
