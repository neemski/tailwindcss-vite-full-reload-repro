import { useState } from 'react';

export function App() {
  const [count, setCount] = useState(0);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100">
      <h1 className="text-2xl font-bold text-slate-800">
        Edit src/scanned-only.tsx and watch the terminal
      </h1>
      <button
        type="button"
        className="rounded bg-blue-500 px-4 py-2 text-white"
        onClick={() => setCount((current) => current + 1)}
      >
        count is {count}
      </button>
      <p className="text-sm text-slate-500">
        If the count resets to 0 after an edit, the page fully reloaded.
      </p>
    </main>
  );
}
