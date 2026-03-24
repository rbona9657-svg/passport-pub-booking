import NextAuth from "next-auth";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/gmail";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify",
  },
  providers: [
    CredentialsProvider({
      name: "Admin Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string)?.trim().toLowerCase();
        const password = credentials?.password as string;

        if (!email || !password) return null;

        // Check password matches ADMIN_SETUP_TOKEN
        const setupToken = process.env.ADMIN_SETUP_TOKEN;
        if (!setupToken || password !== setupToken) return null;

        // Check email is in ADMIN_EMAILS
        const adminEmails = (process.env.ADMIN_EMAILS ?? "")
          .split(",")
          .map((e) => e.trim().toLowerCase());
        if (!adminEmails.includes(email)) return null;

        // Find or create the admin user
        let dbUser = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (dbUser.length === 0) {
          const inserted = await db
            .insert(users)
            .values({
              email,
              name: email.split("@")[0],
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

        return {
          id: dbUser[0].id,
          email: dbUser[0].email,
          name: dbUser[0].name,
          role: dbUser[0].role ?? "user",
        };
      },
    }),
    EmailProvider({
      server: {},
      from: process.env.GMAIL_SENDER || "rbona9657@gmail.com",
      sendVerificationRequest: async ({ identifier: email, url }) => {
        try {
          await sendEmail(
            email,
            "Sign in to Passport Pub Admin",
            `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="font-size: 28px; font-weight: 700; color: #1a1a2e; margin: 0;">Passport Pub</h1>
                  <p style="color: #64748b; margin-top: 8px; font-size: 14px;">Admin Panel</p>
                </div>
                <div style="background: #f8fafc; border-radius: 12px; padding: 32px; text-align: center;">
                  <p style="color: #334155; font-size: 16px; margin: 0 0 24px;">Click the button below to sign in:</p>
                  <a href="${url}" style="display: inline-block; background: #3b4fd4; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Sign In</a>
                  <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">This link expires in 24 hours and can only be used once.</p>
                </div>
              </div>
            `,
          );
        } catch (error) {
          console.error("Error sending verification email:", error);
          throw new Error("Failed to send verification email");
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      if (token.id) {
        const dbUser = await db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, token.id as string))
          .limit(1);
        token.role = dbUser[0]?.role ?? "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());
      if (user.email && adminEmails.includes(user.email.toLowerCase())) {
        await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id!));
      }
    },
  },
});
