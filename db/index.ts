import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
let pool: Pool | undefined;
export function getPool() {
 if (!process.env.DATABASE_URL) throw new Error("Banco de dados ainda não configurado.");
 return pool ??= new Pool({connectionString:process.env.DATABASE_URL, max:5});
}
export function getDb() { return drizzle(getPool(), {schema}); }
