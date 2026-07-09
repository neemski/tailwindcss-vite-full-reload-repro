# `@tailwindcss/vite` forces a full page reload when a scanned `.tsx` file isn't a loaded module

Minimal reproduction for a follow-up to
[tailwindlabs/tailwindcss#19903](https://github.com/tailwindlabs/tailwindcss/issues/19903).

Editing a `.tsx` source file that Tailwind has **scanned for class candidates but
that Vite has not loaded as a JS module** makes `@tailwindcss/vite`'s `hotUpdate`
hook send `{ type: 'full-reload' }` — a full page reload instead of a Fast
Refresh update. No CSS-like file is involved; the changed file is plain `.tsx`.

This happens constantly in real apps that use route- or component-level code
splitting: at any moment many `.tsx` files are scanned by Tailwind but are not in
the currently-loaded chunk (lazy imports, unvisited routes), so editing them
reloads the whole page and loses all client state.

## Environment

| Item                       | Version |
| -------------------------- | ------- |
| `@tailwindcss/vite`        | 4.2.4   |
| `tailwindcss`              | 4.2.4   |
| `vite`                     | 8.0.11  |
| `@vitejs/plugin-react-swc` | 4.3.0   |
| `react`                    | 19.2.1  |
| node                       | 24.x    |

Reproduces with plain `npm` — no monorepo, no Yarn PnP, no router or other
plugins required.

The React plugin is **not** the cause. The same full-reload reproduces with
`@vitejs/plugin-react` (Babel) in place of `@vitejs/plugin-react-swc`, and even
with no React plugin at all. A React plugin is included here only so that React
Fast Refresh is active — that is the baseline this bug violates. (Without any
React plugin, Vite full-reloads on every component edit regardless, which masks
the bug rather than fixing it.)

## Steps to reproduce

```sh
npm install
npm run dev
```

1. Open the printed URL (e.g. http://localhost:5173) and click the button a few
   times so the counter is non-zero. The counter is the reload probe: React
   state survives HMR but not a page reload.
2. Edit **`src/scanned-only.tsx`** — change the class name (e.g. `bg-emerald-500`
   → `bg-emerald-600`) — and save. This file is deliberately **not imported by
   anything**; Tailwind scans it only because of its source glob.

## Expected

A single HMR update. The terminal wiretap (see `vite.config.ts`) shows only
`update` payloads; the page keeps its state.

## Actual

```
[wiretap] client -> full-reload
Error: [wiretap] full-reload sender
    at MinimalPluginContext.hotUpdate (…/@tailwindcss/vite/dist/index.mjs:1:3704)
[probe] client graph for scanned-only.tsx: [{"type":"asset","id":"UNDEFINED"}]
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
creates an **`asset`-type module-graph node with `id === undefined`** for that
file. So the discriminator is simply *whether the file is also present as a real,
loaded JS module*:

| You edit…                              | Client module graph for the file           | Guard   | Result          |
| -------------------------------------- | ------------------------------------------- | ------- | --------------- |
| an **imported + loaded** component     | `[{js, defined}, {asset, UNDEFINED}]`       | bails   | HMR update ✅   |
| a **scanned-but-not-loaded** component | `[{asset, UNDEFINED}]`                       | passes  | full-reload ❌  |

Because the `{js, defined}` node is missing for a file Vite hasn't loaded, the
`.every(...)` check is satisfied and Tailwind treats the real `.tsx` source as an
external template, forcing a reload. (The `graph-probe` plugin in
`vite.config.ts` prints these nodes so you can see it directly.)

This is why editing an ordinary, currently-rendered component in a small SPA does
*not* reproduce it — that file has a loaded JS module — but a large code-split app
reloads on nearly every `.tsx` edit.

Note the fix direction proposed in
[#19904](https://github.com/tailwindlabs/tailwindcss/pull/19904) (exempting
CSS-like files) would **not** cover this case: the affected files are `.tsx`.

## A fix that works

Early-returning from `hotUpdate` for JS/TS module files stops the spurious
reload while newly introduced utility classes still apply live through the normal
`css-update` path:

```js
hotUpdate({ file }) {
  if (/\.[cm]?[jt]sx?(?:\?.*)?$/.test(file)) return;
  // …existing fallback…
}
```

Verified against this repro: with the early-return, editing `src/scanned-only.tsx`
produces only `[wiretap] client -> update` and no `full-reload`. This suggests the
fallback should exempt any file that resolves to a real JS module, rather than
only CSS-like files.
