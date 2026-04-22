import { NextResponse } from "next/server";
import { auth } from "@/auth";

/** Start LinkedIn OAuth (requires logged-in admin). */
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL ?? "http://localhost:3000"));
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "LINKEDIN_CLIENT_ID and LINKEDIN_REDIRECT_URI must be set" },
      { status: 500 }
    );
  }

  const scope = encodeURIComponent("openid profile w_member_social email");
  const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=csrf`;
  return NextResponse.redirect(url);
}
