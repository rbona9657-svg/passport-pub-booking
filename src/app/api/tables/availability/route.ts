import { NextRequest, NextResponse } from "next/server";
import { getTableStatuses } from "@/lib/db/queries/bookings";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const floorPlanId = searchParams.get("floorPlanId");
    const date = searchParams.get("date");
    const arrival = searchParams.get("arrival");
    const departure = searchParams.get("departure");

    if (!floorPlanId || !date || !arrival || !departure) {
      return NextResponse.json(
        { error: "Missing required parameters: floorPlanId, date, arrival, departure" },
        { status: 400 }
      );
    }

    const statuses = await getTableStatuses(floorPlanId, date, arrival, departure);
    return NextResponse.json(statuses);
  } catch (error) {
    console.error("Error checking availability:", error);
    return NextResponse.json({ error: "Failed to check availability" }, { status: 500 });
  }
}
