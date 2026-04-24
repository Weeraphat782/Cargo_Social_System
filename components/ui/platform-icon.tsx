"use client";

type Props = { platform: string; size?: number; className?: string };

function IconFacebook({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073C24 5.445 18.627 0 12 0S0 5.445 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.887v2.264h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

function IconInstagram({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function IconLinkedIn({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function PlatformIcon({ platform, size = 16, className }: Props) {
  const s = size;
  switch (platform) {
    case "FACEBOOK":
      return <span className={className} title="Facebook" style={{ color: "#1877F2", display: "inline-flex", alignItems: "center" }}><IconFacebook size={s} /></span>;
    case "INSTAGRAM":
      return <span className={className} title="Instagram" style={{ color: "#E1306C", display: "inline-flex", alignItems: "center" }}><IconInstagram size={s} /></span>;
    case "LINKEDIN":
      return <span className={className} title="LinkedIn" style={{ color: "#0A66C2", display: "inline-flex", alignItems: "center" }}><IconLinkedIn size={s} /></span>;
    case "OMG":
      return (
        <span className={className} title="OMG Cargo" style={{ display: "inline-flex", alignItems: "center" }}>
          <img src="/logo/logo-full.avif" alt="OMG Cargo" style={{ width: size, height: size, objectFit: "contain", borderRadius: 2 }} />
        </span>
      );
    default:
      return <span className={className} title={platform} style={{ fontSize: size * 0.7, fontWeight: 700 }}>{platform.slice(0, 2)}</span>;
  }
}

/** Icon + short label pill (for tabs, badges). */
export function PlatformPill({
  platform,
  active,
  size = 13,
}: {
  platform: string;
  active?: boolean;
  size?: number;
}) {
  const labels: Record<string, string> = {
    FACEBOOK: "Facebook",
    INSTAGRAM: "Instagram",
    LINKEDIN: "LinkedIn",
    OMG: "OMG Cargo",
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <PlatformIcon platform={platform} size={size + 1} />
      <span style={{ fontSize: size, fontWeight: active ? 600 : 500 }}>
        {labels[platform] ?? platform}
      </span>
    </span>
  );
}
