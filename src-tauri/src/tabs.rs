use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::webview::WebviewBuilder;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Webview, WebviewUrl};
use uuid::Uuid;

pub const TAB_BAR_HEIGHT: f64 = 38.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TabInfo {
    pub id: String,
    pub tab_type: String, // "home" | "paper"
    pub paper_path: Option<String>,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TabState {
    pub tabs: Vec<TabInfo>,
    pub active_tab_id: String,
}

pub struct TabManager {
    state: Mutex<TabState>,
}

#[allow(dead_code)]
impl TabManager {
    pub fn new() -> Self {
        Self {
            state: Mutex::new(TabState {
                tabs: Vec::new(),
                active_tab_id: String::new(),
            }),
        }
    }

    pub fn get_state(&self) -> TabState {
        self.state.lock().unwrap().clone()
    }

    pub fn add_tab(&self, tab: TabInfo) {
        let mut state = self.state.lock().unwrap();
        state.tabs.push(tab);
    }

    pub fn set_active(&self, id: &str) {
        let mut state = self.state.lock().unwrap();
        state.active_tab_id = id.to_string();
    }

    pub fn remove_tab(&self, id: &str) -> Option<usize> {
        let mut state = self.state.lock().unwrap();
        if let Some(pos) = state.tabs.iter().position(|t| t.id == id) {
            state.tabs.remove(pos);
            Some(pos)
        } else {
            None
        }
    }

    pub fn get_tab(&self, id: &str) -> Option<TabInfo> {
        let state = self.state.lock().unwrap();
        state.tabs.iter().find(|t| t.id == id).cloned()
    }

    pub fn tab_count(&self) -> usize {
        self.state.lock().unwrap().tabs.len()
    }

    pub fn get_tab_at_index(&self, index: usize) -> Option<TabInfo> {
        let state = self.state.lock().unwrap();
        state.tabs.get(index).cloned()
    }

    pub fn get_active_index(&self) -> Option<usize> {
        let state = self.state.lock().unwrap();
        state.tabs.iter().position(|t| t.id == state.active_tab_id)
    }
}

fn emit_tab_state(app: &AppHandle) {
    let manager = app.state::<TabManager>();
    let state = manager.get_state();
    let _ = app.emit("tab-state-changed", state);
}

fn get_webview_url(tab_type: &str, paper_path: Option<&str>) -> WebviewUrl {
    let mut url = String::from("/tab?type=");
    url.push_str(tab_type);
    if let Some(path) = paper_path {
        url.push_str("&path=");
        url.push_str(&urlencoding::encode(path));
    }
    WebviewUrl::App(url.into())
}

pub fn create_initial_tab(app: &AppHandle) -> Result<(), String> {
    create_tab_internal(app, "home", None, "Library".to_string())
}

fn create_tab_internal(
    app: &AppHandle,
    tab_type: &str,
    paper_path: Option<String>,
    title: String,
) -> Result<(), String> {
    let tab_id = format!("tab-{}", Uuid::new_v4());
    let manager = app.state::<TabManager>();

    // Get the main window
    let window = app.get_window("main").ok_or("Main window not found")?;

    // Get window dimensions for positioning
    let size = window.inner_size().map_err(|e| e.to_string())?;
    let scale = window.scale_factor().unwrap_or(1.0);

    let width = size.width as f64 / scale;
    let height = (size.height as f64 / scale) - TAB_BAR_HEIGHT;

    // Hide currently active tab's webview if it exists
    let current_active = manager.get_state().active_tab_id;
    if !current_active.is_empty() {
        if let Some(current_webview) = app.get_webview(&current_active) {
            let _ = current_webview.hide();
        }
    }

    // Create the webview URL
    let url = get_webview_url(tab_type, paper_path.as_deref());

    // Create WebviewBuilder
    let webview_builder = WebviewBuilder::new(&tab_id, url);

    // Add the webview as a child of the main window
    let position = LogicalPosition::new(0.0, TAB_BAR_HEIGHT);
    let webview_size = LogicalSize::new(width, height);

    let webview = window
        .add_child(webview_builder, position, webview_size)
        .map_err(|e| e.to_string())?;

    // Focus the new webview
    let _ = webview.set_focus();

    // Add tab to state
    let tab_info = TabInfo {
        id: tab_id.clone(),
        tab_type: tab_type.to_string(),
        paper_path,
        title,
    };
    manager.add_tab(tab_info);
    manager.set_active(&tab_id);

    emit_tab_state(app);
    Ok(())
}

#[tauri::command]
pub fn create_tab(
    app: AppHandle,
    tab_type: String,
    paper_path: Option<String>,
    title: String,
) -> Result<String, String> {
    let tab_id = format!("tab-{}", Uuid::new_v4());
    let manager = app.state::<TabManager>();

    // Get the main window
    let window = app.get_window("main").ok_or("Main window not found")?;

    // Get window dimensions for positioning
    let size = window.inner_size().map_err(|e| e.to_string())?;
    let scale = window.scale_factor().unwrap_or(1.0);

    let width = size.width as f64 / scale;
    let height = (size.height as f64 / scale) - TAB_BAR_HEIGHT;

    // Hide currently active tab's webview if it exists
    let current_active = manager.get_state().active_tab_id;
    if !current_active.is_empty() {
        if let Some(current_webview) = app.get_webview(&current_active) {
            let _ = current_webview.hide();
        }
    }

    // Create the webview URL
    let url = get_webview_url(&tab_type, paper_path.as_deref());

    // Create WebviewBuilder
    let webview_builder = WebviewBuilder::new(&tab_id, url);

    // Add the webview as a child of the main window
    let position = LogicalPosition::new(0.0, TAB_BAR_HEIGHT);
    let webview_size = LogicalSize::new(width, height);

    let webview = window
        .add_child(webview_builder, position, webview_size)
        .map_err(|e| e.to_string())?;

    // Focus the new webview
    let _ = webview.set_focus();

    // Add tab to state
    let tab_info = TabInfo {
        id: tab_id.clone(),
        tab_type,
        paper_path,
        title,
    };
    manager.add_tab(tab_info);
    manager.set_active(&tab_id);

    emit_tab_state(&app);
    Ok(tab_id)
}

#[tauri::command]
pub fn close_tab(app: AppHandle, id: String) -> Result<(), String> {
    let manager = app.state::<TabManager>();
    let state = manager.get_state();

    // Don't close if it's the last tab
    if state.tabs.len() <= 1 {
        return Ok(());
    }

    let was_active = state.active_tab_id == id;
    let closed_index = manager.remove_tab(&id);

    // Destroy the webview
    if let Some(webview) = app.get_webview(&id) {
        // Close/destroy the webview
        // Note: In Tauri 2, we may need to use a different approach
        // For now, hiding it - actual cleanup happens when the webview is dropped
        let _ = webview.hide();
        // The webview will be cleaned up when all references are dropped
    }

    // If this was the active tab, switch to another
    if was_active {
        if let Some(idx) = closed_index {
            let new_state = manager.get_state();
            let new_index = if idx >= new_state.tabs.len() {
                new_state.tabs.len().saturating_sub(1)
            } else {
                idx
            };
            if let Some(new_tab) = new_state.tabs.get(new_index) {
                let new_id = new_tab.id.clone();
                manager.set_active(&new_id);
                if let Some(webview) = app.get_webview(&new_id) {
                    let _ = webview.show();
                    let _ = webview.set_focus();
                }
            }
        }
    }

    emit_tab_state(&app);
    Ok(())
}

#[tauri::command]
pub fn switch_tab(app: AppHandle, id: String) -> Result<(), String> {
    let manager = app.state::<TabManager>();
    let state = manager.get_state();

    // Verify the target tab exists
    if !state.tabs.iter().any(|t| t.id == id) {
        return Err("Tab not found".to_string());
    }

    // Hide current active webview
    if !state.active_tab_id.is_empty() && state.active_tab_id != id {
        if let Some(current_webview) = app.get_webview(&state.active_tab_id) {
            let _ = current_webview.hide();
        }
    }

    // Show target webview
    if let Some(target_webview) = app.get_webview(&id) {
        let _ = target_webview.show();
        let _ = target_webview.set_focus();
    }

    manager.set_active(&id);
    emit_tab_state(&app);
    Ok(())
}

#[tauri::command]
pub fn next_tab(app: AppHandle) -> Result<(), String> {
    let manager = app.state::<TabManager>();
    let state = manager.get_state();

    if state.tabs.len() <= 1 {
        return Ok(());
    }

    let current_index = state
        .tabs
        .iter()
        .position(|t| t.id == state.active_tab_id)
        .unwrap_or(0);
    let next_index = (current_index + 1) % state.tabs.len();
    let next_id = state.tabs[next_index].id.clone();

    switch_tab(app, next_id)
}

#[tauri::command]
pub fn prev_tab(app: AppHandle) -> Result<(), String> {
    let manager = app.state::<TabManager>();
    let state = manager.get_state();

    if state.tabs.len() <= 1 {
        return Ok(());
    }

    let current_index = state
        .tabs
        .iter()
        .position(|t| t.id == state.active_tab_id)
        .unwrap_or(0);
    let prev_index = if current_index == 0 {
        state.tabs.len() - 1
    } else {
        current_index - 1
    };
    let prev_id = state.tabs[prev_index].id.clone();

    switch_tab(app, prev_id)
}

#[tauri::command]
pub fn switch_tab_by_index(app: AppHandle, index: usize) -> Result<(), String> {
    let manager = app.state::<TabManager>();
    let state = manager.get_state();

    if index >= state.tabs.len() {
        return Err("Tab index out of bounds".to_string());
    }

    let tab_id = state.tabs[index].id.clone();
    switch_tab(app, tab_id)
}

#[tauri::command]
pub fn get_tab_state(app: AppHandle) -> TabState {
    let manager = app.state::<TabManager>();
    manager.get_state()
}

#[tauri::command]
pub fn update_current_tab_title(
    webview: Webview,
    app: AppHandle,
    title: String,
) -> Result<(), String> {
    let tab_id = webview.label();
    let manager = app.state::<TabManager>();
    {
        let mut state = manager.state.lock().unwrap();
        if let Some(tab) = state.tabs.iter_mut().find(|t| t.id == tab_id) {
            tab.title = title;
        }
    }
    emit_tab_state(&app);
    Ok(())
}

#[tauri::command]
pub fn close_active_tab(app: AppHandle) -> Result<(), String> {
    let manager = app.state::<TabManager>();
    let state = manager.get_state();

    if state.active_tab_id.is_empty() {
        return Ok(());
    }

    close_tab(app, state.active_tab_id)
}

/// Helper function for menu event - creates a new home tab
pub fn create_tab_internal_from_menu(app: &AppHandle) -> Result<(), String> {
    create_tab_internal(app, "home", None, "Library".to_string())
}

/// Helper function for menu event - closes active tab or window if single tab
pub fn close_tab_or_window(app: &AppHandle) -> Result<(), String> {
    let manager = app.state::<TabManager>();
    let state = manager.get_state();

    // If only one tab, close the entire window
    if state.tabs.len() <= 1 {
        if let Some(window) = app.get_window("main") {
            let _ = window.close();
        }
        return Ok(());
    }

    // Otherwise, close just the active tab
    if !state.active_tab_id.is_empty() {
        close_tab(app.clone(), state.active_tab_id)?;
    }

    Ok(())
}
