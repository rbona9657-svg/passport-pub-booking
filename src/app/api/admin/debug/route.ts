import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll().map(c => ({ name: c.name, length: c.value.length }));

  let tokenResult: unknown = null;
  let tokenError: string | null = null;

  try {
    tokenResult = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  } catch (e) {
    tokenError = String(e);
  }

  return NextResponse.json({
    cookies: allCookies,
    token: tokenResult,
    tokenError,
    env: {
      hasSecret: !!process.env.NEXTAUTH_SECRET,
      secretPrefix: process.env.NEXTAUTH_SECRET?.substring(0, 4) + "...",
      nextauthUrl: process.env.NEXTAUTH_URL,
      hasAdminEmails: !!process.env.ADMIN_EMAILS,
      hasSetupToken: !!process.env.ADMIN_SETUP_TOKEN,
    },
  });
}
