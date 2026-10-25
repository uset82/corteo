// Headless analysis resource limit. A 15-minute mono 22.05 kHz buffer is ~79 MB
// of Float32 PCM; longer sources are rejected instead of risking the host.
export const MAX_MUSIC_ANALYSIS_SECONDS = 15 * 60;
