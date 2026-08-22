type BadgeProps = {
  children: React.ReactNode;
  color?: "blue" | "green" | "red" | "orange";
};

export default function Badge({
  children,
  color = "blue",
}: BadgeProps) {
  const colors = {
    blue: {
      bg: "#dbeafe",
      text: "#1d4ed8",
    },
    green: {
      bg: "#dcfce7",
      text: "#15803d",
    },
    red: {
      bg: "#fee2e2",
      text: "#dc2626",
    },
    orange: {
      bg: "#ffedd5",
      text: "#ea580c",
    },
  };

  return (
    <span
      style={{
        display: "inline-block",
        padding: "8px 14px",
        borderRadius: 999,
        fontWeight: 600,
        background: colors[color].bg,
        color: colors[color].text,
      }}
    >
      {children}
    </span>
  );
}