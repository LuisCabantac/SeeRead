//! Which display session SeeRead runs in, and what it lets an app do with its windows.
//!
//! Wayland compositors decide where windows go and which window stays on top, and do not
//! let apps grab keys system-wide. The UI uses this to stop restoring positions the
//! compositor ignores and to say plainly when a feature is unavailable.

use serde::Serialize;

#[derive(Debug, Serialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)] // each platform constructs only some variants
pub enum Kind {
    Windows,
    Macos,
    X11,
    Wayland,
    Unknown,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DisplaySession {
    pub kind: Kind,
    /// Desktop environment as reported by `XDG_CURRENT_DESKTOP` (e.g. "KDE"), Linux only.
    pub desktop: Option<String>,
    /// The app can move its windows to a chosen position.
    pub window_positioning: bool,
    /// The app can reliably keep the overlay above other windows.
    pub keep_above: bool,
    /// System-wide shortcuts registered by the app fire while other apps have focus.
    pub global_shortcuts: bool,
}

#[tauri::command]
pub fn display_session() -> DisplaySession {
    #[cfg(target_os = "windows")]
    return supported(Kind::Windows, None);
    #[cfg(target_os = "macos")]
    return supported(Kind::Macos, None);
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let var = |name| std::env::var(name).ok().filter(|v: &String| !v.is_empty());
        detect_linux(
            var("GDK_BACKEND").as_deref(),
            var("WAYLAND_DISPLAY").is_some(),
            var("DISPLAY").is_some(),
            var("XDG_CURRENT_DESKTOP"),
        )
    }
}

fn supported(kind: Kind, desktop: Option<String>) -> DisplaySession {
    DisplaySession {
        kind,
        desktop,
        window_positioning: true,
        keep_above: true,
        global_shortcuts: true,
    }
}

/// Mirrors GTK's backend choice: the first entry of `GDK_BACKEND` wins, otherwise Wayland is preferred whenever a Wayland display is available.
#[cfg_attr(any(target_os = "windows", target_os = "macos"), allow(dead_code))]
fn detect_linux(
    gdk_backend: Option<&str>,
    wayland_display: bool,
    x11_display: bool,
    desktop: Option<String>,
) -> DisplaySession {
    let forced = gdk_backend
        .and_then(|b| b.split(',').next())
        .map(str::trim)
        .filter(|b| *b != "*");
    let kind = match forced {
        Some("x11") => Kind::X11,
        Some("wayland") => Kind::Wayland,
        Some(_) => Kind::Unknown,
        None if wayland_display => Kind::Wayland,
        None if x11_display => Kind::X11,
        None => Kind::Unknown,
    };
    if kind == Kind::Wayland {
        DisplaySession {
            kind,
            desktop,
            window_positioning: false,
            keep_above: false,
            global_shortcuts: false,
        }
    } else {
        supported(kind, desktop)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefers_wayland_when_both_displays_exist() {
        let s = detect_linux(None, true, true, Some("KDE".into()));
        assert_eq!(s.kind, Kind::Wayland);
        assert_eq!(s.desktop.as_deref(), Some("KDE"));
        assert!(!s.window_positioning && !s.keep_above && !s.global_shortcuts);
    }

    #[test]
    fn honours_a_forced_x11_backend_under_wayland() {
        let s = detect_linux(Some("x11"), true, true, None);
        assert_eq!(s.kind, Kind::X11);
        assert!(s.window_positioning && s.keep_above && s.global_shortcuts);
    }

    #[test]
    fn uses_the_first_backend_in_a_list() {
        assert_eq!(
            detect_linux(Some("wayland,x11"), true, true, None).kind,
            Kind::Wayland
        );
        assert_eq!(
            detect_linux(Some(" x11 ,wayland"), true, true, None).kind,
            Kind::X11
        );
        assert_eq!(detect_linux(Some("*"), false, true, None).kind, Kind::X11);
    }

    #[test]
    fn falls_back_to_x11_without_a_wayland_display() {
        assert_eq!(detect_linux(None, false, true, None).kind, Kind::X11);
        assert_eq!(detect_linux(None, false, false, None).kind, Kind::Unknown);
    }
}
