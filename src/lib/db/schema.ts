import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  real,
  timestamp,
  date,
  time,
  pgEnum,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Enums ──────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);
export const tableShapeEnum = pgEnum("table_shape", [
  "rect",
  "circle",
  "ellipse",
]);
export const elementTypeEnum = pgEnum("element_type", [
  "entrance",
  "tv",
  "toilet",
  "bar",
  "wall",
  "stage",
  "custom",
]);

// ── Users ──────────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 255 }).notNull(),
    emailVerified: timestamp("email_verified", { mode: "date" }),
    image: varchar("image", { length: 255 }),
    role: roleEnum("role").default("user"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)]
);

// ── Accounts (NextAuth) ────────────────────────────────────────────────────────

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 255 }).notNull(),
  providerAccountId: varchar("provider_account_id", {
    length: 255,
  }).notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: varchar("token_type", { length: 255 }),
  scope: varchar("scope", { length: 255 }),
  id_token: text("id_token"),
  session_state: varchar("session_state", { length: 255 }),
});

// ── Sessions (NextAuth) ────────────────────────────────────────────────────────

export const sessions = pgTable("sessions", {
  sessionToken: varchar("session_token", { length: 255 }).notNull().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

// ── Verification Tokens (NextAuth) ─────────────────────────────────────────────

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.identifier, table.token] }),
  ]
);

// ── Floor Plans ────────────────────────────────────────────────────────────────

export const floorPlans = pgTable("floor_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(false),
  viewportConfig: jsonb("viewport_config"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// ── Tables ─────────────────────────────────────────────────────────────────────

export const tables = pgTable(
  "tables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    floorPlanId: uuid("floor_plan_id")
      .notNull()
      .references(() => floorPlans.id, { onDelete: "cascade" }),
    tableNumber: varchar("table_number", { length: 50 }).notNull(),
    seats: integer("seats").notNull(),
    positionX: real("position_x").notNull(),
    positionY: real("position_y").notNull(),
    width: real("width").default(80),
    height: real("height").default(80),
    rotation: real("rotation").default(0),
    shape: tableShapeEnum("shape").default("rect"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => [index("tables_floor_plan_id_idx").on(table.floorPlanId)]
);

// ── Visual Elements ────────────────────────────────────────────────────────────

export const visualElements = pgTable("visual_elements", {
  id: uuid("id").defaultRandom().primaryKey(),
  floorPlanId: uuid("floor_plan_id")
    .notNull()
    .references(() => floorPlans.id, { onDelete: "cascade" }),
  type: elementTypeEnum("type").notNull(),
  positionX: real("position_x").notNull(),
  positionY: real("position_y").notNull(),
  width: real("width").default(60),
  height: real("height").default(60),
  rotation: real("rotation").default(0),
  label: varchar("label", { length: 100 }),
  icon: varchar("icon", { length: 50 }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ── Bookings ───────────────────────────────────────────────────────────────────

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    tableId: uuid("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),
    reservationName: varchar("reservation_name", { length: 255 }).notNull(),
    guestCount: integer("guest_count").notNull(),
    bookingDate: date("booking_date", { mode: "string" }).notNull(),
    arrivalTime: time("arrival_time").notNull(),
    departureTime: time("departure_time").notNull(),
    status: bookingStatusEnum("status").default("pending"),
    adminNote: text("admin_note"),
    comment: text("comment"),
    createdByAdmin: boolean("created_by_admin").default(false),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => [
    index("bookings_table_date_status_idx").on(
      table.tableId,
      table.bookingDate,
      table.status
    ),
    index("bookings_user_status_idx").on(table.userId, table.status),
    index("bookings_status_created_idx").on(table.status, table.createdAt),
  ]
);

// ── Push Subscriptions ─────────────────────────────────────────────────────────

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  authKey: text("auth_key").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// ── Relations ──────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  bookings: many(bookings),
  pushSubscriptions: many(pushSubscriptions),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const floorPlansRelations = relations(floorPlans, ({ many }) => ({
  tables: many(tables),
  visualElements: many(visualElements),
}));

export const tablesRelations = relations(tables, ({ one, many }) => ({
  floorPlan: one(floorPlans, {
    fields: [tables.floorPlanId],
    references: [floorPlans.id],
  }),
  bookings: many(bookings),
}));

export const visualElementsRelations = relations(
  visualElements,
  ({ one }) => ({
    floorPlan: one(floorPlans, {
      fields: [visualElements.floorPlanId],
      references: [floorPlans.id],
    }),
  })
);

export const bookingsRelations = relations(bookings, ({ one }) => ({
  user: one(users, {
    fields: [bookings.userId],
    references: [users.id],
  }),
  table: one(tables, {
    fields: [bookings.tableId],
    references: [tables.id],
  }),
}));

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscriptions.userId],
      references: [users.id],
    }),
  })
);
