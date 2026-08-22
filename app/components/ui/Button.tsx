type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "success";
};

export default function Button({
  children,
  onClick,
  variant = "primary",
}: ButtonProps) {
  const background =
    variant === "primary"
      ? "#2563eb"
      : "#16a34a";

  return (
    <button
      onClick={onClick}
      style={{
        background,
        color: "#fff",
        border: "none",
        padding: "14px 20px",
        borderRadius: 12,
        cursor: "pointer",
        fontWeight: 700,
      }}
    >
      {children}
    </button>
  );
}