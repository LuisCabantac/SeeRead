mod capture_exclusion;
mod error;
mod speech;
mod storage;

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};

/// Off unless the user turns on debug logs; gates Rust and webview logs alike.
static DEBUG_LOGS: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn set_debug_logging(enabled: bool) {
    if enabled {
        DEBUG_LOGS.store(true, Ordering::Relaxed);
        log::info!(
            "debug logging on: SeeRead {} on {} {}",
            env!("CARGO_PKG_VERSION"),
            std::env::consts::OS,
            std::env::consts::ARCH
        );
    } else {
        log::info!("debug logging off");
        DEBUG_LOGS.store(false, Ordering::Relaxed);
    }
}

/// Tray menu entries; the main window turns `tray://action` events into app actions.
/// The tray is the always-available way back when the overlay is click-through.
const TRAY_ITEMS: &[(&str, &str)] = &[
    ("show", "Show SeeRead"),
    ("toggle-overlay", "Show or hide teleprompter"),
    ("toggle-click-through", "Toggle click-through"),
    ("play-pause", "Play / pause"),
    ("quit", "Quit SeeRead"),
];

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let items = TRAY_ITEMS
        .iter()
        .map(|(id, label)| MenuItem::with_id(app, *id, *label, true, None::<&str>))
        .collect::<tauri::Result<Vec<_>>>()?;
    let refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = items
        .iter()
        .map(|i| i as &dyn tauri::menu::IsMenuItem<tauri::Wry>)
        .collect();
    let menu = Menu::with_items(app, &refs)?;
    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("SeeRead")
        .menu(&menu);
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.on_menu_event(|app, event| match event.id().as_ref() {
        "quit" => app.exit(0),
        "show" => {
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.unminimize();
                let _ = main.show();
                let _ = main.set_focus();
            }
        }
        other => {
            let _ = app.emit_to("main", "tray://action", other);
        }
    })
    .build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Release builds abort on panic; record why first.
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        log::error!("panic: {info}");
        default_hook(info);
    }));

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir {
                        file_name: Some("seeread".into()),
                    }),
                ])
                .level(log::LevelFilter::Info)
                .level_for("seeread_lib", log::LevelFilter::Debug)
                .filter(|_| DEBUG_LOGS.load(Ordering::Relaxed))
                .max_file_size(1_000_000)
                .rotation_strategy(RotationStrategy::KeepSome(2))
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(speech::SpeechState::default())
        .setup(|app| {
            setup_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // The overlay is hidden, not closed; closing the main window quits the app.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    window.app_handle().exit(0);
                } else {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            storage::read_script,
            storage::write_script,
            storage::save_draft,
            storage::load_draft,
            storage::clear_draft,
            speech::list_input_devices,
            speech::list_models,
            speech::start_speech,
            speech::stop_speech,
            capture_exclusion::set_capture_exclusion,
            set_debug_logging,
        ])
        .run(tauri::generate_context!())
        .expect("error while running SeeRead");
}
