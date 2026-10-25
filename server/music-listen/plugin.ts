import type { Plugin } from 'vite';
import { disposeDefaultMusicInference } from './inference.ts';

/** Stops the warm inference worker when the host server shuts down. */
export function musicListenPlugin(): Plugin {
  return {
    name: 'openchatcut-music-listen',
    configureServer(server) {
      server.httpServer?.once('close', () => {
        void disposeDefaultMusicInference().catch((error) => {
          server.config.logger.warn(
            `[music-listen] could not stop the inference worker: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      });
    },
  };
}
