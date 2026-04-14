import { Shell } from "@/components/Shell";
import { sql } from "@/lib/db";
import { markReorderCall } from "./actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  order_id: string;
  visual_id: string | null;
  job_name: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  order_total_cents: number | string;
  due_date: string | Date;
  projected_event_date: string | Date;
  projected_call_date: string | Date;
  reason: string;
  called: boolean;
  outcome: string | null;
  notes: string | null;
  event_keyword: string | null;
};

function formatMoney(cents: number | string): string {
  return `$${(Number(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(d: string | Date): string {
  const s = d instanceof Date ? d.toISOString().slice(0, 10) : d;
  return new Date(s + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function prettyReasons(reason: string): string[] {
  return reason.split(",").map((r) => {
    switch (r.trim()) {
      case "high_value":
        return "$200+ order";
      case "recurring":
        return "Recurring customer";
      case "event_keyword":
        return "Event keyword";
      default:
        return r.trim();
    }
  });
}

export default async function ReordersPage() {
  const q = sql();
  const rows = (await q`
    select
      rc.id,
      po.id as order_id,
      po.visual_id,
      po.job_name,
      po.customer_name,
      po.customer_phone,
      po.customer_email,
      po.order_total_cents,
      po.due_date,
      po.event_keyword,
      rc.projected_event_date,
      rc.projected_call_date,
      rc.reason,
      rc.called,
      rc.outcome,
      rc.notes
    from reorder_calls rc
    join printavo_orders po on po.id = rc.printavo_order_id
    where rc.projected_event_date >= current_date
    order by rc.projected_call_date asc, po.order_total_cents desc
  `) as Row[];

  const toCall = rows.filter((r) => !r.called);
  const done = rows.filter((r) => r.called);

  return (
    <Shell active="/reorders">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reorder Call List</h1>
          <p className="text-sm text-[var(--muted)]">
            Last year&apos;s orders whose anniversary is 21&ndash;45 days out.
          </p>
        </div>
        <form action="/api/cron/printavo-sync" method="post">
          <button
            type="submit"
            className="rounded border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--border)]"
          >
            Sync Printavo now
          </button>
        </form>
      </div>

      {toCall.length === 0 ? (
        <p className="rounded border border-[var(--border)] bg-[var(--surface-solid)] p-6 text-sm text-[var(--muted)]">
          Nothing to call right now. Run &ldquo;Sync Printavo now&rdquo; if you just added API credentials.
        </p>
      ) : (
        <div className="grid gap-3">
          {toCall.map((r) => (
            <ReorderCard key={r.id} row={r} />
          ))}
        </div>
      )}

      {done.length > 0 ? (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm text-[var(--muted)]">
            Completed ({done.length})
          </summary>
          <div className="mt-3 grid gap-2 opacity-70">
            {done.map((r) => (
              <ReorderCard key={r.id} row={r} />
            ))}
          </div>
        </details>
      ) : null}
    </Shell>
  );
}

function ReorderCard({ row }: { row: Row }) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--surface-solid)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            {row.visual_id ? <span>#{row.visual_id}</span> : null}
            <span>
              Event: <strong className="text-white">{formatDate(row.projected_event_date)}</strong>
            </span>
            <span>Call by: {formatDate(row.projected_call_date)}</span>
          </div>
          <h3 className="mt-1 text-lg font-medium">
            {row.customer_name ?? "Unknown customer"}
          </h3>
          <p className="text-sm text-[var(--muted)]">{row.job_name ?? "(no job name)"}</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-semibold">{formatMoney(row.order_total_cents)}</div>
          <div className="flex flex-wrap justify-end gap-1">
            {prettyReasons(row.reason).map((r) => (
              <span
                key={r}
                className="rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-xs text-[var(--accent)]"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        {row.customer_phone ? (
          <a
            href={`tel:${row.customer_phone}`}
            className="rounded bg-[var(--accent)] px-3 py-1.5 text-black hover:bg-orange-400"
          >
            Call {row.customer_phone}
          </a>
        ) : (
          <span className="text-[var(--muted)]">No phone on file</span>
        )}
        {row.customer_email ? (
          <a
            href={`mailto:${row.customer_email}`}
            className="text-[var(--muted)] hover:text-white"
          >
            {row.customer_email}
          </a>
        ) : null}
      </div>

      <form action={markReorderCall} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={row.id} />
        <select
          name="outcome"
          defaultValue={row.outcome ?? ""}
          className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
        >
          <option value="">Outcome…</option>
          <option value="reorder">Will reorder</option>
          <option value="maybe">Maybe</option>
          <option value="declined">Declined</option>
          <option value="voicemail">Left voicemail</option>
          <option value="no_answer">No answer</option>
        </select>
        <input
          type="text"
          name="notes"
          defaultValue={row.notes ?? ""}
          placeholder="Notes"
          className="flex-1 min-w-[12rem] rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
        />
        <label className="flex items-center gap-1 text-sm text-[var(--muted)]">
          <input type="checkbox" name="called" defaultChecked={row.called} />
          Called
        </label>
        <button
          type="submit"
          className="rounded border border-[var(--border)] px-3 py-1 text-sm hover:bg-[var(--border)]"
        >
          Save
        </button>
      </form>
    </div>
  );
}
