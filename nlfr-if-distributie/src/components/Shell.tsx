"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
      </aside>
      <main className="main">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
        {children}
      </main>
    </div>
  );
}
