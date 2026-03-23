import NextAuth from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createTransport } from "nodemailer";

const transporter = createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || "noreply@passportpub.hu";

export const { handlers, auth, signIn, signOut } = NextAuth({
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
    EmailProvider({
      server: {
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT || 587),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
      from: fromEmail,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        try {
          await transporter.sendMail({
            from: `"Passport Pub" <${fromEmail}>`,
            to: email,
            subject: "Sign in to Passport Pub",
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="font-size: 28px; font-weight: 700; color: #1a1a2e; margin: 0;">Passport Pub</h1>
                  <p style="color: #64748b; margin-top: 8px; font-size: 14px;">Table Booking System</p>
                </div>
                <div style="background: #f8fafc; border-radius: 12px; padding: 32px; text-align: center;">
                  <p style="color: #334155; font-size: 16px; margin: 0 0 24px;">Click the button below to sign in to your account:</p>
                  <a href="${url}" style="display: inline-block; background: #3b4fd4; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Sign In</a>
                  <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">This link expires in 24 hours and can only be used once.</p>
                </div>
              </div>
            `,
          });
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
