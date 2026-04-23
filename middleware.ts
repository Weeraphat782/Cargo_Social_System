import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const protectedPrefixes = [
    "/dashboard",
    "/queue",
    "/calendar",
    "/topics",
    "/campaigns",
    "/settings",
    "/logs",
  ];
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();
  if (!req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/queue/:path*",
    "/calendar/:path*",
    "/topics/:path*",
    "/campaigns/:path*",
    "/settings/:path*",
    "/logs/:path*",
  ],
};
