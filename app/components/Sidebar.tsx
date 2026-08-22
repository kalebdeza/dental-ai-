"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const sections = [
    {
  title: "OVERVIEW",
  links: [
    { name: "📊 Dashboard", href: "/" },
    { name: "🤖 AI Task Center", href: "/tasks" },
  ],
},

    {
      title: "REVENUE RECOVERY",
      links: [
        { name: "💰 Claims Recovery", href: "/opportunities" },
        { name: "📞 Recall Recovery", href: "/recall" },
        { name: "🦷 Treatment Recovery", href: "/treatment" },
        { name: "🔍 Revenue Scan", href: "/scan" },
      ],
    },

    {
      title: "PRACTICE",
      links: [
        { name: "🔌 Connect Practice", href: "/connect" },
        { name: "👥 Patients", href: "/patients" },
        { name: "📄 Claims", href: "/claims" },
      ],
    },

    {
      title: "ANALYTICS",
      links: [{ name: "📈 Analytics", href: "/analytics" }],
    },

    {
      title: "ADMINISTRATION",
      links: [{ name: "⚙️ Settings", href: "/settings" }],
    },
  ];

  return (
    <aside
      style={{
        width: "270px",
        background: "#0f172a",
        color: "white",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "28px",
        boxSizing: "border-box",
        borderRight: "1px solid #1e293b",
      }}
    >
      <div>
        {/* Logo */}
        <div style={{ marginBottom: "40px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 700,
            }}
          >
            🦷 Dental Revenue AI
          </h1>

          <p
            style={{
              marginTop: "6px",
              color: "#94a3b8",
              fontSize: "14px",
            }}
          >
            Revenue Intelligence Platform
          </p>
        </div>

        {sections.map((section) => (
          <div key={section.title} style={{ marginBottom: "28px" }}>
            <div
              style={{
                color: "#64748b",
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "12px",
                fontWeight: 600,
              }}
            >
              {section.title}
            </div>

            {section.links.map((link) => {
              const active = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    display: "block",
                    padding: "14px 16px",
                    marginBottom: "8px",
                    borderRadius: "10px",
                    textDecoration: "none",
                    color: "white",
                    background: active ? "#2563eb" : "transparent",
                    transition: "all 0.2s ease",
                    fontWeight: active ? 600 : 400,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "#1e293b";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  {link.name}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom Card */}
      <div
        style={{
          borderTop: "1px solid #334155",
          paddingTop: "20px",
        }}
      >
        <div
          style={{
            background: "#1e293b",
            borderRadius: "12px",
            padding: "18px",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              marginBottom: "12px",
            }}
          >
            Practice Status
          </div>

          <div
            style={{
              color: "#22c55e",
              fontWeight: 600,
              marginBottom: "8px",
            }}
          >
            🟢 Connected
          </div>

          <div
            style={{
              color: "#94a3b8",
              fontSize: "13px",
            }}
          >
            Demo Practice
          </div>
        </div>
      </div>
    </aside>
  );
}