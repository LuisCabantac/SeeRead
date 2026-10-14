//! Script files and crash-recovery drafts.
//!
//! Every write goes to a temporary sibling first, is flushed to disk, and then renamed
//! over the target, so a crash or power loss leaves either the old or the new file —
//! never a truncated one. Script contents are never logged.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::error::CmdError;

/// Scripts larger than this are almost certainly not teleprompter scripts.
const MAX_SCRIPT_BYTES: u64 = 20 * 1024 * 1024;
const SCRIPT_EXTENSIONS: &[&str] = &["txt", "text", "md", "markdown"];

pub fn write_atomic(path: &Path, contents: &str) -> std::io::Result<()> {
    let dir = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    fs::create_dir_all(dir)?;
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy())
        .unwrap_or_default();
    let tmp = dir.join(format!(".{file_name}.seeread-tmp"));
    {
        let mut file = fs::File::create(&tmp)?;
        file.write_all(contents.as_bytes())?;
        file.sync_all()?;
    }
    fs::rename(&tmp, path).inspect_err(|_| {
        let _ = fs::remove_file(&tmp);
    })
}

fn check_script_path(path: &Path) -> Result<(), CmdError> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase);
    match ext {
        Some(ext) if SCRIPT_EXTENSIONS.contains(&ext.as_str()) => Ok(()),
        _ => Err(CmdError::new(
            "unsupported_file",
            "SeeRead can only open and save plain-text scripts (.txt or .md).",
        )),
    }
}

pub fn read_script_file(path: &Path) -> Result<String, CmdError> {
    check_script_path(path)?;
    let meta = fs::metadata(path)?;
    if meta.len() > MAX_SCRIPT_BYTES {
        return Err(CmdError::new(
            "file_too_large",
            "This file is larger than 20 MB.",
        ));
    }
    let bytes = fs::read(path)?;
    let text = String::from_utf8_lossy(&bytes);
    Ok(text.strip_prefix('\u{feff}').unwrap_or(&text).to_string())
}

#[tauri::command]
pub fn read_script(path: PathBuf) -> Result<String, CmdError> {
    read_script_file(&path)
}

#[tauri::command]
pub fn write_script(path: PathBuf, contents: String) -> Result<(), CmdError> {
    check_script_path(&path)?;
    write_atomic(&path, &contents)?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub contents: String,
    /// The file the draft belongs to, if it was opened from or saved to one.
    pub path: Option<String>,
    /// Milliseconds since the Unix epoch, supplied by the UI.
    pub saved_at: f64,
}

fn draft_file(app: &AppHandle) -> Result<PathBuf, CmdError> {
    Ok(app
        .path()
        .app_data_dir()?
        .join("drafts")
        .join("current.json"))
}

#[tauri::command]
pub fn save_draft(app: AppHandle, draft: Draft) -> Result<(), CmdError> {
    write_atomic(&draft_file(&app)?, &serde_json::to_string(&draft)?)?;
    Ok(())
}

#[tauri::command]
pub fn load_draft(app: AppHandle) -> Result<Option<Draft>, CmdError> {
    let path = draft_file(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    // A corrupt draft is not worth failing startup over.
    Ok(fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok()))
}

#[tauri::command]
pub fn clear_draft(app: AppHandle) -> Result<(), CmdError> {
    let path = draft_file(&app)?;
    if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn atomic_write_replaces_contents_and_leaves_no_temp_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("script.txt");
        write_atomic(&path, "first").unwrap();
        write_atomic(&path, "second — ünïcödé ✓").unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "second — ünïcödé ✓");
        let names: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .collect();
        assert_eq!(names.len(), 1);
    }

    #[test]
    fn atomic_write_creates_missing_directories() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a").join("b").join("draft.json");
        write_atomic(&path, "{}").unwrap();
        assert!(path.exists());
    }

    #[test]
    fn reads_scripts_and_strips_bom() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("s.txt");
        fs::write(&path, "\u{feff}Hello\r\nWorld").unwrap();
        assert_eq!(read_script_file(&path).unwrap(), "Hello\r\nWorld");
    }

    #[test]
    fn rejects_non_text_extensions() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("evil.exe");
        fs::write(&path, "x").unwrap();
        assert_eq!(
            read_script_file(&path).unwrap_err().code,
            "unsupported_file"
        );
        assert!(check_script_path(Path::new("notes.MD")).is_ok());
        assert!(check_script_path(Path::new("noext")).is_err());
    }

    #[test]
    fn draft_round_trips_through_json() {
        let draft = Draft {
            contents: "a [b] c".into(),
            path: None,
            saved_at: 1.0,
        };
        let json = serde_json::to_string(&draft).unwrap();
        assert!(json.contains("savedAt"));
        assert_eq!(serde_json::from_str::<Draft>(&json).unwrap(), draft);
    }
}
