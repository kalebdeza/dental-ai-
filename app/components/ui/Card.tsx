type CardProps = {
  children: React.ReactNode;
};

export default function Card({ children }: CardProps) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 20,
        padding: 24,
        border: "1px solid #e2e8f0",
        boxShadow: "0 8px 24px rgba(15,23,42,.06)",
      }}
    >
      {children}
    </div>
  );
}