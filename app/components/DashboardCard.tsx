type Props = {
  title: string;
  value: string | number;
  color: string;
};

export default function DashboardCard({
  title,
  value,
  color,
}: Props) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "18px",
        padding: "24px",
        boxShadow: "0 8px 24px rgba(0,0,0,.08)",
        borderTop: `6px solid ${color}`,
      }}
    >
      <h3
        style={{
          color: "#64748b",
          marginBottom: "12px",
          fontWeight: 600,
        }}
      >
        {title}
      </h3>

      <div
        style={{
          fontSize: "42px",
          fontWeight: "bold",
        }}
      >
        {value}
      </div>
    </div>
  );
}