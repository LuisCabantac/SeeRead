use serde::Serialize;

/// Error returned to the UI: a stable machine-readable `code` plus a human message.
/// Messages must never contain script text or transcripts.
#[derive(Debug, Serialize)]
pub struct CmdError {
    pub code: &'static str,
    pub message: String,
}

impl CmdError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        let message = message.into();
        log::warn!("{code}: {message}");
        Self { code, message }
    }
}

impl From<std::io::Error> for CmdError {
    fn from(err: std::io::Error) -> Self {
        let code = match err.kind() {
            std::io::ErrorKind::NotFound => "not_found",
            std::io::ErrorKind::PermissionDenied => "permission_denied",
            _ => "io",
        };
        Self::new(code, err.to_string())
    }
}

impl From<tauri::Error> for CmdError {
    fn from(err: tauri::Error) -> Self {
        Self::new("tauri", err.to_string())
    }
}

impl From<serde_json::Error> for CmdError {
    fn from(err: serde_json::Error) -> Self {
        Self::new("json", err.to_string())
    }
}
