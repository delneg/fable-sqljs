import type { Remote } from "comlink";
import type { Api } from "./worker";
import { initBackend } from "absurd-sql/dist/indexeddb-main-thread";
import { wrap } from "comlink";

const worker = new Worker(new URL("./worker", import.meta.url));
initBackend(worker);
const api: Remote<Api> = wrap(worker);

async function init() {
  document.body.innerHTML = "Loading...";
  await api.setup();
  document.body.innerHTML = "Worker Ready";

  const data = [...Array(100).keys()].map((i) => [Math.random() * 1000, i]);
  await api.runMany("INSERT INTO kv (key, value) VALUES (?, ?)", data);

  const result = await api.run(`SELECT SUM(value) FROM kv`);
  console.log(result);
}

init().catch(console.error);
