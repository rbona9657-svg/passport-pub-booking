import { z } from "zod";

/** Convert HH:MM to minutes since pub opening (16:00). Handles past-midnight wrap. */
export function toMinutesSinceOpen(time: string): number {
  const [h, m] = time.split(":").map(Number);
  // Hours 0-5 are "next day" (after midnight), so add 24
  const adjusted = h < 16 ? h + 24 : h;
  return adjusted * 60 + m;
}

const timeRefinement = (data: { arrivalTime: string; departureTime: string }) =>
  toMinutesSinceOpen(data.departureTime) > toMinutesSinceOpen(data.arrivalTime);

const timeRefinementMeta = {
  message: "Departure time must be after arrival time",
  path: ["departureTime"] as string[],
};

const createBookingBase = z.object({
  tableId: z.string().uuid(),
  reservationName: z.string().min(2, "Name must be at least 2 characters").max(100),
  guestEmail: z.string().email("Please enter a valid email address"),
  guestCount: z.number().int().min(1, "At least 1 guest required").max(20),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  arrivalTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  departureTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  comment: z.string().max(500).optional().nullable(),
});

export const createBookingSchema = createBookingBase.refine(timeRefinement, timeRefinementMeta);

export const createBookingAdminSchema = createBookingBase
  .extend({ guestEmail: z.string().email().optional() })
  .refine(timeRefinement, timeRefinementMeta);

export const updateBookingSchema = z.object({
  guestCount: z.number().int().min(1).max(20).optional(),
  comment: z.string().max(500).optional().nullable(),
  reservationName: z.string().min(2).max(100).optional(),
});

export const rejectBookingSchema = z.object({
  reason: z.string().min(1, "Please provide a reason").max(500),
});

export const quickBookSchema = z.object({
  tableId: z.string().uuid(),
  reservationName: z.string().min(2).max(100),
  guestCount: z.number().int().min(1).max(20),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  arrivalTime: z.string().regex(/^\d{2}:\d{2}$/),
  departureTime: z.string().regex(/^\d{2}:\d{2}$/),
  comment: z.string().max(500).optional().nullable(),
  source: z.enum(["online", "phone", "voice"]).optional(),
}).refine((data) => toMinutesSinceOpen(data.departureTime) > toMinutesSinceOpen(data.arrivalTime), {
  message: "Departure time must be after arrival time",
  path: ["departureTime"],
});

export const saveFloorPlanSchema = z.object({
  name: z.string().min(1).max(255),
  tables: z.array(
    z.object({
      id: z.string().uuid().optional(),
      tableNumber: z.string().min(1).max(50),
      seats: z.number().int().min(1).max(20),
      positionX: z.number(),
      positionY: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
      rotation: z.number().default(0),
      shape: z.enum(["rect", "circle", "ellipse"]).default("rect"),
    })
  ),
  visualElements: z.array(
    z.object({
      id: z.string().uuid().optional(),
      type: z.enum(["entrance", "tv", "toilet", "bar", "wall", "stage", "custom"]),
      positionX: z.number(),
      positionY: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
      rotation: z.number().default(0),
      label: z.string().max(100).optional().nullable(),
      icon: z.string().max(50).optional().nullable(),
    })
  ),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
export type RejectBookingInput = z.infer<typeof rejectBookingSchema>;
export type QuickBookInput = z.infer<typeof quickBookSchema>;
export type SaveFloorPlanInput = z.infer<typeof saveFloorPlanSchema>;
