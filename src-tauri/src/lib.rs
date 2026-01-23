use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{LogicalSize, Manager};

mod file_search;
mod pool;
mod tabs;

use file_search::{refresh_file_index, refresh_if_stale, search_files, FileIndex};
use pool::WebviewPool;
use tabs::{
    close_active_tab, close_tab, create_tab, get_tab_state, next_tab, prev_tab, switch_tab,
    switch_tab_by_index, update_current_tab_title, TabManager, TAB_BAR_HEIGHT,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(TabManager::new())
        .manage(WebviewPool::new())
        .manage(FileIndex::new())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Build custom application menu
            let handle = app.handle();

            // Create menu items
            let new_tab = MenuItemBuilder::with_id("new_tab", "New Tab")
                .accelerator("CmdOrCtrl+T")
                .build(handle)?;

            let close_tab_item = MenuItemBuilder::with_id("close_tab", "Close Tab")
                .accelerator("CmdOrCtrl+W")
                .build(handle)?;

            let next_tab_item = MenuItemBuilder::with_id("next_tab", "Next Tab")
                .accelerator("Ctrl+Tab")
                .build(handle)?;

            let prev_tab_item = MenuItemBuilder::with_id("prev_tab", "Previous Tab")
                .accelerator("Ctrl+Shift+Tab")
                .build(handle)?;

            // Build File submenu
            let file_menu = SubmenuBuilder::new(handle, "File")
                .item(&new_tab)
                .item(&close_tab_item)
                .separator()
                .item(&next_tab_item)
                .item(&prev_tab_item)
                .build()?;

            // Build the full menu with standard Edit menu for copy/paste
            let edit_menu = SubmenuBuilder::new(handle, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let menu = MenuBuilder::new(handle)
                .item(&file_menu)
                .item(&edit_menu)
                .build()?;

            app.set_menu(menu)?;

            // Handle menu events
            let app_handle_for_menu = handle.clone();
            app.on_menu_event(move |_app, event| {
                match event.id().as_ref() {
                    "new_tab" => {
                        let _ = tabs::create_tab_internal_from_menu(&app_handle_for_menu);
                    }
                    "close_tab" => {
                        let _ = tabs::close_tab_or_window(&app_handle_for_menu);
                    }
                    "next_tab" => {
                        let _ = next_tab(app_handle_for_menu.clone());
                    }
                    "prev_tab" => {
                        let _ = prev_tab(app_handle_for_menu.clone());
                    }
                    _ => {}
                }
            });

            // Create initial home tab
            let handle = app.handle().clone();
            tabs::create_initial_tab(&handle)?;

            // Initialize the webview pool
            pool::initialize_pool(&handle);

            // Initialize file index (background refresh)
            refresh_if_stale(&handle, 0);

            // Set up window resize listener to resize all child webviews
            let app_handle = app.handle().clone();
            let app_handle_for_focus = app.handle().clone();
            if let Some(window) = app.get_window("main") {
                // Refresh file index on window focus (if stale > 30s)
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(true) = event {
                        refresh_if_stale(&app_handle_for_focus, 30);
                    }
                });

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

                        // Resize pool webviews too
                        if let Some(window) = app_handle.get_window("main") {
                            for webview in window.webviews() {
                                if webview.label().starts_with("pool-") {
                                    let _ = webview.set_size(new_size);
                                }
                            }
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_tab,
            close_tab,
            close_active_tab,
            switch_tab,
            next_tab,
            prev_tab,
            switch_tab_by_index,
            get_tab_state,
            update_current_tab_title,
            search_files,
            refresh_file_index,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
