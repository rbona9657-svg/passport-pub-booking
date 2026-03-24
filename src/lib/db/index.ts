import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is not set");
}

const sql = neon(process.env.DATABASE_URL || "postgresql://localhost/placeholder");
export const db = drizzle(sql, { schema });
