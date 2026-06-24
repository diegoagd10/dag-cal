# Coding Standards

## Commands

| Task        | Command            |
| ----------- | ------------------ |
| Format      | `pnpm format`      |
| Lint        | `pnpm lint`        |
| Lint + fix  | `pnpm lint:fix`    |
| Type-check  | `pnpm typecheck`   |
| Unit tests  | `pnpm test`        |
| Watch tests | `pnpm test:watch`  |
| All gates   | `pnpm check`       |

Format and lint run on Biome; tests on Vitest.

## Project layout

| Path                  | Holds                | Rule                                                            |
| --------------------- | -------------------- | -------------------------------------------------------------- |
| `src/routes/web`      | HTML/JSX routes      | Wiring only — parse request, call a module, render a view.      |
| `src/routes/api`      | JSON routes          | Wiring only — parse request, call a module, return JSON.        |
| `src/ui/components`   | Shared components    | Reusable, presentational, no business logic, no data fetching.  |
| `src/modules`         | Deep modules         | Domain logic. Narrow interface, hidden implementation.          |
| `tests`               | Unit tests           | Mirror `src` paths. All tests live here.                        |

## Style

- Biome owns formatting — never hand-format. Tabs, double quotes, organized imports.
- Name by what it does, not how. Files match their default export.
- Keep routes thin; push logic into `src/modules`.
- Components in `src/ui/components` take props and render — no fetching, no side effects.

## Architecture

- **Deep modules**: each `src/modules` unit exposes a small interface over a large implementation. Callers depend on the interface, never internals.
- One concern per module. If a route needs logic, the logic moves to a module.
- Dependencies point inward: `routes` → `modules`, `ui/components`. Never the reverse.

## Testing

- Vitest, one `*.test.ts(x)` per unit under `tests`, mirroring the `src` path.
- Test behavior through the public interface, not private helpers.
- A bug fix starts with a failing test.

## Commits

- Conventional Commits: `type(scope): subject`.
- Subject ≤ 50 chars, imperative mood, no trailing period.
- One logical change per commit.

## Quality gates

`pnpm check` must pass before every commit and PR: lint → type-check → test.
