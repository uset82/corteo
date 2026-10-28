import { useEffect, useState } from 'react';
import { decodeAudioSource } from '../intelligence/audioDecode';
import { BEAT_THIS_SAMPLE_RATE } from '../intelligence/beatThisPreprocess';
import { measureFromSamples, type SongMeasurement } from './songMeasurement';

export interface SongMeasurementState {
  busy: boolean;
  measurement: SongMeasurement | null;
  error: string | null;
}

/** Measures key and loudness from the asset's own audio while the dialog is open. */
export function useSongMeasurement(src: string | undefined, enabled: boolean): SongMeasurementState {
  const [state, setState] = useState<SongMeasurementState>({ busy: false, measurement: null, error: null });
  useEffect(() => {
    if (!enabled || !src) {
      setState({ busy: false, measurement: null, error: null });
      return undefined;
    }
    const controller = new AbortController();
    setState({ busy: true, measurement: null, error: null });
    void decodeAudioSource(src, BEAT_THIS_SAMPLE_RATE, controller.signal)
      .then((samples) => {
        if (controller.signal.aborted) return;
        setState({ busy: false, measurement: measureFromSamples(samples, BEAT_THIS_SAMPLE_RATE), error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ busy: false, measurement: null, error: error instanceof Error ? error.message : String(error) });
      });
    return () => controller.abort();
  }, [src, enabled]);
  return state;
}
