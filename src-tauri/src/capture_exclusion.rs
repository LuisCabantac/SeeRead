//! Screen-capture exclusion adapter.
//!
//! Applies Tauri's built-in content protection (which uses the documented OS APIs) and
//! then reads the window state back from the OS, so the UI can report what actually
//! took effect instead of assuming success. This never guarantees invisibility: cameras,
//! remote desktop, privileged capture tools and OS changes can all bypass it.

use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::error::CmdError;

#[derive(Debug, Serialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)] // each platform adapter constructs only some variants
pub enum Support {
    /// The OS offers a documented exclusion mechanism.
    Supported,
    /// A weaker or unreliable mechanism (e.g. a black rectangle instead of hiding).
    Partial,
    Unsupported,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureStatus {
    pub support: Support,
    pub requested: bool,
    /// Whether the OS reports the requested state after applying; `None` if it can't be queried.
    pub verified: Option<bool>,
    /// Not applied yet because the overlay is hidden; the UI re-applies it when shown.
    pub pending: bool,
    pub method: &'static str,
    pub notes: &'static str,
}

#[tauri::command]
pub fn set_capture_exclusion(app: AppHandle, enabled: bool) -> Result<CaptureStatus, CmdError> {
    let overlay = app
        .get_webview_window("overlay")
        .ok_or_else(|| CmdError::new("no_overlay", "The teleprompter window is not available."))?;
    // Changing display affinity on a never-shown window makes Windows paint a ghost of
    // its frame, so the OS is only touched while the overlay is visible.
    let visible = overlay.is_visible()?;
    platform::apply(&overlay, enabled, visible)
}

#[cfg(target_os = "windows")]
mod platform {
    use super::*;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE, WDA_MONITOR, WDA_NONE,
    };

    pub fn apply(
        window: &tauri::WebviewWindow,
        enabled: bool,
        visible: bool,
    ) -> Result<CaptureStatus, CmdError> {
        let affinity = if visible {
            window.set_content_protected(enabled)?;
            window.hwnd().ok().and_then(|hwnd| {
                let mut affinity: u32 = 0;
                // SAFETY: `hwnd` is a live top-level window owned by this process and
                // `affinity` is a valid out-pointer; the call only reads window state.
                let ok = unsafe { GetWindowDisplayAffinity(hwnd.0 as _, &mut affinity) } != 0;
                ok.then_some(affinity)
            })
        } else {
            None
        };
        let fallback = affinity == Some(WDA_MONITOR);
        Ok(CaptureStatus {
            support: if fallback {
                Support::Partial
            } else {
                Support::Supported
            },
            requested: enabled,
            pending: !visible,
            verified: affinity.map(|a| {
                if enabled {
                    a == WDA_EXCLUDEFROMCAPTURE || a == WDA_MONITOR
                } else {
                    a == WDA_NONE
                }
            }),
            method: if fallback {
                "SetWindowDisplayAffinity(WDA_MONITOR)"
            } else {
                "SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)"
            },
            notes: if fallback {
                "This Windows version only supports showing a black rectangle in captures \
                 instead of hiding the window. Windows 10 version 2004 or later is needed to hide it."
            } else {
                "Windows hides the window from most screen capture and screen sharing tools. \
                 Cameras, remote desktop sessions and some capture tools are not affected."
            },
        })
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use super::*;
    use objc2::msg_send;
    use objc2::runtime::AnyObject;
    use std::sync::mpsc;

    const NS_WINDOW_SHARING_NONE: usize = 0;

    pub fn apply(
        window: &tauri::WebviewWindow,
        enabled: bool,
        visible: bool,
    ) -> Result<CaptureStatus, CmdError> {
        let sharing = if visible {
            window.set_content_protected(enabled)?;
            read_sharing_type(window)?
        } else {
            None
        };
        Ok(CaptureStatus {
            support: Support::Partial,
            requested: enabled,
            pending: !visible,
            verified: sharing.map(|s| (s == NS_WINDOW_SHARING_NONE) == enabled),
            method: "NSWindow.sharingType = .none",
            notes: "macOS honours this for older capture APIs, but recorders and screen sharing \
                    built on ScreenCaptureKit (macOS 15 and later) may still capture the window. \
                    Check a test recording before relying on it.",
        })
    }

    fn read_sharing_type(window: &tauri::WebviewWindow) -> Result<Option<usize>, CmdError> {
        let ns_window = window.ns_window()? as usize;
        let (tx, rx) = mpsc::channel();
        // AppKit state is read on the main thread. This closure is queued after the
        // content-protection change, so it observes the new value.
        window.run_on_main_thread(move || {
            // SAFETY: `ns_window` is the NSWindow backing a live Tauri window and
            // `sharingType` is a read-only property returning NSWindowSharingType.
            let sharing: usize = unsafe {
                let obj = &*(ns_window as *const AnyObject);
                msg_send![obj, sharingType]
            };
            let _ = tx.send(sharing);
        })?;
        Ok(rx.recv_timeout(std::time::Duration::from_secs(2)).ok())
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
mod platform {
    use super::*;

    pub fn apply(
        _window: &tauri::WebviewWindow,
        enabled: bool,
        _visible: bool,
    ) -> Result<CaptureStatus, CmdError> {
        Ok(CaptureStatus {
            support: Support::Unsupported,
            requested: enabled,
            pending: false,
            verified: None,
            method: "none",
            notes: "Neither X11 nor Wayland offers applications a way to exclude a window from \
                    screen capture. The overlay will appear in recordings and screen shares. \
                    On Wayland, sharing a single window instead of the whole screen keeps it out.",
        })
    }
}
