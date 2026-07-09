// This component is intentionally NOT imported by anything. Tailwind's scanner
// still reads it (source glob `**/*`) and registers it via `addWatchFile`, so
// its ONLY module-graph node is an `asset` stub with `id === undefined`. Editing
// it is what trips @tailwindcss/vite's `hotUpdate` guard and forces a full
// page reload. Change the class name below and watch the terminal wiretap.
export function ScannedOnly() {
  return (
    <div className="rounded bg-emerald-500 px-6 py-3 text-white">scanned</div>
  );
}
