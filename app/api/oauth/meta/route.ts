import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/auth";
import { getAppBaseUrl } from "@/lib/env";
import {
  META_GRAPH_API_VERSION,
  META_LOGIN_DIALOG_SCOPES,
} from "@/lib/meta/oauth-graph";

const META_OAUTH_STATE_COOKIE = "meta_oauth_state";

/** Start Meta OAuth (requires logged-in admin). CSRF `state` stored in httpOnly cookie. */
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.redirect(new URL("/login", getAppBaseUrl()));
  }

  const clientId = process.env.META_APP_ID?.trim();
  const redirectUri = process.env.META_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "META_APP_ID and META_REDIRECT_URI must be set" },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(24).toString("hex");

  const dialog = new URL(
    `https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth`
  );
  dialog.searchParams.set("client_id", clientId);
  dialog.searchParams.set("redirect_uri", redirectUri);
  dialog.searchParams.set("state", state);
  dialog.searchParams.set("scope", META_LOGIN_DIALOG_SCOPES);
  dialog.searchParams.set("response_type", "code");

  const res = NextResponse.redirect(dialog.toString());
  res.cookies.set(META_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return res;
}
