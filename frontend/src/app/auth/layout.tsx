export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-base)",
        padding: "1.5rem",
      }}
    >
      {/* Branding */}
      <div style={{ marginBottom: "2rem", textAlign: "center" }}>
        <div
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            color: "var(--quantum)",
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          Q-Learn
        </div>
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: "0.8125rem",
            marginTop: "0.375rem",
          }}
        >
          Quantum Computing Education
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "2rem",
        }}
      >
        {children}
      </div>
    </div>
  );
}
