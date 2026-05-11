/** Shape returned by Graph API on error responses */
export type GraphApiErrorJson = {
  id?: string;
  error?: {
    message: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

function metaPermissionHint(message: string): string | null {
  const m = message.toLowerCase();
  if (
    m.includes("publish_actions") ||
    (m.includes("deprecated") && m.includes("permission"))
  ) {
    return "Hint: use a Facebook Page access token from your Meta app with pages_manage_posts (and Instagram scopes for IG). Do not use a personal user token or legacy publish_actions.";
  }
  return null;
}

/**
 * Human-readable error for logs/UI when Graph API returns an error object.
 */
export function formatGraphPublishError(
  platform: "Facebook" | "Instagram",
  status: number,
  json: GraphApiErrorJson,
  step?: string
): string {
  const e = json.error;
  const stepLabel = step ? ` (${step.replace(/_/g, " ")})` : "";
  if (!e?.message) {
    return `${platform}${stepLabel}: HTTP ${status}`;
  }
  let msg = `${platform}${stepLabel}: ${e.message}`;
  if (e.code != null) {
    msg += ` (#${e.code})`;
  }
  const hint = metaPermissionHint(e.message);
  if (hint) {
    msg += ` ${hint}`;
  }
  return msg;
}
