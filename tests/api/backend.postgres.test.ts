// @vitest-environment node
/*
 * The same API suite against Postgres, through the production driver (`pg`), talking to an
 * in-process Postgres (PGlite) over the wire protocol. No Docker or external database needed.
 */
import net from "node:net";
import { afterAll, beforeAll } from "vitest";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { __useStoreForTests } from "../../src/data/persistence/server-db";
import { createPostgresStore } from "../../src/data/persistence/server-pg";
import { backendSuite } from "./backend.suite";

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
  });
}

let db: PGlite;
let server: PGLiteSocketServer;
let pool: Pool;

beforeAll(async () => {
  db = await PGlite.create();
  const port = await freePort();
  server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 8 });
  await server.start();
  pool = new Pool({ host: "127.0.0.1", port, user: "postgres", database: "postgres", max: 4 });
  __useStoreForTests(createPostgresStore(pool));
}, 60_000);

afterAll(async () => {
  await pool?.end();
  await server?.stop();
  await db?.close();
});

backendSuite("postgres");
