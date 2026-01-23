use nucleo_matcher::pattern::{Atom, AtomKind, CaseMatching, Normalization};
use nucleo_matcher::{Config, Matcher, Utf32Str};
use serde::{Deserialize, Serialize};
use std::env;
use std::process::Command;
use std::sync::RwLock;
use std::time::Instant;
use tauri::{AppHandle, Manager};

/// A file search result returned to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSearchResult {
    /// Full absolute path to the file
    pub path: String,
    /// Path relative to home directory (for display)
    pub display_path: String,
    /// Match score (higher is better)
    pub score: u16,
}

/// In-memory cache of markdown file paths
pub struct FileIndex {
    paths: RwLock<Vec<String>>,
    last_refresh: RwLock<Instant>,
}

impl FileIndex {
    pub fn new() -> Self {
        Self {
            paths: RwLock::new(Vec::new()),
            last_refresh: RwLock::new(Instant::now()),
        }
    }

    pub fn get_paths(&self) -> Vec<String> {
        self.paths.read().unwrap().clone()
    }

    pub fn update(&self, new_paths: Vec<String>) {
        *self.paths.write().unwrap() = new_paths;
        *self.last_refresh.write().unwrap() = Instant::now();
    }

    pub fn is_stale(&self, threshold_secs: u64) -> bool {
        self.last_refresh.read().unwrap().elapsed().as_secs() > threshold_secs
    }

    pub fn is_empty(&self) -> bool {
        self.paths.read().unwrap().is_empty()
    }
}

/// Get all markdown files using mdfind (Spotlight)
fn get_markdown_files_mdfind() -> Result<Vec<String>, String> {
    let home_dir = env::var("HOME").map_err(|_| "Could not determine home directory")?;

    let output = Command::new("mdfind")
        .args([
            "kMDItemContentType == 'net.daringfireball.markdown'",
            "-onlyin",
            &home_dir,
        ])
        .output()
        .map_err(|e| format!("Failed to run mdfind: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "mdfind failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.lines().map(|s| s.to_string()).collect())
}

/// Refresh the file index in the background
#[tauri::command]
pub fn refresh_file_index(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        match get_markdown_files_mdfind() {
            Ok(paths) => {
                let index = app.state::<FileIndex>();
                index.update(paths);
                log::info!("File index refreshed");
            }
            Err(e) => {
                log::error!("Failed to refresh file index: {}", e);
            }
        }
    });
}

/// Refresh the file index if it's stale (called on window focus)
pub fn refresh_if_stale(app: &AppHandle, threshold_secs: u64) {
    let index = app.state::<FileIndex>();
    if index.is_stale(threshold_secs) || index.is_empty() {
        refresh_file_index(app.clone());
    }
}

/// Perform fuzzy search on cached file paths
#[tauri::command]
pub fn search_files(app: AppHandle, query: String) -> Vec<FileSearchResult> {
    let home_dir = env::var("HOME").unwrap_or_default();
    let index = app.state::<FileIndex>();
    let files = index.get_paths();

    // If query is empty, return first 20 files
    if query.trim().is_empty() {
        return files
            .into_iter()
            .take(20)
            .map(|path| {
                let display_path = path
                    .strip_prefix(&home_dir)
                    .map(|p| format!("~{}", p))
                    .unwrap_or_else(|| path.clone());
                FileSearchResult {
                    path,
                    display_path,
                    score: 0,
                }
            })
            .collect();
    }

    // Create matcher and pattern
    let mut matcher = Matcher::new(Config::DEFAULT);
    let atom = Atom::new(
        &query,
        CaseMatching::Smart,
        Normalization::Smart,
        AtomKind::Fuzzy,
        false,
    );

    // Score each file path
    let mut scored_results: Vec<(String, u16)> = files
        .into_iter()
        .filter_map(|path| {
            // Match against the path without home prefix for better UX
            let match_target = path.strip_prefix(&home_dir).unwrap_or(&path);

            // Convert to UTF-32 for nucleo
            let mut buf = Vec::new();
            let haystack_str = Utf32Str::new(match_target, &mut buf);

            // Get score
            atom.score(haystack_str, &mut matcher)
                .map(|score| (path, score))
        })
        .collect();

    // Sort by score descending
    scored_results.sort_by(|a, b| b.1.cmp(&a.1));

    // Take top 20 and convert to result format
    scored_results
        .into_iter()
        .take(20)
        .map(|(path, score)| {
            let display_path = path
                .strip_prefix(&home_dir)
                .map(|p| format!("~{}", p))
                .unwrap_or_else(|| path.clone());
            FileSearchResult {
                path,
                display_path,
                score,
            }
        })
        .collect()
}
