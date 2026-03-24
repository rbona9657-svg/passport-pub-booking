# Mobile Admin Platform - Implementation Plan

## Context & Current State

The app already has admin pages (`/admin/*`) with floor plan editor, quick-book, dashboard, and bookings list. It's a Next.js 15 app with Drizzle/PostgreSQL, NextAuth v5 (email magic links, JWT, admin role via `ADMIN_EMAILS`), Konva.js canvas, and a PWA setup (manifest + service worker + push notifications). Deployed on Railway.

**Key insight**: Much of the infrastructure exists. The work is primarily about creating a **mobile-optimized admin experience** and adding the **voice assistant** feature.

---

## Architecture Decision: Dedicated Mobile Admin Route

Create a new route group `/admin/mobile/*` with a mobile-first layout, rather than retrofitting existing desktop admin pages. This keeps the desktop admin untouched and gives full control over the mobile UX.

**Access control**: Same as existing admin — NextAuth middleware checks `role === "admin"`. Only users with emails in `ADMIN_EMAILS` get access. No changes needed to auth.

---

## Feature 1: Mobile Floor Plan Editor

**Route**: `/admin/mobile/floor-plan`

### Changes needed:

1. **New page**: `src/app/admin/mobile/floor-plan/page.tsx`
   - Reuses the existing `FloorPlanCanvas` component (already supports responsive sizing)
   - Mobile-optimized toolbar: collapsible bottom sheet instead of side panel
   - Touch gestures: pinch-to-zoom (Konva supports this), drag to pan, tap to select
   - Simplified controls: large touch targets, floating action buttons

2. **New component**: `src/components/canvas/MobileCanvasToolbar.tsx`
   - Bottom sheet UI with icon-only buttons (add table, add element, delete, save)
   - Expandable sections for table config (shape, seats, number)
   - Uses existing `TableConfigDialog` but styled as a bottom sheet modal

3. **Modify**: `src/components/canvas/FloorPlanCanvas.tsx`
   - Add touch event handling props (pinch zoom, two-finger pan)
   - Add a `compact` prop to hide desktop-specific UI elements
   - Ensure drag handles are large enough for finger interaction (min 44x44px)

4. **API**: No changes needed — reuses existing `POST /api/floor-plan`

### Key considerations:
- Konva.js already supports touch events natively
- The canvas `containerSize` is already dynamically calculated
- Grid snapping (GRID_SIZE=20) works the same on mobile

---

## Feature 2: Daily Bookings Review

**Route**: `/admin/mobile/bookings`

### Changes needed:

1. **New page**: `src/app/admin/mobile/bookings/page.tsx`
   - Default view: today's bookings
   - Calendar date picker at the top (tap to open, shows selected date)
   - Bookings listed as cards, grouped by time slot (arrival time)
   - Each card shows: reservation name, table number, guest count, arrival/departure, status badge
   - Swipe actions: approve (right), reject (left) for pending bookings
   - Pull-to-refresh using SWR's `mutate`

2. **New component**: `src/components/admin/mobile/DailyBookingsList.tsx`
   - Fetches from existing `GET /api/bookings?date=YYYY-MM-DD`
   - Groups bookings by hour slot
   - Color-coded status badges (pending=yellow, approved=green, rejected=red, cancelled=gray)
   - Tap card to expand details (email, special requests, created time)

3. **New component**: `src/components/admin/mobile/BookingCard.tsx`
   - Compact card with key info
   - Inline approve/reject buttons for pending bookings
   - Calls existing `POST /api/bookings/[id]/approve` and `POST /api/bookings/[id]/reject`

4. **Modify**: `GET /api/bookings/route.ts`
   - Add `date` query parameter filter (currently returns all bookings for admin)
   - Filter: `WHERE bookingDate = :date` when `date` param provided
   - This is a small addition to the existing endpoint

### Key considerations:
- Use a lightweight date picker (e.g., native `<input type="date">` or a simple custom calendar component)
- SWR for data fetching with auto-refresh interval (every 30s) to catch new bookings
- Existing approve/reject API endpoints work as-is

---

## Feature 3: Phone Booking Recorder (Manual)

**Route**: `/admin/mobile/quick-book`

### Changes needed:

1. **New page**: `src/app/admin/mobile/quick-book/page.tsx`
   - Mobile-optimized multi-step form (one field per screen, swipeable)
   - Step 1: Date picker (default today) + arrival/departure time selectors
   - Step 2: Interactive floor plan showing available tables (tap to select)
   - Step 3: Guest details — name, phone/email (optional for phone bookings), guest count
   - Step 4: Review & confirm
   - Auto-approves on submit (same as existing quick-book behavior)

2. **New component**: `src/components/admin/mobile/QuickBookWizard.tsx`
   - Step-by-step wizard with progress indicator
   - Large touch-friendly inputs
   - Time selector: scrollable wheel or large button grid for available hours
   - Table availability check via existing `GET /api/tables/availability`

3. **Modify**: `POST /api/bookings/route.ts`
   - Make `guestEmail` optional when the request comes from an admin session
   - Add `source` field to booking: `"online"` | `"phone"` | `"voice"` (new column in DB)
   - Admin-created bookings get auto-approved status

4. **Database migration**: Add `source` column to bookings table
   - File: new migration in `drizzle/` folder
   - Schema change in `src/db/schema.ts`: add `source` varchar field with default `"online"`

### Key considerations:
- Reuse `FloorPlanCanvas` in `booking` mode (read-only with table selection)
- The existing quick-book page already auto-approves; replicate that logic
- Phone number field is useful for phone bookings (consider adding to schema if not present)

---

## Feature 4: Voice Assistant Booking

**Route**: `/admin/mobile/voice-book`

### Changes needed:

1. **New page**: `src/app/admin/mobile/voice-book/page.tsx`
   - Single large "Record" button (microphone icon)
   - Press-and-hold or tap-to-toggle recording
   - Visual feedback: pulsing animation while recording, waveform display
   - Transcribed text appears in real-time
   - Parsed booking fields shown as editable cards
   - Confirm button to submit

2. **New component**: `src/components/admin/mobile/VoiceRecorder.tsx`
   - Uses **Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`)
   - Browser-native, no external API needed, works offline
   - Continuous recognition mode with interim results
   - Language: English (configurable)
   - Visual: microphone button with recording state animation

3. **New component**: `src/components/admin/mobile/VoiceBookingParser.tsx`
   - Parses transcribed text to extract booking fields
   - Pattern matching for: name, date, time, guest count, table number
   - Example: "Book a table for John Smith, 4 people, tomorrow at 7pm, table 5"
   - Extracted fields populate editable form fields
   - Unrecognized fields highlighted for manual input

4. **New lib**: `src/lib/voice-parser.ts`
   - Pure function: `parseBookingFromText(transcript: string) => Partial<BookingFields>`
   - Regex + keyword matching patterns:
     - Names: "for [Name]", "name is [Name]"
     - Guest count: "[N] people", "[N] guests", "party of [N]"
     - Date: "today", "tomorrow", "Saturday", "March 25th", etc.
     - Time: "at [time]", "[N] pm/am", "[N] o'clock"
     - Table: "table [N]"
   - Returns confidence scores for each field
   - Unit testable independently

5. **New hook**: `src/hooks/useVoiceRecognition.ts`
   - Wraps Web Speech API with React state management
   - States: idle, listening, processing, error
   - Handles browser compatibility (Chrome, Safari, Edge)
   - Fallback message for unsupported browsers (Firefox)
   - Auto-stop after silence timeout (5 seconds)

6. **API**: Reuses same `POST /api/bookings` with `source: "voice"`

### Key considerations:
- Web Speech API is free and runs entirely in the browser
- Works best in Chrome (Android) and Safari (iOS) — perfect for mobile admin use
- No server-side speech processing needed
- The parser is intentionally simple (regex-based) — can be upgraded to LLM-based later
- Fallback: if voice parsing fails, fields are manually editable

---

## Shared: Mobile Admin Layout & Navigation

### New files:

1. **Layout**: `src/app/admin/mobile/layout.tsx`
   - Bottom tab navigation (4 tabs matching the 4 features)
   - Icons: Grid (floor plan), Calendar (bookings), Phone (quick book), Mic (voice book)
   - Sticky header with "Admin" badge and sign-out button
   - Full-screen on mobile (hides browser chrome via PWA standalone mode)
   - `viewport` meta tag for mobile optimization

2. **PWA update**: Update `manifest.json`
   - Add `start_url: "/admin/mobile/bookings"` as alternate start URL for admin
   - Or: add a launcher page that detects admin role and redirects

3. **Navigation helper**: Add link from existing admin sidebar to mobile admin
   - Small change in `src/app/admin/layout.tsx`: add "Mobile View" link

---

## File Structure Summary

```
src/
├── app/admin/mobile/
│   ├── layout.tsx                    # Mobile admin layout with bottom tabs
│   ├── floor-plan/page.tsx           # Mobile floor plan editor
│   ├── bookings/page.tsx             # Daily bookings review
│   ├── quick-book/page.tsx           # Phone booking wizard
│   └── voice-book/page.tsx           # Voice assistant booking
├── components/admin/mobile/
│   ├── DailyBookingsList.tsx         # Bookings list grouped by time
│   ├── BookingCard.tsx               # Individual booking card
│   ├── QuickBookWizard.tsx           # Step-by-step booking form
│   ├── VoiceRecorder.tsx             # Voice recording UI
│   └── VoiceBookingParser.tsx        # Voice-to-fields display
├── components/canvas/
│   └── MobileCanvasToolbar.tsx       # Mobile-friendly canvas controls
├── hooks/
│   └── useVoiceRecognition.ts        # Web Speech API hook
└── lib/
    └── voice-parser.ts              # Text-to-booking-fields parser
```

## Database Changes

1. Add `source` column to `bookings` table: `varchar, default "online"`, values: `"online" | "phone" | "voice"`
2. Migration file in `drizzle/` folder

## Modified Existing Files

| File | Change |
|------|--------|
| `src/db/schema.ts` | Add `source` column to bookings |
| `src/app/api/bookings/route.ts` | Add `date` filter param; make `guestEmail` optional for admin; add `source` field |
| `src/components/canvas/FloorPlanCanvas.tsx` | Add `compact` prop, improve touch handling |
| `src/app/admin/layout.tsx` | Add "Mobile View" navigation link |
| `public/manifest.json` | Minor update for admin start URL |

## Implementation Order

1. **Phase 1**: Mobile layout + navigation (foundation)
2. **Phase 2**: Daily bookings review (simplest feature, immediate value)
3. **Phase 3**: Phone booking wizard (builds on existing quick-book)
4. **Phase 4**: Mobile floor plan editor (canvas touch optimization)
5. **Phase 5**: Voice assistant (most complex, built last)
6. **Phase 6**: Testing + polish (cross-browser, PWA, offline handling)

## No External Dependencies Required

- Web Speech API: built into browsers
- Touch events: built into Konva.js
- Date picker: native HTML or existing Radix UI components
- All UI: Tailwind CSS + existing Radix/shadcn components
