"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";

const NAV = [
  { href: "/admin", label: "Overzicht" },
  { href: "/admin/routes", label: "Routes" },
  { href: "/admin/kanalen", label: "Kanalen" },
  { href: "/admin/log", label: "Log" },
  { href: "/admin/instellingen", label: "Instellingen" },
];

export function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await getBrowserClient().auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          nlfr-if
          <br />
          distributie
        </div>
        <nav className="nav">
          {NAV.map((n) => {
            const active =
              n.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={active ? "active" : ""}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={logout}
          className="btn btn--ghost btn--sm"
          style={{ marginTop: 24, width: "100%" }}
        >
          Uitloggen
        </button>
      </aside>
      <main className="main">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
        {children}
      </main>
    </div>
  );
}
