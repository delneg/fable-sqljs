module Worker

open System
open Fable.Core
open Fable.Core.JsInterop

let [<Import("default", from="@jlongster/sql.js")>] initSqlJsStatic: SqlJs.InitSqlJsStatic = jsNative

//type SQLiteFS(a: obj,b: obj) = class end

type [<AllowNullLiteral>] SQLiteFS = 
    [<Emit "new $0($1...)">] abstract Constructor: obj * obj -> obj
let [<Import("SQLiteFS", from="absurd-sql")>] sqlitefs: obj = jsNative

let [<Import("default", from="bsurd-sql/dist/indexeddb-backend")>] IndexedDBBackend: obj = jsNative

let [<Import("default","comlink")>] comlink: Comlink.IExports = jsNative

let mutable _db : SqlJs.Database option = None


let db() =
   match _db with
   | None -> failwith "not initialized"
   | Some db -> db


type SqlJsConfig() =
   interface SqlJs.SqlJsConfig with
      override __.locateFile(s,_)= s
   
type PatchedDatabase(s:string, obj) =
   do
      jsThis?exec("PRAGMA page_size=8192;PRAGMA journal_mode=MEMORY;PRAGMA mmap_size=0;PRAGMA synchronous=NORMAL;PRAGMA temp_store=MEMORY")
let setupSqlJs (dbPath:string) = promise {
   let! SQL = initSqlJsStatic.Invoke(SqlJsConfig())
   
   let sqlFs = createNew sqlitefs (SQL.FS, createNew IndexedDBBackend)
   
   SQL.register_for_idb(sqlFs)
   
   SQL.FS?mkdir("/sql")
   SQL.FS?mount(sqlFs, {||},"/sql")
   let db: SqlJs.Database = createNew SQL.Database (dbPath, {|filename=true|}) :?> SqlJs.Database
   db?exec("PRAGMA page_size=8192;PRAGMA journal_mode=MEMORY;PRAGMA mmap_size=0;PRAGMA synchronous=NORMAL;PRAGMA temp_store=MEMORY")
   _db <- Some db
}

let setup() = promise {
    // with /sql/ namespace
    let dbname = "/sql/db.sqlite"
    do! setupSqlJs(dbname)
}


let execRaw (query: string) = promise {
   return db().exec(query)
}

type IApi =
   abstract member execRaw: unit -> JS.Promise<ResizeArray<SqlJs.QueryExecResult>>
   abstract member setup: unit -> JS.Promise<unit>
      
   
comlink.expose(Some(createObj [ "setup",setup :> obj; "execRaw", execRaw :> obj ]))
   
   