import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookings, tables, users } from "@/lib/db/schema";
import { eq, or, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get("email");
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const emailLower = email.toLowerCase();

    const result = await db
      .select({
        booking: bookings,
        table: {
          tableNumber: tables.tableNumber,
          seats: tables.seats,
        },
      })
      .from(bookings)
      .innerJoin(tables, eq(tables.id, bookings.tableId))
      .leftJoin(users, eq(users.id, bookings.userId))
      .where(or(eq(bookings.guestEmail, emailLower), eq(users.email, emailLower)))
      .orderBy(desc(bookings.createdAt));

    const mapped = result.map((r) => ({
      ...r.booking,
      table: r.table,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("Error looking up bookings:", error);
    return NextResponse.json({ error: "Failed to look up bookings" }, { status: 500 });
  }
}
