use std::sync::Mutex;
use tauri::webview::WebviewBuilder;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl};
use uuid::Uuid;

use crate::tabs::TAB_BAR_HEIGHT;

const POOL_SIZE: usize = 2;

pub struct WebviewPool {
    available: Mutex<Vec<String>>,
}

impl WebviewPool {
    pub fn new() -> Self {
        Self {
            available: Mutex::new(Vec::with_capacity(POOL_SIZE)),
        }
    }

    /// Claim a webview from the pool. Returns the label if available.
    pub fn claim(&self) -> Option<String> {
        let mut pool = self.available.lock().unwrap();
        pool.pop()
    }

    /// Add a webview label to the pool.
    pub fn add(&self, label: String) {
        let mut pool = self.available.lock().unwrap();
        pool.push(label);
    }

    /// Get current pool size.
    pub fn size(&self) -> usize {
        self.available.lock().unwrap().len()
    }
}

/// Create a single pooled webview (hidden, loads home view).
pub fn create_pooled_webview(app: &AppHandle) -> Result<String, String> {
    let label = format!("pool-{}", Uuid::new_v4());

    let window = app.get_window("main").ok_or("Main window not found")?;

    // Get window dimensions for sizing
    let size = window.inner_size().map_err(|e| e.to_string())?;
    let scale = window.scale_factor().unwrap_or(1.0);

    let width = size.width as f64 / scale;
    let height = (size.height as f64 / scale) - TAB_BAR_HEIGHT;

    // Pool webviews load the home view (bundle pre-loaded)
    let url = WebviewUrl::App("/tab?type=home".into());
    let webview_builder = WebviewBuilder::new(&label, url);

    let position = LogicalPosition::new(0.0, TAB_BAR_HEIGHT);
    let webview_size = LogicalSize::new(width, height);

    let webview = window
        .add_child(webview_builder, position, webview_size)
        .map_err(|e| e.to_string())?;

    // Hide the pooled webview initially
    let _ = webview.hide();

    log::info!("Created pooled webview: {}", label);

    Ok(label)
}

/// Initialize the pool with POOL_SIZE webviews.
pub fn initialize_pool(app: &AppHandle) {
    let pool = app.state::<WebviewPool>();

    for _ in 0..POOL_SIZE {
        match create_pooled_webview(app) {
            Ok(label) => pool.add(label),
            Err(e) => log::error!("Failed to create pooled webview: {}", e),
        }
    }

    log::info!("Initialized webview pool with {} webviews", pool.size());
}

/// Replenish the pool back to POOL_SIZE (runs async after claim).
pub fn replenish_pool(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let pool = app.state::<WebviewPool>();
        let current_size = pool.size();

        for _ in current_size..POOL_SIZE {
            match create_pooled_webview(&app) {
                Ok(label) => pool.add(label),
                Err(e) => log::error!("Failed to replenish pooled webview: {}", e),
            }
        }
    });
}
