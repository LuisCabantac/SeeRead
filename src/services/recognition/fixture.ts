/**
 * Replays a scripted stream of recognizer results. Used by tests, by the browser preview
 * (where there is no microphone backend) and for demonstrations. Never touches audio.
 */
import type { RecognitionProvider } from "./provider";

export interface FixtureStep {
  /** Delay before this result, in milliseconds. */
  afterMs: number;
  text: string;
  final: boolean;
}

/** Turns plain utterances into growing word-by-word partials followed by a final. */
export function utterancesToSteps(utterances: string[], msPerWord = 250): FixtureStep[] {
  return utterances.flatMap((u) => {
    const words = u.split(/\s+/).filter(Boolean);
    return [
      ...words.map((_, i) => ({
        afterMs: msPerWord,
        text: words.slice(0, i + 1).join(" "),
        final: false,
      })),
      { afterMs: msPerWord * 2, text: u, final: true },
    ];
  });
}

export function createFixtureProvider(steps: FixtureStep[]): RecognitionProvider {
  return {
    id: "fixture",
    label: "Recorded demo (no microphone)",
    local: true,
    listDevices: async () => [{ id: "fixture", name: "Recorded demo", isDefault: true }],
    listModels: async () => [
      { dir: "fixture", name: "Demo transcript", bundled: true, hotwords: false },
    ],
    async start(options, callbacks) {
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let seq = 0;
      callbacks.onState("listening");
      const play = (i: number) => {
        if (cancelled || i >= steps.length) return;
        const step = steps[i]!;
        timer = setTimeout(() => {
          callbacks.onLevel(0.2, false);
          callbacks.onResult({
            session: options.session,
            seq: ++seq,
            text: step.text,
            final: step.final,
          });
          play(i + 1);
        }, step.afterMs);
      };
      play(0);
      return async () => {
        cancelled = true;
        clearTimeout(timer);
        callbacks.onState("stopped");
      };
    },
  };
}
