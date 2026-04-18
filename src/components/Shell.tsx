import Link from "next/link";

const NAV = [
  { href: "/analytics", label: "Analytics" },
  { href: "/reorders", label: "Reorder Calls" },
  { href: "/leads", label: "Weekly Leads" },
  { href: "/competitors", label: "Competition" },
];

export function Shell({ children, active }: { children: React.ReactNode; active: string }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-[var(--border)] bg-[var(--surface-solid)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/reorders" className="flex items-center gap-3 font-semibold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-[var(--accent)] text-black">
              A
            </span>
            <span>All Star Dashboard</span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((item) => {
              const isActive = active === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded px-3 py-1.5 text-sm transition ${
                    isActive
                      ? "bg-[var(--accent)] text-black"
                      : "text-[var(--muted)] hover:bg-[var(--border)] hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <form action="/api/auth/logout" method="post" className="ml-2">
              <button
                type="submit"
                className="rounded px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--border)] hover:text-white"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
