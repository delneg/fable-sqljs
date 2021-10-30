module App

open Fable.Core
open Fable.Core.JsInterop
let [<Import("initBackend", from="absurd-sql/dist/indexeddb-main-thread")>] initBackend: obj -> unit = jsNative
module Url =
    type URLType =
      [<Emit("new $0($1,import.meta.url)")>] abstract CreateImportMetaUrl: url: string -> Browser.Types.URL
    let [<Global>] URL: URLType = jsNative
    
module CustomWorker =
    type CustomWorkerConstructor =
      [<Emit("new $0($1...)")>] abstract Create: url: Browser.Types.URL * ?options: Browser.Types.WorkerOptions -> Browser.Types.Worker
      
    let [<Global>] Worker: CustomWorkerConstructor = jsNative
    
    
let worker = CustomWorker.Worker.Create(Url.URL.CreateImportMetaUrl("./Worker.fs.js"))

initBackend(worker)

let api: Comlink.Remote<Worker.IApi> = Comlink.wrap(worker :?> Comlink.Protocol.Endpoint)


let createKvTableQuery =
  "CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT
  )"


let window = Browser.Dom.window
let init() = promise {
  window.document.body.innerHTML <- window.document.body.innerHTML + "Loading..."
  do! api.setup()
  window.document.body.innerHTML <- window.document.body.innerHTML + "Worker ready"
  let! _ = api.execRaw(createKvTableQuery)
  let data = [|1..100|] |> Array.map (fun i -> (JS.Math.random() * 1000., i))
  let! _ = api.runMany "INSERT INTO kv (key, value) VALUES (?, ?)" !!data
  let! res = api.execRaw("SELECT * from kv")
  JS.console.log(res)
 
  let! res2 = api.runPreparedStep("SELECT SUM(value) FROM kv")
  JS.console.log(res2?``SUM(value)``)
}
init()
|> Promise.catch (fun x -> JS.console.error(x))
|> Promise.start