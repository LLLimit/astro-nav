import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql, { type Pool } from "mysql2/promise";
import * as schema from "./schema";

let connection: MySql2Database<typeof schema> | undefined;
let pool: Pool | undefined;

export function db(): MySql2Database<typeof schema> {
  if (!connection) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL 未配置");
    pool = mysql.createPool({
      uri: url,
      connectionLimit: 10,
      charset: "utf8mb4",
      waitForConnections: true,
    });
    connection = drizzle({ client: pool, schema, mode: "default" });
  }
  return connection;
}

export async function closeDb() {
  if (pool) await pool.end();
  pool = undefined;
  connection = undefined;
}
