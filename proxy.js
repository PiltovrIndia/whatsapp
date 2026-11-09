import { NextResponse } from "next/server";

const SESSION_COOKIE = "wm_session";
const protectedPrefixes = [
  "/dashboard",
  "/onboarding",
  "/getting-started",
  "/contacts",
  "/templates",
  "/send",
  "/campaigns",
  "/settings",
];

export function proxy(request) {
  const isProtected = protectedPrefixes.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix)
  );

  if (!isProtected) return NextResponse.next();

  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (hasSession) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/getting-started/:path*",
    "/contacts/:path*",
    "/templates/:path*",
    "/send/:path*",
    "/campaigns/:path*",
    "/settings/:path*",
  ],
};
