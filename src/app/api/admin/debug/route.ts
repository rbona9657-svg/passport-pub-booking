import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { decode } from "next-auth/jwt";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll().map(c => ({ name: c.name, length: c.value.length }));

  const secret = process.env.NEXTAUTH_SECRET!;
  const sessionCookie = cookieStore.get("__Secure-authjs.session-token")?.value
    ?? cookieStore.get("authjs.session-token")?.value
    ?? null;

  // Try decoding with different salt values to find the right one
  const salts = [
    "__Secure-authjs.session-token",
    "authjs.session-token",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
  ];

  const decodeResults: Record<string, unknown> = {};
  if (sessionCookie) {
    for (const salt of salts) {
      try {
        const result = await decode({ token: sessionCookie, secret, salt });
        decodeResults[salt] = result ?? "null (decoded but empty)";
      } catch (e) {
        decodeResults[salt] = `error: ${String(e).substring(0, 100)}`;
      }
    }
  }

  // Also try getToken with different configs
  const getTokenResults: Record<string, unknown> = {};
  for (const salt of salts) {
    try {
      const result = await getToken({ req, secret, salt, cookieName: salt.replace("__Secure-", "") });
      getTokenResults[`cookieName=${salt.replace("__Secure-", "")}, salt=${salt}`] = result ?? "null";
    } catch (e) {
      getTokenResults[`cookieName=${salt.replace("__Secure-", "")}, salt=${salt}`] = `error: ${String(e).substring(0, 100)}`;
    }
  }

  return NextResponse.json({
    cookies: allCookies,
    sessionCookieLength: sessionCookie?.length ?? 0,
    decodeResults,
    getTokenResults,
    env: {
      hasSecret: !!process.env.NEXTAUTH_SECRET,
      nextauthUrl: process.env.NEXTAUTH_URL,
    },
  });
}
