import { Skeleton } from "@/components/ui/skeleton";

export default function QueueLoading() {
  return (
    <div style={{ padding: "24px 32px", maxWidth: 900 }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} width={90} height={34} style={{ borderRadius: 8 }} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: "var(--surface, #18181b)",
              borderRadius: 12,
              padding: "20px 24px",
              display: "flex",
              gap: 16,
            }}
          >
            <Skeleton width={120} height={120} style={{ borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Skeleton width={80} height={20} style={{ borderRadius: 20 }} />
                <Skeleton width={100} height={14} />
              </div>
              <Skeleton width="90%" height={14} />
              <Skeleton width="70%" height={14} />
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <Skeleton width={80} height={30} style={{ borderRadius: 6 }} />
                <Skeleton width={80} height={30} style={{ borderRadius: 6 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
