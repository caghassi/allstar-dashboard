import { Shell } from "@/components/Shell";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type PeriodRow = {
  wtd_revenue: string;
  wtd_orders: string;
  wtd_avg: string;
  wtd_py_revenue: string;
  wtd_py_orders: string;
  wtd_py_avg: string;
  mtd_revenue: string;
  mtd_orders: string;
  mtd_avg: string;
  mtd_py_revenue: string;
  mtd_py_orders: string;
  mtd_py_avg: string;
  ytd_revenue: string;
  ytd_orders: string;
  ytd_avg: string;
  ytd_py_revenue: string;
  ytd_py_orders: string;
  ytd_py_avg: string;
};

type KpiRow = {
  total_orders: string;
  total_revenue: string;
  avg_order_value: string;
  unique_customers: string;
};

type MonthCompareRow = {
  month_num: string;
  yr: string;
  revenue: string;
  order_count: string;
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

function yoyChange(current: number, prior: number): { text: string; color: string } {
  if (prior === 0 && current === 0) return { text: "—", color: "text-[var(--muted)]" };
  if (prior === 0) return { text: "+100%", color: "text-green-400" };
  const change = ((current - prior) / prior) * 100;
  const sign = change >= 0 ? "+" : "";
  return {
    text: `${sign}${change.toFixed(1)}%`,
    color: change >= 0 ? "text-green-400" : "text-red-400",
  };
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function AnalyticsPage() {
  const q = sql();

  const periodRows = (await q`
    select
      coalesce(sum(case when due_date >= date_trunc('week', current_date) and due_date <= current_date then order_total_cents end), 0)::text as wtd_revenue,
      count(case when due_date >= date_trunc('week', current_date) and due_date <= current_date then 1 end)::text as wtd_orders,
      coalesce(avg(case when due_date >= date_trunc('week', current_date) and due_date <= current_date then order_total_cents end), 0)::text as wtd_avg,
      coalesce(sum(case when due_date >= date_trunc('week', current_date) - interval '1 year' and due_date <= current_date - interval '1 year' then order_total_cents end), 0)::text as wtd_py_revenue,
      count(case when due_date >= date_trunc('week', current_date) - interval '1 year' and due_date <= current_date - interval '1 year' then 1 end)::text as wtd_py_orders,
      coalesce(avg(case when due_date >= date_trunc('week', current_date) - interval '1 year' and due_date <= current_date - interval '1 year' then order_total_cents end), 0)::text as wtd_py_avg,
      coalesce(sum(case when due_date >= date_trunc('month', current_date) and due_date <= current_date then order_total_cents end), 0)::text as mtd_revenue,
      count(case when due_date >= date_trunc('month', current_date) and due_date <= current_date then 1 end)::text as mtd_orders,
      coalesce(avg(case when due_date >= date_trunc('month', current_date) and due_date <= current_date then order_total_cents end), 0)::text as mtd_avg,
      coalesce(sum(case when due_date >= date_trunc('month', current_date) - interval '1 year' and due_date <= current_date - interval '1 year' then order_total_cents end), 0)::text as mtd_py_revenue,
      count(case when due_date >= date_trunc('month', current_date) - interval '1 year' and due_date <= current_date - interval '1 year' then 1 end)::text as mtd_py_orders,
      coalesce(avg(case when due_date >= date_trunc('month', current_date) - interval '1 year' and due_date <= current_date - interval '1 year' then order_total_cents end), 0)::text as mtd_py_avg,
      coalesce(sum(case when due_date >= date_trunc('year', current_date) and due_date <= current_date then order_total_cents end), 0)::text as ytd_revenue,
      count(case when due_date >= date_trunc('year', current_date) and due_date <= current_date then 1 end)::text as ytd_orders,
      coalesce(avg(case when due_date >= date_trunc('year', current_date) and due_date <= current_date then order_total_cents end), 0)::text as ytd_avg,
      coalesce(sum(case when due_date >= date_trunc('year', current_date) - interval '1 year' and due_date <= current_date - interval '1 year' then order_total_cents end), 0)::text as ytd_py_revenue,
      count(case when due_date >= date_trunc('year', current_date) - interval '1 year' and due_date <= current_date - interval '1 year' then 1 end)::text as ytd_py_orders,
      coalesce(avg(case when due_date >= date_trunc('year', current_date) - interval '1 year' and due_date <= current_date - interval '1 year' then order_total_cents end), 0)::text as ytd_py_avg
    from printavo_orders
  `) as PeriodRow[];

  const kpiRows = (await q`
    select
      count(*)::text as total_orders,
      coalesce(sum(order_total_cents), 0)::text as total_revenue,
      coalesce(avg(order_total_cents), 0)::text as avg_order_value,
      count(distinct customer_id)::text as unique_customers
    from printavo_orders
  `) as KpiRow[];

  const monthCompareRows = (await q`
    select
      extract(month from due_date)::text as month_num,
      extract(year from due_date)::text as yr,
      sum(order_total_cents)::text as revenue,
      count(*)::text as order_count
    from printavo_orders
    where due_date is not null
      and extract(year from due_date) >= extract(year from current_date) - 1
    group by extract(year from due_date), extract(month from due_date)
    order by yr, month_num
  `) as MonthCompareRow[];

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
    group by customer_name, customer_id
    order by sum(order_total_cents) desc
    limit 15
  `) as CustomerRow[];

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
    group by is_event
  `) as EventRow[];

  const largestRows = (await q`
    select visual_id, job_name, customer_name, order_total_cents::text,
           due_date::text, created_date::text, status, is_event, event_keyword
    from printavo_orders
    order by order_total_cents desc
    limit 10
  `) as OrderRow[];

  const recentRows = (await q`
    select visual_id, job_name, customer_name, order_total_cents::text,
           due_date::text, created_date::text, status, is_event, event_keyword
    from printavo_orders
    where due_date is not null
    order by due_date desc
    limit 25
  `) as OrderRow[];

  const repeatRows = (await q`
    with customer_orders as (
      select customer_id, count(*) as cnt, sum(order_total_cents) as rev
      from printavo_orders
      where customer_id is not null
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
    group by t.tag
    order by sum(po.order_total_cents) desc
    limit 10
  `) as TagRow[];

  const p = periodRows[0];
  const kpi = kpiRows[0];
  const totalRevAll = Number(kpi.total_revenue);

  const periods = [
    {
      label: "Week to Date",
      abbr: "WTD",
      revenue: Number(p.wtd_revenue),
      orders: Number(p.wtd_orders),
      avg: Number(p.wtd_avg),
      pyRevenue: Number(p.wtd_py_revenue),
      pyOrders: Number(p.wtd_py_orders),
      pyAvg: Number(p.wtd_py_avg),
    },
    {
      label: "Month to Date",
      abbr: "MTD",
      revenue: Number(p.mtd_revenue),
      orders: Number(p.mtd_orders),
      avg: Number(p.mtd_avg),
      pyRevenue: Number(p.mtd_py_revenue),
      pyOrders: Number(p.mtd_py_orders),
      pyAvg: Number(p.mtd_py_avg),
    },
    {
      label: "Year to Date",
      abbr: "YTD",
      revenue: Number(p.ytd_revenue),
      orders: Number(p.ytd_orders),
      avg: Number(p.ytd_avg),
      pyRevenue: Number(p.ytd_py_revenue),
      pyOrders: Number(p.ytd_py_orders),
      pyAvg: Number(p.ytd_py_avg),
    },
  ];

  // Build month-over-month comparison data
  const currentYear = new Date().getFullYear();
  const priorYear = currentYear - 1;
  const byMonthYear = new Map<string, number>();
  for (const r of monthCompareRows) {
    byMonthYear.set(`${r.yr}-${r.month_num}`, Number(r.revenue));
  }
  const monthComparison = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return {
      month: MONTH_NAMES[i],
      current: byMonthYear.get(`${currentYear}-${m}`) ?? 0,
      prior: byMonthYear.get(`${priorYear}-${m}`) ?? 0,
    };
  });
  const maxMonthRev = Math.max(
    ...monthComparison.map((m) => Math.max(m.current, m.prior)),
    1,
  );

  const eventData = eventRows.find((r) => r.is_event);
  const nonEventData = eventRows.find((r) => !r.is_event);
  const eventRev = Number(eventData?.revenue ?? 0);
  const nonEventRev = Number(nonEventData?.revenue ?? 0);

  const topCustomerMax = customerRows.length
    ? Number(customerRows[0].total_revenue)
    : 1;

  return (
    <Shell active="/analytics">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Revenue Analytics</h1>
        <p className="text-sm text-[var(--muted)]">
          Printavo order history &middot; comparing to same periods last year.
        </p>
      </div>

      {/* WTD / MTD / YTD Cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        {periods.map((pd) => {
          const revChange = yoyChange(pd.revenue, pd.pyRevenue);
          const ordChange = yoyChange(pd.orders, pd.pyOrders);
          const avgChange = yoyChange(pd.avg, pd.pyAvg);
          return (
            <div
              key={pd.abbr}
              className="rounded border border-[var(--border)] bg-[var(--surface-solid)] p-5"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-medium text-[var(--muted)]">{pd.label}</h2>
                <span className={`text-sm font-semibold ${revChange.color}`}>
                  {revChange.text} YoY
                </span>
              </div>
              <p className="mt-2 text-3xl font-bold">{fmt(pd.revenue)}</p>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                vs {fmt(pd.pyRevenue)} last year
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-3">
                <div>
                  <p className="text-xs text-[var(--muted)]">Orders</p>
                  <p className="text-lg font-semibold">{pd.orders}</p>
                  <p className={`text-xs ${ordChange.color}`}>
                    vs {pd.pyOrders} ({ordChange.text})
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Avg Order</p>
                  <p className="text-lg font-semibold">{fmt(Math.round(pd.avg))}</p>
                  <p className={`text-xs ${avgChange.color}`}>
                    vs {fmt(Math.round(pd.pyAvg))} ({avgChange.text})
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary KPIs */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SmallKpi label="All-Time Revenue" value={fmt(kpi.total_revenue)} />
        <SmallKpi label="All-Time Orders" value={Number(kpi.total_orders).toLocaleString()} />
        <SmallKpi label="Avg Order Value" value={fmt(Math.round(Number(kpi.avg_order_value)))} />
        <SmallKpi label="Unique Customers" value={Number(kpi.unique_customers).toLocaleString()} />
      </div>

      {/* Monthly Revenue: This Year vs Last Year */}
      <Section title={`Monthly Revenue: ${currentYear} vs ${priorYear}`} className="mt-8">
        <div className="mb-3 flex items-center gap-4 text-xs text-[var(--muted)]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-[var(--accent)]" />
            {currentYear}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-[var(--accent)]/30" />
            {priorYear}
          </span>
        </div>
        <div className="space-y-2">
          {monthComparison.map((m) => {
            const curPct = (m.current / maxMonthRev) * 100;
            const priorPct = (m.prior / maxMonthRev) * 100;
            const change = yoyChange(m.current, m.prior);
            return (
              <div key={m.month}>
                <div className="mb-0.5 flex items-baseline justify-between">
                  <span className="w-10 text-xs text-[var(--muted)]">{m.month}</span>
                  <span className="text-xs text-[var(--muted)]">
                    {fmt(m.current)} vs {fmt(m.prior)}{" "}
                    <span className={change.color}>({change.text})</span>
                  </span>
                </div>
                <div className="space-y-0.5">
                  <div className="relative h-5 overflow-hidden rounded bg-[var(--border)]">
                    <div
                      className="absolute inset-y-0 left-0 rounded bg-[var(--accent)]"
                      style={{ width: `${curPct}%` }}
                    />
                  </div>
                  <div className="relative h-3 overflow-hidden rounded bg-[var(--border)]">
                    <div
                      className="absolute inset-y-0 left-0 rounded bg-[var(--accent)]/30"
                      style={{ width: `${priorPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Two-column: Top Customers + Revenue by Status */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
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

      <Section title="Top 10 Largest Orders" className="mt-8">
        <OrderTable rows={largestRows} />
      </Section>

      <Section title="Recent Orders" className="mt-8">
        <OrderTable rows={recentRows} />
      </Section>
    </Shell>
  );
}

function SmallKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--surface-solid)] p-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-xl font-semibold">{value}</p>
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
