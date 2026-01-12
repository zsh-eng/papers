use tauri::{LogicalSize, Manager};
use tauri_plugin_fs::FsExt;

mod tabs;
use tabs::{
    close_active_tab, close_tab, create_tab, get_tab_state, next_tab, prev_tab, switch_tab,
    switch_tab_by_index, update_tab_title, TabManager, TAB_BAR_HEIGHT,
};

#[tauri::command]
fn allow_directory(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let scope = app.fs_scope();
    scope
        .allow_directory(&path, true)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(TabManager::new())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Create initial home tab
            let handle = app.handle().clone();
            tabs::create_initial_tab(&handle)?;

            // Set up window resize listener to resize all child webviews
            let app_handle = app.handle().clone();
            if let Some(window) = app.get_window("main") {
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Resized(size) = event {
                        let scale = app_handle
                            .get_window("main")
                            .and_then(|w| w.scale_factor().ok())
                            .unwrap_or(1.0);

                        let width = size.width as f64 / scale;
                        let height = (size.height as f64 / scale) - TAB_BAR_HEIGHT;
                        let new_size = LogicalSize::new(width, height);

                        // Resize all tab webviews
                        let manager = app_handle.state::<TabManager>();
                        let state = manager.get_state();
                        for tab in &state.tabs {
                            if let Some(webview) = app_handle.get_webview(&tab.id) {
                                let _ = webview.set_size(new_size);
                            }
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            allow_directory,
            create_tab,
            close_tab,
            close_active_tab,
            switch_tab,
            next_tab,
            prev_tab,
            switch_tab_by_index,
            get_tab_state,
            update_tab_title,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
