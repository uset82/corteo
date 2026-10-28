// Whether the music inference host module has been evaluated. `cli/main.ts`
// reads this flag to decide if its lazy dispose import is needed; a command
// that never touched music must not load the host (and its forking code).
export const musicInferenceLoaded = { value: false };
