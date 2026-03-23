import { db } from "@/lib/db";
import { floorPlans, tables, visualElements } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function getActiveFloorPlan() {
  const plan = await db
    .select()
    .from(floorPlans)
    .where(eq(floorPlans.isActive, true))
    .limit(1);

  if (!plan.length) return null;

  const floorPlanTables = await db
    .select()
    .from(tables)
    .where(eq(tables.floorPlanId, plan[0].id));

  const elements = await db
    .select()
    .from(visualElements)
    .where(eq(visualElements.floorPlanId, plan[0].id));

  return {
    ...plan[0],
    tables: floorPlanTables,
    visualElements: elements,
  };
}

export async function getFloorPlanById(id: string) {
  const plan = await db
    .select()
    .from(floorPlans)
    .where(eq(floorPlans.id, id))
    .limit(1);

  if (!plan.length) return null;

  const floorPlanTables = await db
    .select()
    .from(tables)
    .where(eq(tables.floorPlanId, id));

  const elements = await db
    .select()
    .from(visualElements)
    .where(eq(visualElements.floorPlanId, id));

  return {
    ...plan[0],
    tables: floorPlanTables,
    visualElements: elements,
  };
}

export async function saveFloorPlan(data: {
  name: string;
  tables: Array<{
    id?: string;
    tableNumber: string;
    seats: number;
    positionX: number;
    positionY: number;
    width: number;
    height: number;
    rotation: number;
    shape: "rect" | "circle" | "ellipse";
  }>;
  visualElements: Array<{
    id?: string;
    type: "entrance" | "tv" | "toilet" | "bar" | "wall" | "stage" | "custom";
    positionX: number;
    positionY: number;
    width: number;
    height: number;
    rotation: number;
    label?: string | null;
    icon?: string | null;
  }>;
}) {
  // Check if there's an active floor plan
  const existing = await db
    .select()
    .from(floorPlans)
    .where(eq(floorPlans.isActive, true))
    .limit(1);

  let floorPlanId: string;

  if (existing.length) {
    floorPlanId = existing[0].id;
    // Update the floor plan name
    await db
      .update(floorPlans)
      .set({ name: data.name, updatedAt: new Date() })
      .where(eq(floorPlans.id, floorPlanId));

    // Delete old tables and elements that aren't in the new data
    const existingTableIds = data.tables
      .filter((t) => t.id)
      .map((t) => t.id!);
    const existingElementIds = data.visualElements
      .filter((e) => e.id)
      .map((e) => e.id!);

    // Delete tables not in update (only those without bookings)
    await db.delete(tables).where(
      and(
        eq(tables.floorPlanId, floorPlanId),
        existingTableIds.length > 0
          ? undefined // We'll handle per-table deletion below
          : undefined
      )
    );

    // Simpler approach: delete all and re-insert
    await db.delete(tables).where(eq(tables.floorPlanId, floorPlanId));
    await db.delete(visualElements).where(eq(visualElements.floorPlanId, floorPlanId));
  } else {
    // Create new floor plan
    const [newPlan] = await db
      .insert(floorPlans)
      .values({ name: data.name, isActive: true })
      .returning();
    floorPlanId = newPlan.id;
  }

  // Insert tables
  if (data.tables.length > 0) {
    await db.insert(tables).values(
      data.tables.map((t) => ({
        floorPlanId,
        tableNumber: t.tableNumber,
        seats: t.seats,
        positionX: t.positionX,
        positionY: t.positionY,
        width: t.width,
        height: t.height,
        rotation: t.rotation,
        shape: t.shape,
      }))
    );
  }

  // Insert visual elements
  if (data.visualElements.length > 0) {
    await db.insert(visualElements).values(
      data.visualElements.map((e) => ({
        floorPlanId,
        type: e.type,
        positionX: e.positionX,
        positionY: e.positionY,
        width: e.width,
        height: e.height,
        rotation: e.rotation,
        label: e.label ?? null,
        icon: e.icon ?? null,
      }))
    );
  }

  return getFloorPlanById(floorPlanId);
}
