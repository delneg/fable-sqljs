import type {Database, InitSqlJsStatic} from "sql.js";
import initSqlJs from "@jlongster/sql.js";
import {SQLiteFS} from "absurd-sql";
import IndexedDBBackend from "absurd-sql/dist/indexeddb-backend";
import {expose} from "comlink";

let _db: Database | null = null;
function db() {
  if (_db == null) {
    throw new Error("not initialized");
  }
  return _db;
}

async function setupSqljs(dbPath: string) {
  const SQL = await (initSqlJs as InitSqlJsStatic)({
    locateFile: (file: string) => file,
  });
  // @ts-ignore
  const sqlFS = new SQLiteFS(SQL.FS, new IndexedDBBackend());
  // @ts-ignore
  SQL.register_for_idb(sqlFS);
  // @ts-ignore
  SQL.FS.mkdir("/sql");
  // @ts-ignore
  SQL.FS.mount(sqlFS, {}, "/sql");
  class PatchedDatabase extends SQL.Database {
    constructor() {
      // @ts-ignore
      super(dbPath, { filename: true });
      // Set indexeddb page size
      this.exec(`PRAGMA page_size=8192;PRAGMA journal_mode=MEMORY;`);
    }
  }
  _db = new PatchedDatabase();
}
async function setup() {
  // with /sql/ namespace
  const DBNAME = "/sql/db.sqlite";
  await setupSqljs(DBNAME);
  // conn = await createConnection({
  //   type: "sqljs", // this connection search window.SQL on browser
  //   location: DBNAME,
  //   autoSave: false, // commit by absurd-sql
  //   synchronize: true,
  //   entities: [User],
  //   logging: ["query", "schema"],
  // });
  // userRepository = conn.getRepository(User);
}

async function execRaw(query: string) {
  return db().exec(query);
}
async function run(query: string, args: any[] = []) {
  if (args.length === 0) {
    const stmt = db().prepare(`SELECT SUM(value) FROM kv`);
    stmt.step();
    const result = stmt.getAsObject();
    stmt.free();
    return result;
  } else {
    const stmt = db().prepare(query);
    stmt.run(args);
    const result = stmt.getAsObject();
    stmt.free();
    return result;
  }
}

async function runMany(query: string, argsList: Array<Array<any>> = []) {
  db().exec("BEGIN TRANSACTION");
  const stmt = db().prepare(query);
  const results = argsList.map((args) => {
    stmt.run(args);
    return stmt.getAsObject();
  });
  stmt.free();
  db().exec("COMMIT");
  return results;
}

const api = { setup, run ,execRaw, runMany };
export type Api = typeof api;

expose(api);
