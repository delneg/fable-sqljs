## PoC: Fable + sqljs + absurd-sql + comlink

- sql.js: wasm sqlite
- absurd-sql: indexeddb backend sql.js adapter
- comlink: WebWorker RPC


## Demo:


https://thirsty-goldberg-7a9141.netlify.app/

Based on:
[AbsurdSQL with type orm example](https://github.com/mizchi/absurd-sql-example-with-typeorm)

## Explanation on why this is cool:

https://jlongster.com/future-sql-web


## Develop

```
pnpm install
pnpm serve
```

## Deploy

You need to set CORP/COEP headers for absurd-sql(SharedArrayBuffer)

```
  Cross-Origin-Opener-Policy = "same-origin"
  Cross-Origin-Embedder-Policy = "require-corp"
```


## LICENSE

MIT

## Original README 

---

This is a project to get quickly setup with [absurd-sql](https://github.com/jlongster/absurd-sql). With this you well get a SQLite db that persistently stores data.

## Running

After cloning this project:

```
$ pnpm install
$ pnpm serve
```

You should be able to go to [http://localhost:8080/](http://localhost:8080/), and open the console to see some query results.
