import { NextRequest, NextResponse } from "next/server";

// Routes that require authentication (redirect to sign-in if unauthenticated).
// Firebase auth state lives in the client, so server-side auth checks require
// a session cookie or custom token — this middleware uses a lightweight cookie
// presence check as a fast gate. The AuthProvider re-validates on the client.
const PROTECTED_PREFIXES = ["/onboarding"];

// Routes that authenticated users should be redirected away from.
const AUTH_ONLY_PREFIXES  = ["/auth"];

const SESSION_COOKIE = "speckula_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession   = request.cookies.has(SESSION_COOKIE);

  // Redirect signed-out users away from protected routes
  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Redirect signed-in users away from auth pages
  if (AUTH_ONLY_PREFIXES.some((p) => pathname.startsWith(p)) && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next internals, static files, and API routes
    "/((?!_next/static|_next/image|favicon.ico|logo.png|api/).*)",
  ],
};
