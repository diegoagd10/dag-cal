# dag-cal

Small Hono app with JSX support, served on Node.js.

## Stack

- [Hono](https://hono.dev) `^4.12` — web framework
- [`@hono/node-server`](https://github.com/honojs/node-server) — Node adapter
- [Hono JSX](https://hono.dev/docs/guides/jsx) — server-side JSX (`hono/jsx`)
- TypeScript + [`tsx`](https://github.com/privatenumber/tsx) — dev runner
- pnpm

## Getting started

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Routes

| Path | Description |
| --- | --- |
| `GET /` | Plain text `Hello Hono!` |
| `GET /jsx/:name` | Renders a JSX page with the given name. Example: `/jsx/dag-cal` |

## JSX

JSX is enabled in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  }
}
```

Components live under `src/views/` and use the `FC` type from `hono/jsx`.

## Build

```bash
pnpm build
pnpm start
```
