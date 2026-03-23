import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  users,
  floorPlans,
  tables,
  visualElements,
  bookings,
  pushSubscriptions,
  bookingStatusEnum,
  tableShapeEnum,
  elementTypeEnum,
  roleEnum,
} from "@/lib/db/schema";

// ── Inferred select types ──────────────────────────────────────────────────────

export type User = InferSelectModel<typeof users>;
export type FloorPlan = InferSelectModel<typeof floorPlans>;
export type PubTable = InferSelectModel<typeof tables>;
export type VisualElement = InferSelectModel<typeof visualElements>;
export type Booking = InferSelectModel<typeof bookings>;
export type PushSubscription = InferSelectModel<typeof pushSubscriptions>;

// ── Inferred insert types ──────────────────────────────────────────────────────

export type NewUser = InferInsertModel<typeof users>;
export type NewFloorPlan = InferInsertModel<typeof floorPlans>;
export type NewPubTable = InferInsertModel<typeof tables>;
export type NewVisualElement = InferInsertModel<typeof visualElements>;
export type NewBooking = InferInsertModel<typeof bookings>;
export type NewPushSubscription = InferInsertModel<typeof pushSubscriptions>;

// ── Enum value types ───────────────────────────────────────────────────────────

export type BookingStatus = (typeof bookingStatusEnum.enumValues)[number];
export type TableShape = (typeof tableShapeEnum.enumValues)[number];
export type ElementType = (typeof elementTypeEnum.enumValues)[number];
export type UserRole = (typeof roleEnum.enumValues)[number];

// ── Composite interfaces ──────────────────────────────────────────────────────

export interface TableWithStatus extends PubTable {
  status: "available" | "pending" | "booked";
}

export interface BookingWithDetails extends Booking {
  table?: PubTable;
  user?: Pick<User, "id" | "name" | "email">;
}

export interface FloorPlanWithElements extends FloorPlan {
  tables: PubTable[];
  visualElements: VisualElement[];
}
