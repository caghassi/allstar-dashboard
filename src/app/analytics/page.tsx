import { Shell } from "@/components/Shell";
import { sql } from "@/lib/db";

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

  const kpiRows = (await q`
    select
      count(*)::text as total_orders,
      coalesce(sum(order_total_cents), 0)::text as total_revenue,
      coalesce(avg(order_total_cents), 0)::text as avg_order_value,
      count(distinct customer_id)::text as unique_customers
    from printavo_orders
  `) as Array<{ total_orders: string; total_revenue: string; avg_order_value: string; unique_customers: string }>;

  const thisMonthRows = (await q`
    select coalesce(sum(order_total_cents), 0)::text as revenue,
           count(*)::text as order_count
    from printavo_orders
    where due_date >= date_trunc('month', current_date)
      and due_date < date_trunc('month', current_date) + interval '1 month'
  `) as Array<{ revenue: string; order_count: string }>;

  const lastMonthRows = (await q`
    select coalesce(sum(order_total_cents), 0)::text as revenue,
           count(*)::text as order_count
    from printavo_orders
    where due_date >= date_trunc('month', current_date) - interval '1 month'
      and due_date < date_trunc('month', current_date)
  `) as Array<{ revenue: string; order_count: string }>;

  const monthlyRows = (await q`
    select
      to_char(due_date, 'YYYY-MM') as month,
      sum(order_total_cents)::text as revenue,
      count(*)::text as order_count,
      avg(order_total_cents)::text as avg_order
    from printavo_orders
    where due_date is not null
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

  const kpi = kpiRows[0];
  const thisMonth = thisMonthRows[0];
  const lastMonth = lastMonthRows[0];

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
          All data from Printavo order history (last ~13 months synced).
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
