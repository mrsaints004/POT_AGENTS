import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let db: NeonHttpDatabase<typeof schema>;

if (process.env.DATABASE_URL) {
  const sql = neon(process.env.DATABASE_URL);
  db = drizzle(sql, { schema });
} else {
  console.warn("WARNING: DATABASE_URL not set — database operations will fail");
  // Create a proxy that throws helpful errors
  db = new Proxy({} as any, {
    get(_target, prop) {
      return (...args: any[]) => {
        throw new Error(`Database not configured. Set DATABASE_URL in .env`);
      };
    },
  });
}

export { db };
