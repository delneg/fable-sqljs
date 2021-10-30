module Worker

open System
open Fable.Core
open Fable.Core.JsInterop

//let [<Import("initSqlJs", from="@jlongster/sql.js")>] initSqlJsStatic: SqlJs.InitSqlJsStatic = jsNative

//let getTheme(x: int): IInterface = importDefault "my-lib"
// JS: import getTheme from "my-lib"

let initSqlJs: SqlJs.InitSqlJsStatic = importDefault "@jlongster/sql.js"
//type [<AllowNullLiteral>] SQLiteFS = 
//    [<Emit "new $0($1...)">] abstract Constructor: obj * obj -> obj
    
let [<Import("SQLiteFS", from="absurd-sql")>] sqlitefs: obj = jsNative

//let [<Import("IndexedDBBackend", from="absurd-sql/dist/indexeddb-backend")>] IndexedDBBackend: obj = jsNative
//type IndexedDbBackendType =
//   [<Emit "new $0($1...)">] abstract Constructor: unit -> obj

let IndexedDBBackend: JsConstructor = importDefault "absurd-sql/dist/indexeddb-backend"


let mutable _db : SqlJs.Database option = None

let db() =
   match _db with
   | None -> failwith "not initialized"
   | Some db -> db


type SqlJsConfig() =
   interface SqlJs.SqlJsConfig with
      override _.locateFile(s,_)= s
   
let setupSqlJs (dbPath:string) = promise {
   let! SQL = initSqlJs.Invoke(SqlJsConfig())
   
   let sqlFs = createNew sqlitefs (SQL.FS, IndexedDBBackend.Create())
   
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

let runMany (query:string) argsList =
   promise {
      db().exec("BEGIN TRANSACTION") |> ignore
      let stmt = db().prepare(query)
      let results = argsList
                    |> Array.map (fun args ->
                       stmt.run(!!args)
                       stmt.getAsObject()
                    )
      stmt.free() |> ignore
      db().exec("COMMIT") |> ignore
      return results
   }

let runPreparedStep(query: string) = promise {
   let stmt = db().prepare(query)
   stmt.step() |> ignore
   let result = stmt.getAsObject()
   stmt.free() |> ignore
   return result
}


type IApi =
   abstract member execRaw: string -> JS.Promise<ResizeArray<SqlJs.QueryExecResult>>
   abstract member setup: unit -> JS.Promise<unit>
   
   abstract member runMany: string -> obj [] -> JS.Promise<SqlJs.ParamsObject []>
   abstract member runPreparedStep: string-> JS.Promise<SqlJs.ParamsObject>
   
let api = createObj [
                      "setup" ==> setup
                      "execRaw" ==> execRaw
                      "runMany" ==> runMany
                      "runPreparedStep" ==> runPreparedStep
                      ]

Comlink.expose(api)
   
   