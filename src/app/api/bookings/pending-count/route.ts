import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPendingBookingsCount } from "@/lib/db/queries/bookings";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const count = await getPendingBookingsCount();
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
