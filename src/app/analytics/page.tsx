import { Shell } from "@/components/Shell";
import { sql } from "@/lib/db";
import { PAID_STATUSES, QUOTE_STATUSES } from "@/lib/config";

export const dynamic = "force-dynamic";

type MonthRow = {
  month: string;
  revenue: string;
  order_count: string;
  avg_order: string;
};

type CustomerRow = {
  customer_name: string;
  customer_id: string | null;
  order_count: string;
  total_revenue: string;
  last_order: string | null;
  first_order: string | null;
};

type StatusRow = {
  status: string | null;
  order_count: string;
  revenue: string;
};

type OrderRow = {
  visual_id: string | null;
  job_name: string | null;
  customer_name: string | null;
  order_total_cents: string;
  due_date: string | null;
  created_date: string | null;
  status: string | null;
  is_event: boolean;
  event_keyword: string | null;
};

type EventRow = {
  is_event: boolean;
  order_count: string;
  revenue: string;
};

type RepeatRow = {
  segment: string;
  customers: string;
  order_count: string;
  revenue: string;
};

type TagRow = {
  tag: string;
  order_count: string;
  revenue: string;
};

type QuoteSummaryRow = {
  quote_count: string;
  pipeline_revenue: string;
  avg_quote: string;
  stale_count: string;
  stale_revenue: string;
};

type OpenQuoteRow = {
  visual_id: string | null;
  job_name: string | null;
  customer_name: string | null;
  order_total_cents: string;
  created_date: string | null;
  status: string | null;
  days_aging: string | null;
};

type DailyRow = {
  day: string;
  quote_count: string;
  quote_revenue: string;
  invoice_count: string;
  invoice_revenue: string;
  paid_count: string;
  paid_revenue: string;
};

type PaidSplitRow = {
  segment: "Paid" | "Unpaid";
  order_count: string;
  revenue: string;
};

function fmt(cents: number | string): string {
  return `$${(Number(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(d: string | Date | null): string {
  if (!d) return "—";
  const s = d instanceof Date ? d.toISOString().slice(0, 10) : d;
  return new Date(s + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${((n / total) * 100).toFixed(1)}%`;
}

export default async function AnalyticsPage() {
  const q = sql();

  // Neon's serverless driver serializes JS arrays to a text literal (not
  // text[]), so `= any($1)` would need an explicit cast. To keep things
  // simple and guaranteed-portable, we destructure the known statuses and
  // pass each one as an individual positional parameter.
  const [QUOTE_A, QUOTE_B] = QUOTE_STATUSES;
  const [PAID_A] = PAID_STATUSES;

  // KPIs and all revenue/order aggregates below operate on "actual invoices"
  // only: every status except the quote-pipeline ones. A null status is
  // treated as an invoice (unknown-but-committed) via coalesce.

  const kpiRows = (await q`
    select
      count(*)::text as total_orders,
      coalesce(sum(order_total_cents), 0)::text as total_revenue,
      coalesce(avg(order_total_cents), 0)::text as avg_order_value,
      count(distinct customer_id)::text as unique_customers
    from printavo_orders
    where (status is null or status not in (${QUOTE_A}, ${QUOTE_B}))
  `) as Array<{ total_orders: string; total_revenue: string; avg_order_value: string; unique_customers: string }>;

  const thisMonthRows = (await q`
    select coalesce(sum(order_total_cents), 0)::text as revenue,
           count(*)::text as order_count
    from printavo_orders
    where (status is null or status not in (${QUOTE_A}, ${QUOTE_B}))
      and due_date >= date_trunc('month', current_date)
      and due_date < date_trunc('month', current_date) + interval '1 month'
  `) as Array<{ revenue: string; order_count: string }>;

  const lastMonthRows = (await q`
    select coalesce(sum(order_total_cents), 0)::text as revenue,
           count(*)::text as order_count
    from printavo_orders
    where (status is null or status not in (${QUOTE_A}, ${QUOTE_B}))
      and due_date >= date_trunc('month', current_date) - interval '1 month'
      and due_date < date_trunc('month', current_date)
  `) as Array<{ revenue: string; order_count: string }>;

  const paidSplitRows = (await q`
    select
      case when status = ${PAID_A} then 'Paid' else 'Unpaid' end as segment,
      count(*)::text as order_count,
      coalesce(sum(order_total_cents), 0)::text as revenue
    from printavo_orders
    where (status is null or status not in (${QUOTE_A}, ${QUOTE_B}))
    group by case when status = ${PAID_A} then 'Paid' else 'Unpaid' end
  `) as PaidSplitRow[];

  const monthlyRows = (await q`
    select
      to_char(due_date, 'YYYY-MM') as month,
      sum(order_total_cents)::text as revenue,
      count(*)::text as order_count,
      avg(order_total_cents)::text as avg_order
    from printavo_orders
    where due_date is not null
      and (status is null or status not in (${QUOTE_A}, ${QUOTE_B}))
    group by to_char(due_date, 'YYYY-MM')
    order by month
  `) as MonthRow[];

  const customerRows = (await q`
    select
      customer_name,
      customer_id,
      count(*)::text as order_count,
      sum(order_total_cents)::text as total_revenue,
      max(due_date)::text as last_order,
      min(due_date)::text as first_order
    from printavo_orders
    where customer_name is not null
      and (status is null or status not in (${QUOTE_A}, ${QUOTE_B}))
    group by customer_name, customer_id
    order by sum(order_total_cents) desc
    limit 15
  `) as CustomerRow[];

  // Status breakdown intentionally still includes quotes so the operator can
  // see the full composition of the pipeline in one table.
  const statusRows = (await q`
    select
      coalesce(status, 'Unknown') as status,
      count(*)::text as order_count,
      sum(order_total_cents)::text as revenue
    from printavo_orders
    group by status
    order by sum(order_total_cents) desc
  `) as StatusRow[];

  const eventRows = (await q`
    select
      is_event,
      count(*)::text as order_count,
      sum(order_total_cents)::text as revenue
    from printavo_orders
    where (status is null or status not in (${QUOTE_A}, ${QUOTE_B}))
    group by is_event
  `) as EventRow[];

  const largestRows = (await q`
    select visual_id, job_name, customer_name, order_total_cents::text,
           due_date::text, created_date::text, status, is_event, event_keyword
    from printavo_orders
    where (status is null or status not in (${QUOTE_A}, ${QUOTE_B}))
    order by order_total_cents desc
    limit 10
  `) as OrderRow[];

  const recentRows = (await q`
    select visual_id, job_name, customer_name, order_total_cents::text,
           due_date::text, created_date::text, status, is_event, event_keyword
    from printavo_orders
    where due_date is not null
      and (status is null or status not in (${QUOTE_A}, ${QUOTE_B}))
    order by due_date desc
    limit 25
  `) as OrderRow[];

  const repeatRows = (await q`
    with customer_orders as (
      select customer_id, count(*) as cnt, sum(order_total_cents) as rev
      from printavo_orders
      where customer_id is not null
        and (status is null or status not in (${QUOTE_A}, ${QUOTE_B}))
      group by customer_id
    )
    select
      case when cnt = 1 then 'One-time' else 'Repeat' end as segment,
      count(*)::text as customers,
      sum(cnt)::text as order_count,
      sum(rev)::text as revenue
    from customer_orders
    group by case when cnt = 1 then 'One-time' else 'Repeat' end
    order by segment
  `) as RepeatRow[];

  const tagRows = (await q`
    select t.tag, count(*)::text as order_count,
           sum(po.order_total_cents)::text as revenue
    from printavo_orders po, jsonb_array_elements_text(po.tags) as t(tag)
    where (po.status is null or po.status not in (${QUOTE_A}, ${QUOTE_B}))
    group by t.tag
    order by sum(po.order_total_cents) desc
    limit 10
  `) as TagRow[];

  // Open quote pipeline — follow-up opportunity. Aging is days since the
  // quote was created in Printavo.
  const quoteSummaryRows = (await q`
    select
      count(*)::text as quote_count,
      coalesce(sum(order_total_cents), 0)::text as pipeline_revenue,
      coalesce(avg(order_total_cents), 0)::text as avg_quote,
      count(*) filter (
        where created_date is not null
          and created_date < current_date - interval '7 days'
      )::text as stale_count,
      coalesce(sum(order_total_cents) filter (
        where created_date is not null
          and created_date < current_date - interval '7 days'
      ), 0)::text as stale_revenue
    from printavo_orders
    where status in (${QUOTE_A}, ${QUOTE_B})
  `) as QuoteSummaryRow[];

  const openQuoteRows = (await q`
    select visual_id, job_name, customer_name, order_total_cents::text,
           created_date::text, status,
           (current_date - created_date)::text as days_aging
    from printavo_orders
    where status in (${QUOTE_A}, ${QUOTE_B})
    order by created_date asc nulls last
    limit 15
  `) as OpenQuoteRow[];

  // Last 30 days of activity: what was written (quotes + invoices created)
  // and what was paid (paid invoices bucketed by due_date).
  const dailyRows = (await q`
    with days as (
      select generate_series(
        current_date - interval '29 days',
        current_date,
        interval '1 day'
      )::date as day
    ),
    written as (
      select created_date as day,
             count(*) filter (where status in (${QUOTE_A}, ${QUOTE_B})) as quote_count,
             coalesce(sum(order_total_cents) filter (where status in (${QUOTE_A}, ${QUOTE_B})), 0) as quote_revenue,
             count(*) filter (where (status is null or status not in (${QUOTE_A}, ${QUOTE_B}))) as invoice_count,
             coalesce(sum(order_total_cents) filter (where (status is null or status not in (${QUOTE_A}, ${QUOTE_B}))), 0) as invoice_revenue
      from printavo_orders
      where created_date >= current_date - interval '29 days'
      group by created_date
    ),
    paid as (
      select due_date as day,
             count(*) as paid_count,
             coalesce(sum(order_total_cents), 0) as paid_revenue
      from printavo_orders
      where status = ${PAID_A}
        and due_date >= current_date - interval '29 days'
      group by due_date
    )
    select
      to_char(d.day, 'YYYY-MM-DD') as day,
      coalesce(w.quote_count, 0)::text as quote_count,
      coalesce(w.quote_revenue, 0)::text as quote_revenue,
      coalesce(w.invoice_count, 0)::text as invoice_count,
      coalesce(w.invoice_revenue, 0)::text as invoice_revenue,
      coalesce(p.paid_count, 0)::text as paid_count,
      coalesce(p.paid_revenue, 0)::text as paid_revenue
    from days d
    left join written w on w.day = d.day
    left join paid p on p.day = d.day
    order by d.day desc
  `) as DailyRow[];

  const kpi = kpiRows[0];
  const thisMonth = thisMonthRows[0];
  const lastMonth = lastMonthRows[0];
  const quoteSummary = quoteSummaryRows[0];

  const lastMonthRev = Number(lastMonth.revenue);
  const thisMonthRev = Number(thisMonth.revenue);
  const monthChange =
    lastMonthRev > 0
      ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100
      : null;

  const maxMonthlyRevenue = Math.max(
    ...monthlyRows.map((r) => Number(r.revenue)),
    1,
  );

  const totalRevAll = Number(kpi.total_revenue);

  const paidData = paidSplitRows.find((r) => r.segment === "Paid");
  const unpaidData = paidSplitRows.find((r) => r.segment === "Unpaid");
  const paidRev = Number(paidData?.revenue ?? 0);
  const unpaidRev = Number(unpaidData?.revenue ?? 0);

  const eventData = eventRows.find((r) => r.is_event);
  const nonEventData = eventRows.find((r) => !r.is_event);
  const eventRev = Number(eventData?.revenue ?? 0);
  const nonEventRev = Number(nonEventData?.revenue ?? 0);

  const topCustomerMax = customerRows.length
    ? Number(customerRows[0].total_revenue)
    : 1;

  const maxDailyRevenue = Math.max(
    ...dailyRows.map((r) =>
      Math.max(
        Number(r.quote_revenue) + Number(r.invoice_revenue),
        Number(r.paid_revenue),
      ),
    ),
    1,
  );

  return (
    <Shell active="/analytics">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Revenue Analytics</h1>
        <p className="text-sm text-[var(--muted)]">
          Revenue KPIs below count only actual invoices (paid + unpaid) — quote
          statuses are excluded and broken out in Quote Follow-up. Last ~13
          months synced from Printavo.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total Revenue" value={fmt(kpi.total_revenue)} />
        <KpiCard
          label="This Month"
          value={fmt(thisMonth.revenue)}
          sub={
            monthChange !== null
              ? `${monthChange >= 0 ? "+" : ""}${monthChange.toFixed(1)}% vs last`
              : `${Number(thisMonth.order_count)} orders`
          }
          subColor={
            monthChange !== null
              ? monthChange >= 0
                ? "text-green-400"
                : "text-red-400"
              : undefined
          }
        />
        <KpiCard
          label="Last Month"
          value={fmt(lastMonth.revenue)}
          sub={`${Number(lastMonth.order_count)} orders`}
        />
        <KpiCard
          label="Avg Order Value"
          value={fmt(Math.round(Number(kpi.avg_order_value)))}
        />
        <KpiCard label="Total Orders" value={Number(kpi.total_orders).toLocaleString()} />
        <KpiCard label="Unique Customers" value={Number(kpi.unique_customers).toLocaleString()} />
      </div>

      {/* Paid vs Unpaid invoice split */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiCard
          label="Paid Invoices"
          value={fmt(paidRev)}
          sub={`${Number(paidData?.order_count ?? 0).toLocaleString()} orders · ${pct(paidRev, paidRev + unpaidRev)}`}
          subColor="text-green-400"
        />
        <KpiCard
          label="Unpaid Invoices"
          value={fmt(unpaidRev)}
          sub={`${Number(unpaidData?.order_count ?? 0).toLocaleString()} orders · ${pct(unpaidRev, paidRev + unpaidRev)}`}
          subColor="text-yellow-400"
        />
      </div>

      {/* Quote Follow-up Opportunity */}
      <Section title="Quote Follow-up Opportunity" className="mt-8">
        {Number(quoteSummary.quote_count) === 0 ? (
          <Empty>No open quotes. Nothing to chase right now.</Empty>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard
                label="Open Quote Pipeline"
                value={fmt(quoteSummary.pipeline_revenue)}
                sub={`${Number(quoteSummary.quote_count).toLocaleString()} quotes`}
                subColor="text-purple-400"
              />
              <KpiCard
                label="Avg Quote Value"
                value={fmt(Math.round(Number(quoteSummary.avg_quote)))}
              />
              <KpiCard
                label="Aging >7 days"
                value={fmt(quoteSummary.stale_revenue)}
                sub={`${Number(quoteSummary.stale_count).toLocaleString()} quotes need follow-up`}
                subColor={
                  Number(quoteSummary.stale_count) > 0
                    ? "text-red-400"
                    : "text-[var(--muted)]"
                }
              />
              <KpiCard
                label="Oldest Open Quote"
                value={
                  openQuoteRows[0]?.days_aging
                    ? `${openQuoteRows[0].days_aging}d`
                    : "—"
                }
                sub={
                  openQuoteRows[0]?.customer_name
                    ? openQuoteRows[0].customer_name
                    : undefined
                }
              />
            </div>
            <OpenQuoteTable rows={openQuoteRows} />
          </>
        )}
      </Section>

      {/* Daily Activity — last 30 days */}
      <Section
        title="Daily Activity — Written vs Paid (last 30 days)"
        className="mt-8"
      >
        {dailyRows.length === 0 ? (
          <Empty>No activity in the last 30 days.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                  <th className="pb-2 pr-3 font-normal">Day</th>
                  <th className="pb-2 pr-3 text-right font-normal">
                    Quotes Written
                  </th>
                  <th className="pb-2 pr-3 text-right font-normal">
                    Invoices Written
                  </th>
                  <th className="pb-2 pr-3 text-right font-normal">Paid</th>
                  <th className="pb-2 pl-2 font-normal">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-sm bg-purple-400/70" />
                      quote
                      <span className="ml-1 inline-block h-2 w-2 rounded-sm bg-[var(--accent)]" />
                      invoice
                      <span className="ml-1 inline-block h-2 w-2 rounded-sm bg-green-500/70" />
                      paid
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.map((d) => {
                  const quoteRev = Number(d.quote_revenue);
                  const invoiceRev = Number(d.invoice_revenue);
                  const paidRevDay = Number(d.paid_revenue);
                  const writtenPct =
                    ((quoteRev + invoiceRev) / maxDailyRevenue) * 100;
                  const invoicePct = (invoiceRev / maxDailyRevenue) * 100;
                  const paidPct = (paidRevDay / maxDailyRevenue) * 100;
                  const hasAny = quoteRev + invoiceRev + paidRevDay > 0;
                  return (
                    <tr
                      key={d.day}
                      className="border-b border-[var(--border)]/50"
                    >
                      <td className="py-1.5 pr-3 text-[var(--muted)] whitespace-nowrap">
                        {fmtDate(d.day)}
                      </td>
                      <td className="py-1.5 pr-3 text-right">
                        {quoteRev > 0 ? (
                          <>
                            <span className="font-medium">{fmt(quoteRev)}</span>
                            <span className="ml-1 text-xs text-[var(--muted)]">
                              ({d.quote_count})
                            </span>
                          </>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-right">
                        {invoiceRev > 0 ? (
                          <>
                            <span className="font-medium">{fmt(invoiceRev)}</span>
                            <span className="ml-1 text-xs text-[var(--muted)]">
                              ({d.invoice_count})
                            </span>
                          </>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-right">
                        {paidRevDay > 0 ? (
                          <>
                            <span className="font-medium text-green-400">
                              {fmt(paidRevDay)}
                            </span>
                            <span className="ml-1 text-xs text-[var(--muted)]">
                              ({d.paid_count})
                            </span>
                          </>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="py-1.5 pl-2 w-[40%] min-w-[160px]">
                        {hasAny ? (
                          <div className="space-y-0.5">
                            <div className="relative h-2 overflow-hidden rounded bg-[var(--border)]">
                              <div
                                className="absolute inset-y-0 left-0 bg-purple-400/70"
                                style={{ width: `${writtenPct}%` }}
                              />
                              <div
                                className="absolute inset-y-0 left-0 bg-[var(--accent)]"
                                style={{ width: `${invoicePct}%` }}
                              />
                            </div>
                            <div className="relative h-2 overflow-hidden rounded bg-[var(--border)]">
                              <div
                                className="absolute inset-y-0 left-0 bg-green-500/70"
                                style={{ width: `${paidPct}%` }}
                              />
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-[var(--muted)]">
              &quot;Written&quot; buckets by created date. &quot;Paid&quot;
              buckets by due date for orders currently marked{" "}
              {PAID_STATUSES.join(", ")}.
            </p>
          </div>
        )}
      </Section>

      {/* Monthly Revenue Trend */}
      <Section title="Monthly Revenue" className="mt-8">
        {monthlyRows.length === 0 ? (
          <Empty>No order data yet.</Empty>
        ) : (
          <div className="space-y-1.5">
            {monthlyRows.map((r) => {
              const rev = Number(r.revenue);
              const widthPct = (rev / maxMonthlyRevenue) * 100;
              const label = new Date(r.month + "-01T00:00:00Z").toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
                timeZone: "UTC",
              });
              return (
                <div key={r.month} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-right text-xs text-[var(--muted)]">
                    {label}
                  </span>
                  <div className="relative h-7 flex-1 overflow-hidden rounded bg-[var(--border)]">
                    <div
                      className="absolute inset-y-0 left-0 rounded bg-[var(--accent)]"
                      style={{ width: `${widthPct}%` }}
                    />
                    <span className="relative z-10 flex h-full items-center px-2 text-xs font-medium text-black mix-blend-difference">
                      {fmt(rev)} &middot; {r.order_count} orders &middot; avg {fmt(Math.round(Number(r.avg_order)))}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Two-column: Top Customers + Revenue by Status */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Top Customers */}
        <Section title="Top 15 Customers by Revenue">
          {customerRows.length === 0 ? (
            <Empty>No customer data.</Empty>
          ) : (
            <div className="space-y-2">
              {customerRows.map((c, i) => {
                const rev = Number(c.total_revenue);
                const widthPct = (rev / topCustomerMax) * 100;
                return (
                  <div key={c.customer_id ?? c.customer_name + i}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-[var(--muted)]">{i + 1}.</span>
                        <span className="font-medium">{c.customer_name}</span>
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        {c.order_count} orders &middot; {pct(rev, totalRevAll)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <div className="relative h-4 flex-1 overflow-hidden rounded bg-[var(--border)]">
                        <div
                          className="absolute inset-y-0 left-0 rounded bg-orange-500/60"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="w-20 text-right text-xs font-medium">{fmt(rev)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Revenue by Status */}
        <div className="space-y-6">
          <Section title="Revenue by Status">
            {statusRows.length === 0 ? (
              <Empty>No data.</Empty>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                    <th className="pb-2 font-normal">Status</th>
                    <th className="pb-2 text-right font-normal">Orders</th>
                    <th className="pb-2 text-right font-normal">Revenue</th>
                    <th className="pb-2 text-right font-normal">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {statusRows.map((s) => (
                    <tr key={s.status} className="border-b border-[var(--border)]/50">
                      <td className="py-1.5">
                        <StatusBadge status={s.status ?? "Unknown"} />
                      </td>
                      <td className="py-1.5 text-right text-[var(--muted)]">{s.order_count}</td>
                      <td className="py-1.5 text-right font-medium">{fmt(s.revenue)}</td>
                      <td className="py-1.5 text-right text-[var(--muted)]">
                        {pct(Number(s.revenue), totalRevAll)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Event vs Non-Event */}
          <Section title="Event vs Regular Orders">
            <div className="flex gap-4">
              <div className="flex-1 rounded border border-[var(--border)] bg-[var(--background)] p-4 text-center">
                <p className="text-xs text-[var(--muted)]">Event Orders</p>
                <p className="mt-1 text-xl font-semibold text-[var(--accent)]">
                  {fmt(eventRev)}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {eventData?.order_count ?? 0} orders &middot;{" "}
                  {pct(eventRev, eventRev + nonEventRev)}
                </p>
              </div>
              <div className="flex-1 rounded border border-[var(--border)] bg-[var(--background)] p-4 text-center">
                <p className="text-xs text-[var(--muted)]">Regular Orders</p>
                <p className="mt-1 text-xl font-semibold">{fmt(nonEventRev)}</p>
                <p className="text-xs text-[var(--muted)]">
                  {nonEventData?.order_count ?? 0} orders &middot;{" "}
                  {pct(nonEventRev, eventRev + nonEventRev)}
                </p>
              </div>
            </div>
          </Section>

          {/* Repeat vs One-time */}
          <Section title="Repeat vs One-Time Customers">
            {repeatRows.length === 0 ? (
              <Empty>No data.</Empty>
            ) : (
              <div className="flex gap-4">
                {repeatRows.map((r) => {
                  const rev = Number(r.revenue);
                  return (
                    <div
                      key={r.segment}
                      className="flex-1 rounded border border-[var(--border)] bg-[var(--background)] p-4 text-center"
                    >
                      <p className="text-xs text-[var(--muted)]">{r.segment} Customers</p>
                      <p className="mt-1 text-xl font-semibold">{fmt(rev)}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {r.customers} customers &middot; {r.order_count} orders &middot;{" "}
                        {pct(rev, totalRevAll)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* Tags */}
      {tagRows.length > 0 && (
        <Section title="Top Tags by Revenue" className="mt-8">
          <div className="flex flex-wrap gap-2">
            {tagRows.map((t) => (
              <span
                key={t.tag}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-sm"
              >
                {t.tag}{" "}
                <span className="text-[var(--muted)]">
                  ({t.order_count} orders &middot; {fmt(t.revenue)})
                </span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Largest Orders */}
      <Section title="Top 10 Largest Orders" className="mt-8">
        <OrderTable rows={largestRows} />
      </Section>

      {/* Recent Orders */}
      <Section title="Recent Orders" className="mt-8">
        <OrderTable rows={recentRows} />
      </Section>
    </Shell>
  );
}

function KpiCard({
  label,
  value,
  sub,
  subColor,
}: {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--surface-solid)] p-4">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && (
        <p className={`mt-0.5 text-xs ${subColor ?? "text-[var(--muted)]"}`}>{sub}</p>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded border border-[var(--border)] bg-[var(--surface-solid)] p-5 ${className ?? ""}`}
    >
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--muted)]">{children}</p>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    "Paid / Picked Up": "bg-green-500/20 text-green-400",
    "Payment Due": "bg-yellow-500/20 text-yellow-400",
    "In Production": "bg-blue-500/20 text-blue-400",
    "Quote Sent": "bg-purple-500/20 text-purple-400",
    "Quote Requested": "bg-purple-500/20 text-purple-300",
  };
  const cls = colors[status] ?? "bg-[var(--border)] text-[var(--muted)]";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${cls}`}>
      {status}
    </span>
  );
}

function OpenQuoteTable({ rows }: { rows: OpenQuoteRow[] }) {
  if (rows.length === 0) return <Empty>No open quotes.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
            <th className="pb-2 pr-4 font-normal">Quote</th>
            <th className="pb-2 pr-4 font-normal">Customer</th>
            <th className="pb-2 pr-4 font-normal">Job</th>
            <th className="pb-2 pr-4 text-right font-normal">Value</th>
            <th className="pb-2 pr-4 font-normal">Created</th>
            <th className="pb-2 pr-4 text-right font-normal">Aging</th>
            <th className="pb-2 font-normal">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const aging = r.days_aging ? Number(r.days_aging) : null;
            const agingClass =
              aging === null
                ? "text-[var(--muted)]"
                : aging >= 14
                  ? "text-red-400 font-medium"
                  : aging >= 7
                    ? "text-yellow-400"
                    : "text-[var(--muted)]";
            return (
              <tr
                key={`${r.visual_id}-${i}`}
                className="border-b border-[var(--border)]/50"
              >
                <td className="py-1.5 pr-4 text-[var(--muted)]">
                  {r.visual_id ? `#${r.visual_id}` : "—"}
                </td>
                <td className="py-1.5 pr-4 font-medium">
                  {r.customer_name ?? "Unknown"}
                </td>
                <td className="max-w-[200px] truncate py-1.5 pr-4 text-[var(--muted)]">
                  {r.job_name ?? "—"}
                </td>
                <td className="py-1.5 pr-4 text-right font-medium">
                  {fmt(r.order_total_cents)}
                </td>
                <td className="py-1.5 pr-4 text-[var(--muted)]">
                  {fmtDate(r.created_date)}
                </td>
                <td className={`py-1.5 pr-4 text-right ${agingClass}`}>
                  {aging === null ? "—" : `${aging}d`}
                </td>
                <td className="py-1.5">
                  <StatusBadge status={r.status ?? "Unknown"} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrderTable({ rows }: { rows: OrderRow[] }) {
  if (rows.length === 0) return <Empty>No orders found.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
            <th className="pb-2 pr-4 font-normal">Order</th>
            <th className="pb-2 pr-4 font-normal">Customer</th>
            <th className="pb-2 pr-4 font-normal">Job</th>
            <th className="pb-2 pr-4 text-right font-normal">Total</th>
            <th className="pb-2 pr-4 font-normal">Due Date</th>
            <th className="pb-2 font-normal">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.visual_id}-${i}`} className="border-b border-[var(--border)]/50">
              <td className="py-1.5 pr-4 text-[var(--muted)]">
                {r.visual_id ? `#${r.visual_id}` : "—"}
              </td>
              <td className="py-1.5 pr-4 font-medium">
                {r.customer_name ?? "Unknown"}
              </td>
              <td className="max-w-[200px] truncate py-1.5 pr-4 text-[var(--muted)]">
                {r.job_name ?? "—"}
                {r.is_event && (
                  <span className="ml-1 rounded bg-[var(--accent)]/20 px-1.5 py-0.5 text-[10px] text-[var(--accent)]">
                    {r.event_keyword}
                  </span>
                )}
              </td>
              <td className="py-1.5 pr-4 text-right font-medium">
                {fmt(r.order_total_cents)}
              </td>
              <td className="py-1.5 pr-4 text-[var(--muted)]">{fmtDate(r.due_date)}</td>
              <td className="py-1.5">
                <StatusBadge status={r.status ?? "Unknown"} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
