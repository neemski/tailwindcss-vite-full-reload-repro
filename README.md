# `@tailwindcss/vite` forces a full page reload when editing a `.tsx` behind an un-fetched code-split boundary

Minimal reproduction for a follow-up to
[tailwindlabs/tailwindcss#19903](https://github.com/tailwindlabs/tailwindcss/issues/19903).

Editing a `.tsx` source file that Tailwind has **scanned for class candidates
but that Vite has not yet loaded as a JS module** makes `@tailwindcss/vite`'s
`hotUpdate` hook send `{ type: 'full-reload' }` — a full page reload instead of
a Fast Refresh update. No CSS-like file is involved; the changed file is plain
`.tsx`.

The realistic way a file gets into that "scanned but not loaded" state is
**code splitting**. Vite lazy-transforms modules: a `lazy(() => import('./X'))`
reference is resolved, but the *contents* of `X` (and anything `X` imports) are
not transformed until that chunk is actually fetched — i.e. until you navigate
to it. So any component reachable only *through* an un-fetched split boundary
has no JS module in the graph yet, only Tailwind's scan stub. Editing it while
you're on a different route reloads the whole app and loses all client state.

## Environment

| Item                       | Version |
| -------------------------- | ------- |
| `@tailwindcss/vite`        | 4.2.4   |
| `tailwindcss`              | 4.2.4   |
| `vite`                     | 8.0.11  |
| `@vitejs/plugin-react-swc` | 4.3.0   |
| `react`                    | 19.2.1  |
| node                       | 24.x    |

Reproduces with plain `npm` — no monorepo, no Yarn PnP.

The React plugin is **not** the cause: the same full-reload reproduces with
`@vitejs/plugin-react` (Babel) in place of `@vitejs/plugin-react-swc`, and even
with no React plugin at all. A React plugin is included here only so that React
Fast Refresh is active — that is the baseline this bug violates.

## Steps to reproduce

```sh
npm install
npm run dev
```

The app lazy-loads `RouteB` (which renders `DeepComponent`) behind a button, so
that chunk is **not** fetched on initial load.

1. Open the printed URL and click **count is 0** a few times so the counter is
   non-zero. The counter is the reload probe: React state survives HMR but not a
   page reload.
2. **Without** clicking "go to route B", edit **`src/DeepComponent.tsx`** —
   change the class name (`bg-teal-500` → `bg-teal-600`) — and save.
   → The page fully reloads; the counter resets to 0. The terminal wiretap shows
   a `full-reload` payload from `@tailwindcss/vite`.
3. Now click **go to route B** (fetches the chunk), edit `DeepComponent.tsx`
   again → this time it's a normal HMR update, counter preserved.

## Actual (step 2)

```
[wiretap] client -> full-reload
Error: [wiretap] full-reload sender
    at MinimalPluginContext.hotUpdate (…/@tailwindcss/vite/dist/index.mjs:1:3704)
[probe] client graph for DeepComponent.tsx: [{"type":"asset","id":"UNDEFINED"}]
```

The `full-reload` payload is sent directly through `environment.hot.send`, which
bypasses Vite's own logger — so without the wiretap the terminal shows nothing
and the reload is hard to attribute. That is why this repro wraps `hot.send`.

## Root cause

`@tailwindcss/vite`'s `hotUpdate` hook has a fallback meant for scanned content
that is **not** a JS module (e.g. `.html`/`.php` templates). It fires a
`full-reload` when, for the changed file:

```js
modules.length > 0 &&
modules.every((mod) => mod.type === 'asset' || mod.id === undefined)
```

Tailwind's scanner registers every scanned source file via `addWatchFile`, which
creates an **`asset`-type module-graph node with `id === undefined`**. So the
discriminator is simply *whether the file is also present as a real, loaded JS
module*:

| State of the file                                   | Client module graph                    | Guard   | Result          |
| --------------------------------------------------- | -------------------------------------- | ------- | --------------- |
| Loaded JS module (imported + transformed)           | `[{js, defined}, {asset, UNDEFINED}]`  | bails   | HMR update ✅   |
| Scanned only — not yet transformed (behind a split) | `[{asset, UNDEFINED}]`                 | passes  | full-reload ❌  |

Because the `{js, defined}` node is missing for a file Vite hasn't transformed,
the `.every(...)` check is satisfied and Tailwind treats real `.tsx` source as
an external template, forcing a reload. The `graph-probe` plugin in
`vite.config.ts` prints these nodes so you can see it directly, and step 3 above
shows the `{js, defined}` node appearing once the route's chunk is fetched.

**Why this is frequent, not artificial:** during development you constantly edit
components across the app while the browser sits on one page. With route-level
code splitting (`React.lazy`, TanStack Router `autoCodeSplitting`, Next dynamic
imports), every un-visited route's entire subtree is in this un-transformed
state — so editing any of those components force-reloads the app you're looking
at. (A component *directly* `lazy()`-imported by a loaded module does **not**
reproduce — Vite pre-resolves that one level; it's components deeper inside an
un-fetched subtree, like `DeepComponent` here, that break.)

Note the fix direction proposed in
[#19904](https://github.com/tailwindlabs/tailwindcss/pull/19904) (exempting
CSS-like files) would **not** cover this case: the affected files are `.tsx`.

## A fix that works

Early-returning from `hotUpdate` for JS/TS module files stops the spurious
reload while newly introduced utility classes still apply live through the
normal `css-update` path:

```js
hotUpdate({ file }) {
  if (/\.[cm]?[jt]sx?(?:\?.*)?$/.test(file)) return;
  // …existing fallback…
}
```

Verified against this repro. This suggests the fallback should exempt any file
that resolves to a real JS module, rather than only CSS-like files.
