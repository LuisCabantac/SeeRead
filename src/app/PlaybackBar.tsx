import type { Settings } from "../core/settings";
import { displayAccelerator } from "../core/shortcuts";
import { isMac } from "../services/env";
import type { OverlayLink } from "./useOverlayLink";

const TRACKER_LABEL = {
  idle: "Waiting for speech",
  tracking: "Following",
  uncertain: "Unsure of position",
  lost: "Lost — click a word in the teleprompter",
  paused: "Paused",
} as const;

export function PlaybackBar({ link, settings }: { link: OverlayLink; settings: Settings }) {
  const { status } = link;
  const voice = settings.mode === "voice";
  const micOn = status.mic === "listening" || status.mic === "loading";

  let state = "Stopped";
  if (status.countdown !== null) state = `Starting in ${status.countdown}`;
  else if (voice && status.mic === "loading") state = "Loading speech model…";
  else if (voice && status.tracker && status.mic === "listening")
    state = TRACKER_LABEL[status.tracker];
  else if (status.playing) state = "Scrolling";
  else if (status.paused) state = "Paused";

  return (
    <div className="playback" role="group" aria-label="Playback">
      <div className="row" role="radiogroup" aria-label="Reading mode">
        <button role="radio" aria-checked={!voice} onClick={() => void link.setMode("auto")}>
          Auto-scroll
        </button>
        <button role="radio" aria-checked={voice} onClick={() => void link.setMode("voice")}>
          Voice
        </button>
      </div>
      <button
        className="primary"
        onClick={() => (status.playing ? link.command({ type: "pause" }) : void link.start())}
        title={displayAccelerator(settings.shortcuts.playPause, isMac)}
      >
        {status.playing ? "Pause" : status.paused ? "Resume" : "Start"}
      </button>
      <button onClick={() => link.command({ type: "restart" })}>Restart</button>
      <button onClick={() => link.command({ type: "stop" })}>Stop</button>
      <button aria-pressed={link.visible} onClick={() => void link.toggle()}>
        {link.visible ? "Hide teleprompter" : "Show teleprompter"}
      </button>
      {settings.overlay.clickThrough && (
        <button
          onClick={() => void link.toggleClickThrough()}
          title="Make the teleprompter clickable again"
        >
          Regain control
        </button>
      )}
      <span className="pill" role="status" aria-live="polite">
        {voice && <span className={`dot ${micOn ? "live" : ""}`} aria-hidden="true" />}
        {voice && (micOn ? "Mic on · " : "Mic off · ")}
        {state}
        {!voice && ` · ${settings.autoScroll.speed} px/s`}
      </span>
    </div>
  );
}
