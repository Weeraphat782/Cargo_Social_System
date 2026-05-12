import { Skeleton } from "@/components/ui/skeleton";

export default function CampaignsLoading() {
  return (
    <div style={{ padding: "24px 32px", maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Skeleton width={180} height={32} />
        <Skeleton width={140} height={38} style={{ borderRadius: 8 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: "var(--surface, #18181b)",
              borderRadius: 12,
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <Skeleton width={200} height={20} />
              <Skeleton width={80} height={20} style={{ borderRadius: 20 }} />
              <Skeleton width={80} height={20} style={{ borderRadius: 20 }} />
            </div>
            <div style={{ display: "flex", gap: 24 }}>
              <Skeleton width={120} height={14} />
              <Skeleton width={100} height={14} />
              <Skeleton width={90} height={14} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
