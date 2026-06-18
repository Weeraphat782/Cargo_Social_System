import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { FileText } from "lucide-react";
import { StrategyDeleteButton } from "./strategy-delete-button";

export default async function StrategiesListPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const rows = await prisma.marketingStrategy.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { drafts: true, campaigns: true } },
    },
  });

  const slugs = [...new Set(rows.map((r) => r.brandTemplateId))];
  const masters = await prisma.brandTemplateMaster.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, displayName: true },
  });
  const brandLabel = Object.fromEntries(masters.map((m) => [m.slug, m.displayName]));

  return (
    <div>
      <PageHeader
        title="Marketing strategies"
        subtitle="Upload a strategy PDF, review AI-proposed campaigns, then create them in one click."
        icon={<FileText size={28} strokeWidth={1.75} />}
      />
      <div style={{ marginBottom: 20 }}>
        <Link href="/strategies/new" className="omg-btn-primary" style={{ textDecoration: "none" }}>
          New strategy
        </Link>
      </div>

      {rows.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>No strategies yet. Upload a PDF to get started.</p>
      ) : (
        <div className="omg-card" style={{ overflowX: "auto", padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "12px 16px" }}>Name</th>
                <th style={{ padding: "12px 16px" }}>Brand</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px" }}>Drafts</th>
                <th style={{ padding: "12px 16px" }}>Campaigns</th>
                <th style={{ padding: "12px 16px" }}>Updated</th>
                <th style={{ padding: "12px 16px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <Link href={`/strategies/${r.id}`} style={{ color: "var(--accent)", fontWeight: 600 }}>
                      {r.name}
                    </Link>
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>
                    {brandLabel[r.brandTemplateId] ?? r.brandTemplateId}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span className="omg-badge-pending" style={{ fontSize: 11 }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>{r._count.drafts}</td>
                  <td style={{ padding: "12px 16px" }}>{r._count.campaigns}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {r.updatedAt.toLocaleString()}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {r._count.campaigns > 0 ? (
                      <span title="Has committed campaigns" style={{ color: "var(--text-muted)" }}>
                        —
                      </span>
                    ) : (
                      <StrategyDeleteButton id={r.id} name={r.name} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
