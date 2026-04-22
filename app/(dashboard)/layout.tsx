import { DashboardNav } from "@/components/dashboard-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-base)" }}>
      <DashboardNav />
      <main
        style={{
          marginLeft: 220,
          flex: 1,
          minWidth: 0,
          padding: "32px 36px",
          maxWidth: "calc(100vw - 220px)",
        }}
      >
        {children}
      </main>
    </div>
  );
}
