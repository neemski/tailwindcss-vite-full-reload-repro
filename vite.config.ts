import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';

/**
 * Logs every HMR payload each environment sends to the browser, so the
 * unexpected `full-reload` is observable in the terminal. Purely diagnostic;
 * the bug reproduces without it. (@tailwindcss/vite calls `hot.send` directly,
 * bypassing Vite's logger, so without this wiretap the reload is invisible.)
 */
const hmrWiretap = (): Plugin => ({
  name: 'hmr-wiretap',
  configureServer(server: ViteDevServer) {
    for (const [environmentName, environment] of Object.entries(
      server.environments
    )) {
      const originalSend = environment.hot.send.bind(environment.hot);
      environment.hot.send = ((payload: unknown) => {
        const payloadType =
          typeof payload === 'object' && payload !== null && 'type' in payload
            ? String((payload as { type: unknown }).type)
            : String(payload);
        console.log(`[wiretap] ${environmentName} -> ${payloadType}`);
        if (payloadType === 'full-reload') {
          console.log(new Error('[wiretap] full-reload sender').stack);
        }
        return originalSend(payload as never);
      }) as typeof environment.hot.send;
    }
  },
});

/**
 * Purely diagnostic: on every `.tsx` edit, prints the client module-graph nodes
 * for the changed file. This is the exact input @tailwindcss/vite's `hotUpdate`
 * guard inspects: `modules.every(m => m.type === 'asset' || m.id === undefined)`.
 * A scanned-but-not-loaded file shows a single `{type:'asset', id:UNDEFINED}`
 * node (guard passes -> full reload); an imported file also has a
 * `{type:'js', id:defined}` node (guard bails -> normal update).
 */
const graphProbe = (): Plugin => ({
  name: 'graph-probe',
  hotUpdate({ file, server }) {
    if (!/\.[cm]?[jt]sx?(?:\?.*)?$/.test(file)) return;
    if (this.environment.name !== 'client') return;
    const nodes = server.environments.client.moduleGraph.getModulesByFile(file);
    const summary = Array.from(nodes ?? []).map((mod) => ({
      type: mod.type,
      id: mod.id == null ? 'UNDEFINED' : 'defined',
    }));
    console.log(
      `[probe] client graph for ${file.split('/').pop()}: ${JSON.stringify(summary)}`
    );
  },
});

export default defineConfig({
  plugins: [graphProbe(), tailwindcss(), react(), hmrWiretap()],
});
