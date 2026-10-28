import type { Plugin } from 'vite';
import { disposeDefaultMusicInference } from './inference.ts';
import { MUSIC_RELAY_PATH, handleMusicRelayRequest } from './relay-route.ts';

/** Stops the warm inference worker when the host server shuts down. */
export function musicListenPlugin(): Plugin {
  return {
    name: 'openchatcut-music-listen',
    configureServer(server) {
      server.middlewares.use(MUSIC_RELAY_PATH, (req, res) => {
        void handleMusicRelayRequest(req, res, {
          log: (message) => server.config.logger.error(message),
        });
      });
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
