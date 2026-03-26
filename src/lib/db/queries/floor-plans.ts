import { db } from "@/lib/db";
import { floorPlans, tables, visualElements } from "@/lib/db/schema";
import { eq, and, inArray, notInArray } from "drizzle-orm";

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
  viewportCrop?: { x: number; y: number; width: number; height: number } | null;
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
    // Update the floor plan name and viewport config
    await db
      .update(floorPlans)
      .set({
        name: data.name,
        viewportConfig: data.viewportCrop ? { crop: data.viewportCrop } : null,
        updatedAt: new Date(),
      })
      .where(eq(floorPlans.id, floorPlanId));

    // Get existing table IDs from the database
    const dbTables = await db
      .select({ id: tables.id })
      .from(tables)
      .where(eq(tables.floorPlanId, floorPlanId));
    const dbTableIds = new Set(dbTables.map((t) => t.id));

    // Separate into tables to update (exist in DB) vs insert (new)
    const tablesToUpdate = data.tables.filter((t) => t.id && dbTableIds.has(t.id));
    const tablesToInsert = data.tables.filter((t) => !t.id || !dbTableIds.has(t.id));
    const keepTableIds = tablesToUpdate.map((t) => t.id!);

    // Delete only tables that were removed from the layout
    // This cascades to their bookings, which is intentional when a table is removed
    if (keepTableIds.length > 0) {
      await db.delete(tables).where(
        and(
          eq(tables.floorPlanId, floorPlanId),
          notInArray(tables.id, keepTableIds)
        )
      );
    } else {
      // All tables removed
      await db.delete(tables).where(eq(tables.floorPlanId, floorPlanId));
    }

    // Update existing tables in place (preserves IDs and bookings)
    for (const t of tablesToUpdate) {
      await db
        .update(tables)
        .set({
          tableNumber: t.tableNumber,
          seats: t.seats,
          positionX: t.positionX,
          positionY: t.positionY,
          width: t.width,
          height: t.height,
          rotation: t.rotation,
          shape: t.shape,
        })
        .where(eq(tables.id, t.id!));
    }

    // Insert new tables (without client-generated IDs so DB assigns proper ones)
    if (tablesToInsert.length > 0) {
      await db.insert(tables).values(
        tablesToInsert.map((t) => ({
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

    // Visual elements don't have bookings, safe to delete and re-insert
    await db.delete(visualElements).where(eq(visualElements.floorPlanId, floorPlanId));
  } else {
    // Create new floor plan
    const [newPlan] = await db
      .insert(floorPlans)
      .values({
        name: data.name,
        isActive: true,
        viewportConfig: data.viewportCrop ? { crop: data.viewportCrop } : null,
      })
      .returning();
    floorPlanId = newPlan.id;

    // Insert all tables as new
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
