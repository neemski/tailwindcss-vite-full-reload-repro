// Reachable only through RouteB, which is lazy-loaded. Before RouteB's chunk is
// fetched, Vite has not transformed RouteB, so it never processed this import —
// DeepComponent's only module-graph node is Tailwind's {type:'asset',
// id:undefined} scan stub. Editing it trips @tailwindcss/vite's hotUpdate guard
// and forces a full page reload. Navigate to route B first and HMR works fine.
export default function DeepComponent() {
  return (
    <div className="rounded bg-teal-500 px-6 py-3 text-white">deep component</div>
  );
}
