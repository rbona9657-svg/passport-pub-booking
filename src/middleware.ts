import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Determine cookie name based on protocol (must match what login route sets)
  const isSecure = req.nextUrl.protocol === "https:";
  const cookieName = isSecure
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    salt: cookieName,
    cookieName,
  });
  const isSignedIn = !!token;
  const isAdmin = token?.role === "admin";

  // Admin routes require admin role
  if (pathname.startsWith("/admin")) {
    if (!isSignedIn) {
      return NextResponse.redirect(new URL("/auth/signin", req.url));
    }
    if (!isAdmin) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // My bookings requires auth
  if (pathname.startsWith("/my-bookings") && !isSignedIn) {
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/my-bookings/:path*"],
  // Note: /setup and /api/setup are NOT listed here — they bypass NextAuth entirely
};
