import type { Database, InitSqlJsStatic } from "sql.js";
import initSqlJs from "@jlongster/sql.js";
import { SQLiteFS } from "absurd-sql";
import IndexedDBBackend from "absurd-sql/dist/indexeddb-backend";
// import { Connection, createConnection, Repository } from "typeorm";
// import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";
import { expose } from "comlink";

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

  const db = new PatchedDatabase();
  // const localStorageMock = {
  //   getItem() {
  //     return undefined;
  //   },
  //   setItem() {
  //     return undefined;
  //   },
  // };
  // // setup global env
  // Object.assign(globalThis as any, {
  //   SQL: {
  //     ...SQL,
  //     Database: PatchedDatabase,
  //   },
  //   localStorage: localStorageMock,
  //   window: globalThis,
  // });
  db.exec(`CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
  _db = db;
}

// @Entity()
// class User {
//   @PrimaryGeneratedColumn()
//   id: number;
//   @Column()
//   name: string;
// }

// let conn: Connection;
// let userRepository: Repository<User>;
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

// async function createUser() {
//   const user = new User();
//   user.id = Math.floor(Math.random() * 10000);
//   user.name = "dummy-user-" + Math.random().toString();
//   await userRepository.save(user);
//   return true;
// }
//
// async function getUsers() {
//   const users = await userRepository.find();
//   return users;
// }

async function init() {
  let SQL = await initSqlJs({ locateFile: (file: string) => file });
  let sqlFS = new SQLiteFS(SQL.FS, new IndexedDBBackend());
  SQL.register_for_idb(sqlFS);

  SQL.FS.mkdir("/sql");
  SQL.FS.mount(sqlFS, {}, "/sql");

  let db = new SQL.Database("/sql/db.sqlite", { filename: true });
  db.exec(`
    PRAGMA page_size=8192;
    PRAGMA journal_mode=MEMORY;
  `);
  return db;
}
async function runQueries() {
  let db = await init();

  try {
    db.exec("CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT)");
  } catch (e) {}

  db.exec("BEGIN TRANSACTION");
  let stmt = db.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)");
  for (let i = 0; i < 5; i++) {
    stmt.run([i, ((Math.random() * 100) | 0).toString()]);
  }
  stmt.free();
  db.exec("COMMIT");

  stmt = db.prepare(`SELECT * from users;`);
  stmt.step();
  const result = stmt.getAsObject();
  // console.log("Result:", result);
  stmt.free();
  return result;
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


const api = { setup, run ,execRaw, runMany, runQueries };
export type Api = typeof api;

expose(api);
