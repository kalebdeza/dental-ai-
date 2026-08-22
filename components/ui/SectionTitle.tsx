interface Props {
  children: React.ReactNode;
}

export default function SectionTitle({
  children,
}: Props) {
  return (
    <h2
      style={{
        fontSize: 24,
        marginBottom: 20,
      }}
    >
      {children}
    </h2>
  );
}