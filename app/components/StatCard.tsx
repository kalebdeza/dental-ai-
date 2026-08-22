type Props = {
  title: string;
  value: string | number;
  color?: string;
};

export default function StatCard({
  title,
  value,
  color = "#2563eb",
}: Props) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: "#ffffff",
        borderRadius: 20,
        padding: 28,
        border: "1px solid #e2e8f0",
        boxShadow: "0 10px 30px rgba(15,23,42,.08)",
        transition: "all .2s ease",
      }}
    >
      {/* Accent Bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 6,
          height: "100%",
          background: color,
        }}
      />

      <div
        style={{
          marginLeft: 16,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "#64748b",
            marginBottom: 14,
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: 40,
            fontWeight: 800,
            color,
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>

        <div
          style={{
            marginTop: 16,
            display: "inline-block",
            padding: "6px 12px",
            borderRadius: 999,
            background: "#f8fafc",
            color: "#475569",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Live AI Data
        </div>
      </div>
    </div>
  );
}