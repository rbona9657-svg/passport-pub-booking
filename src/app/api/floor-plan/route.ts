import { NextResponse } from "next/server";
import { getActiveFloorPlan, saveFloorPlan } from "@/lib/db/queries/floor-plans";
import { saveFloorPlanSchema } from "@/lib/validations";

export async function GET() {
  try {
    const floorPlan = await getActiveFloorPlan();
    return NextResponse.json(floorPlan);
  } catch (error) {
    console.error("Error fetching floor plan:", error);
    return NextResponse.json({ error: "Failed to fetch floor plan" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = saveFloorPlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const floorPlan = await saveFloorPlan(parsed.data);
    return NextResponse.json(floorPlan);
  } catch (error) {
    console.error("Error saving floor plan:", error);
    return NextResponse.json({ error: "Failed to save floor plan" }, { status: 500 });
  }
}
