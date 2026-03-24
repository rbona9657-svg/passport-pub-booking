import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Verify password matches ADMIN_SETUP_TOKEN
    const setupToken = process.env.ADMIN_SETUP_TOKEN;
    if (!setupToken || password !== setupToken) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Verify email is in ADMIN_EMAILS
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e: string) => e.trim().toLowerCase());
    if (!adminEmails.includes(normalizedEmail)) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Find or create admin user
    let dbUser = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (dbUser.length === 0) {
      const inserted = await db
        .insert(users)
        .values({
          email: normalizedEmail,
          name: normalizedEmail.split("@")[0],
          role: "admin",
          emailVerified: new Date(),
        })
        .returning();
      dbUser = inserted;
    } else if (dbUser[0].role !== "admin") {
      await db
        .update(users)
        .set({ role: "admin" })
        .where(eq(users.id, dbUser[0].id));
      dbUser[0].role = "admin";
    }

    const user = dbUser[0];

    // Create JWT token manually (same format NextAuth uses)
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const isSecure = process.env.NEXTAUTH_URL?.startsWith("https");
    const cookieName = isSecure
      ? "__Secure-authjs.session-token"
      : "authjs.session-token";

    const token = await encode({
      token: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: "admin",
        sub: user.id,
      },
      secret,
      salt: cookieName,
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: !!isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
