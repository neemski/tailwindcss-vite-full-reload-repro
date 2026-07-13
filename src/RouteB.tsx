import DeepComponent from './DeepComponent';

// A code-split route. This module — and therefore its import of DeepComponent —
// is only transformed by Vite once this chunk is fetched (i.e. once you
// navigate here). Until then, DeepComponent is never registered as a JS module.
export default function RouteB() {
  return <DeepComponent />;
}
