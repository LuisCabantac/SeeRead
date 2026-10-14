mod capture_exclusion;
mod error;
mod speech;
mod storage;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager, WindowEvent};

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
    tauri::Builder::default()
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running SeeRead");
}
