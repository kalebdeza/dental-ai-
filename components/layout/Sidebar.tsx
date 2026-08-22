"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  Bot,
  Settings,
} from "lucide-react";

const links = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Patients",
    href: "/patients",
    icon: Users,
  },
  {
    name: "Claims",
    href: "/claims",
    icon: FileText,
  },
  {
    name: "AI Copilot",
    href: "/copilot",
    icon: Bot,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col border-r bg-white px-6 py-8 shadow-sm">
      <div className="mb-10">
        <div className="text-4xl">🦷</div>

        <h1 className="mt-3 text-xl font-bold text-slate-900">
          Dental Revenue AI
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Practice Intelligence
        </p>
      </div>

      <nav className="space-y-2">
        {links.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href;

          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                active
                  ? "bg-slate-900 text-white shadow"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon className="h-5 w-5" />
              {link.name}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-xl border bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          AI Status
        </p>

        <p className="mt-2 text-sm font-medium text-green-600">
          ● All systems operational
        </p>

        <p className="mt-1 text-xs text-slate-500">
          Revenue engine running
        </p>
      </div>
    </aside>
  );
}