import { lazy, Suspense, useState } from 'react';

// Route-level code splitting: RouteB's chunk is fetched only when you first
// "navigate" to it (click the button below). This mirrors React.lazy, TanStack
// Router `autoCodeSplitting`, and Next.js dynamic imports.
const RouteB = lazy(() => import('./RouteB'));

export function App() {
  const [count, setCount] = useState(0);
  const [onRouteB, setOnRouteB] = useState(false);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100">
      <h1 className="text-2xl font-bold text-slate-800">
        Edit src/DeepComponent.tsx BEFORE clicking “go to route B”
      </h1>
      <button
        type="button"
        className="rounded bg-blue-500 px-4 py-2 text-white"
        onClick={() => setCount((current) => current + 1)}
      >
        count is {count}
      </button>
      <button
        type="button"
        className="rounded bg-slate-300 px-4 py-2 text-slate-800"
        onClick={() => setOnRouteB(true)}
      >
        go to route B (fetches its chunk, which will get HMR working)
      </button>
      {onRouteB ? (
        <Suspense fallback={null}>
          <RouteB />
        </Suspense>
      ) : null}
      <p className="max-w-md text-center text-sm text-slate-500">
        If the count resets to 0 after an edit, the page fully reloaded.
      </p>
    </main>
  );
}
