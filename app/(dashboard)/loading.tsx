import { Skeleton } from "@/components/ui";

export default function DashboardLoading() {
  return (
    <div style={{ width: "100%", maxWidth: 1200 }}>
      <div style={{ marginBottom: 20 }}>
        <Skeleton height={28} width="40%" style={{ marginBottom: 10 }} />
        <Skeleton height={14} width="70%" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Skeleton variant="card" height={100} />
        <Skeleton variant="card" height={100} />
        <Skeleton variant="card" height={80} />
      </div>
    </div>
  );
}
