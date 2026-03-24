import { db } from "@/lib/db";
import { bookings, tables, users } from "@/lib/db/schema";
import { eq, and, or, sql, inArray, gte, lte, desc } from "drizzle-orm";

export async function getTableStatuses(
  floorPlanId: string,
  date: string,
  arrivalTime: string,
  departureTime: string
): Promise<Record<string, "available" | "pending" | "booked">> {
  // Get all tables for this floor plan
  const allTables = await db
    .select({ id: tables.id })
    .from(tables)
    .where(eq(tables.floorPlanId, floorPlanId));

  // Get overlapping bookings for the given date and time range
  // Overlap condition: existing.arrival < new.departure AND existing.departure > new.arrival
  const overlappingBookings = await db
    .select({
      tableId: bookings.tableId,
      status: bookings.status,
    })
    .from(bookings)
    .innerJoin(tables, eq(tables.id, bookings.tableId))
    .where(
      and(
        eq(tables.floorPlanId, floorPlanId),
        eq(bookings.bookingDate, date),
        inArray(bookings.status, ["approved", "pending"]),
        // Handle midnight crossing for time overlap
        sql`(
          CASE
            WHEN ${bookings.arrivalTime} < ${bookings.departureTime} THEN
              ${bookings.arrivalTime} < ${departureTime}::time AND ${bookings.departureTime} > ${arrivalTime}::time
            ELSE
              (${bookings.arrivalTime} < ${departureTime}::time OR ${bookings.departureTime} > ${arrivalTime}::time)
          END
        )`
      )
    );

  const statusMap: Record<string, "available" | "pending" | "booked"> = {};

  // Default all tables to available
  for (const table of allTables) {
    statusMap[table.id] = "available";
  }

  // Update based on overlapping bookings (booked takes precedence over pending)
  for (const booking of overlappingBookings) {
    const currentStatus = statusMap[booking.tableId];
    if (booking.status === "approved") {
      statusMap[booking.tableId] = "booked";
    } else if (booking.status === "pending" && currentStatus !== "booked") {
      statusMap[booking.tableId] = "pending";
    }
  }

  return statusMap;
}

export async function createBooking(data: {
  userId?: string | null;
  tableId: string;
  reservationName: string;
  guestCount: number;
  guestEmail?: string | null;
  bookingDate: string;
  arrivalTime: string;
  departureTime: string;
  comment?: string | null;
  createdByAdmin?: boolean;
  status?: string;
}) {
  const [booking] = await db
    .insert(bookings)
    .values({
      userId: data.userId ?? null,
      tableId: data.tableId,
      reservationName: data.reservationName,
      guestCount: data.guestCount,
      guestEmail: data.guestEmail ?? null,
      bookingDate: data.bookingDate,
      arrivalTime: data.arrivalTime,
      departureTime: data.departureTime,
      comment: data.comment ?? null,
      createdByAdmin: data.createdByAdmin ?? false,
      status: (data.status as "pending" | "approved") ?? "pending",
    })
    .returning();

  return booking;
}

export async function getBookingById(id: string) {
  const result = await db
    .select({
      booking: bookings,
      table: tables,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(bookings)
    .innerJoin(tables, eq(tables.id, bookings.tableId))
    .leftJoin(users, eq(users.id, bookings.userId))
    .where(eq(bookings.id, id))
    .limit(1);

  if (!result.length) return null;

  return {
    ...result[0].booking,
    table: result[0].table,
    user: result[0].user,
  };
}

export async function getUserBookings(userId: string) {
  const result = await db
    .select({
      booking: bookings,
      table: tables,
    })
    .from(bookings)
    .innerJoin(tables, eq(tables.id, bookings.tableId))
    .where(eq(bookings.userId, userId))
    .orderBy(desc(bookings.createdAt));

  return result.map((r) => ({
    ...r.booking,
    table: r.table,
  }));
}

export async function getAdminBookings(filters?: {
  status?: string;
  date?: string;
}) {
  const conditions = [];

  if (filters?.status) {
    conditions.push(eq(bookings.status, filters.status as "pending" | "approved" | "rejected" | "cancelled"));
  }
  if (filters?.date) {
    conditions.push(eq(bookings.bookingDate, filters.date));
  }

  const result = await db
    .select({
      booking: bookings,
      table: tables,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(bookings)
    .innerJoin(tables, eq(tables.id, bookings.tableId))
    .leftJoin(users, eq(users.id, bookings.userId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(bookings.createdAt));

  return result.map((r) => ({
    ...r.booking,
    table: r.table,
    user: r.user,
  }));
}

export async function updateBookingStatus(
  id: string,
  status: "approved" | "rejected" | "cancelled",
  adminNote?: string
) {
  const [updated] = await db
    .update(bookings)
    .set({
      status,
      adminNote: adminNote ?? null,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, id))
    .returning();

  return updated;
}

export async function updateBooking(
  id: string,
  data: {
    guestCount?: number;
    comment?: string | null;
    reservationName?: string;
  }
) {
  const [updated] = await db
    .update(bookings)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, id))
    .returning();

  return updated;
}

export async function getPendingBookingsCount() {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(eq(bookings.status, "pending"));

  return result[0]?.count ?? 0;
}

export async function getTodayBookingsCount() {
  const today = new Date().toISOString().split("T")[0];
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(
      and(
        eq(bookings.bookingDate, today),
        inArray(bookings.status, ["approved", "pending"])
      )
    );

  return result[0]?.count ?? 0;
}
