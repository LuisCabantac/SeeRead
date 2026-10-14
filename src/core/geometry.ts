/**
 * Overlay placement across monitors, in physical pixels (what the OS reports), so mixed
 * DPI setups need no unit conversion. Saved bounds are reused only while they still land
 * on a connected monitor; otherwise the overlay gets a sensible default on the preferred
 * (or primary) display.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MonitorInfo {
  name: string | null;
  /** Usable area (excluding taskbars/docks) in physical pixels. */
  rect: Rect;
  scale: number;
}

const MIN_WIDTH = 240;
const MIN_HEIGHT = 120;

const contains = (r: Rect, x: number, y: number) =>
  x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;

export function clampToMonitor(bounds: Rect, area: Rect): Rect {
  const width = Math.min(Math.max(bounds.width, MIN_WIDTH), area.width);
  const height = Math.min(Math.max(bounds.height, MIN_HEIGHT), area.height);
  return {
    width,
    height,
    x: Math.min(Math.max(bounds.x, area.x), area.x + area.width - width),
    y: Math.min(Math.max(bounds.y, area.y), area.y + area.height - height),
  };
}

export function defaultBounds(area: Rect): Rect {
  const width = Math.round(area.width * 0.7);
  const height = Math.round(area.height * 0.3);
  return clampToMonitor(
    {
      width,
      height,
      x: Math.round(area.x + (area.width - width) / 2),
      y: Math.round(area.y + area.height * 0.06),
    },
    area,
  );
}

/**
 * @param monitors connected monitors, primary first
 * @param preferred monitor name chosen by the user, if any
 * @param saved last overlay bounds, if any
 */
export function placeOverlay(
  monitors: MonitorInfo[],
  preferred: string | null,
  saved: Rect | null,
): { bounds: Rect; monitor: MonitorInfo | null } {
  if (monitors.length === 0) {
    return { bounds: saved ?? { x: 100, y: 100, width: 900, height: 320 }, monitor: null };
  }
  if (saved) {
    const cx = saved.x + saved.width / 2;
    const cy = saved.y + saved.height / 2;
    const home = monitors.find((m) => contains(m.rect, cx, cy));
    if (home && (!preferred || home.name === preferred)) {
      return { bounds: clampToMonitor(saved, home.rect), monitor: home };
    }
  }
  const monitor = monitors.find((m) => m.name === preferred) ?? monitors[0]!;
  return { bounds: defaultBounds(monitor.rect), monitor };
}

/**
 * For sessions where the compositor places windows (Wayland), only the size is ours to
 * restore: the saved size if any, else the default, fitted to the preferred monitor.
 */
export function overlaySize(
  monitors: MonitorInfo[],
  preferred: string | null,
  saved: Rect | null,
): { width: number; height: number } {
  const monitor = monitors.find((m) => m.name === preferred) ?? monitors[0];
  if (!monitor) return { width: saved?.width ?? 900, height: saved?.height ?? 320 };
  const { x, y } = monitor.rect;
  const { width, height } = saved
    ? clampToMonitor({ ...saved, x, y }, monitor.rect)
    : defaultBounds(monitor.rect);
  return { width, height };
}
