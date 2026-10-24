//! Tauri backend for the markdown reader.
//!
//! The reader itself is entirely front-end; the backend only exposes the few
//! capabilities a webview cannot provide on its own: the native file picker
//! (`tauri-plugin-dialog`), raw file reads for the documents the user
//! explicitly selects, and read access to the folder a document lives in so
//! that relative images resolve.

use std::path::PathBuf;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{Emitter, Manager, Url};
use tauri_plugin_fs::{FilePath, FsExt};

/// A document the user asked for, waiting to be opened.
static PENDING_DOCUMENT: Mutex<Option<String>> = Mutex::new(None);

/// The largest document the reader will open.
const MAX_DOCUMENT_BYTES: u64 = 32 * 1024 * 1024;

/// The schemes the reader is prepared to open.
const URI_SCHEMES: [&str; 2] = ["file:", "content:"];

/// A document, together with the path it was actually read from.
#[derive(Serialize)]
struct OpenedDocument {
    path: String,
    content: String,
}

/// Resolves a path to its canonical form.
///
/// Canonicalising in one place keeps the history honest: the same file
/// reached through two different paths is recognized as one document.
fn canonical_path(path: &str) -> PathBuf {
    std::fs::canonicalize(path).unwrap_or_else(|_| PathBuf::from(path))
}

/// Whether a location is a URI rather than a path on disk.
fn is_uri(location: &str) -> bool {
    URI_SCHEMES
        .iter()
        .any(|scheme| location.starts_with(scheme))
}

/// Decides how a location should be opened.
///
/// A URI is handed to the platform's own reader, which knows how to ask
/// Android's content resolver for a document and how to reach a
/// security-scoped file on iOS. Anything else is a path.
fn file_target(location: &str) -> FilePath {
    if !is_uri(location) {
        return FilePath::Path(PathBuf::from(location));
    }

    match Url::parse(location) {
        Ok(url) => FilePath::Url(url),
        Err(_) => FilePath::Path(PathBuf::from(location)),
    }
}

/// Reads a document the user asked for.
///
/// Decoding is lossy so that files saved in a legacy single-byte encoding
/// still open instead of failing the whole read.
#[tauri::command]
fn read_document(app: tauri::AppHandle, location: String) -> Result<OpenedDocument, String> {
    let target = file_target(&location);

    if let FilePath::Path(path) = &target {
        let metadata = std::fs::metadata(path)
            .map_err(|error| format!("Could not read {location}: {error}"))?;

        if metadata.len() > MAX_DOCUMENT_BYTES {
            return Err("That file is too large to read as a document.".to_string());
        }
    }

    let content = app
        .fs()
        .read_to_string(target.clone())
        .map_err(|error| format!("Could not read {location}: {error}"))?;

    let path = match &target {
        FilePath::Url(url) => url.to_string(),
        FilePath::Path(path) => canonical_path(&path.to_string_lossy())
            .to_string_lossy()
            .into_owned(),
    };

    Ok(OpenedDocument { path, content })
}

/// Grants the asset protocol read access to a folder so that relative images
/// inside a document can be loaded.
#[tauri::command]
fn allow_asset_directory(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.asset_protocol_scope()
        .allow_directory(canonical_path(&path), true)
        .map_err(|error| error.to_string())
}

/// The document the app was launched with, if any.
///
/// This is what makes opening a markdown file from a file manager work. The
/// document is read in the same call, so that the reader only has to make one
/// round trip to the backend before it has something to show.
#[tauri::command]
fn read_startup_document(app: tauri::AppHandle) -> Result<Option<OpenedDocument>, String> {
    let Some(path) = PENDING_DOCUMENT
        .lock()
        .ok()
        .and_then(|mut pending| pending.take())
    else {
        return Ok(None);
    };

    Ok(Some(read_document(app, path)?))
}

/// Records a document the user asked for and tells the reader about it.
fn request_document(app: &tauri::AppHandle, location: String) {
    if let Ok(mut pending) = PENDING_DOCUMENT.lock() {
        *pending = Some(location.clone());
    }

    let _ = app.emit("open-document", location);
}

/// The location of a document the system handed over.
///
/// macOS gives a file URL that can be turned into a path. iOS and Android
/// give locations that only the platform can read, so they are kept as they
/// are.
#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
fn location_of(url: &Url) -> String {
    #[cfg(target_os = "macos")]
    {
        url.to_file_path()
            .map(|path| path.to_string_lossy().into_owned())
            .unwrap_or_else(|_| url.to_string())
    }

    #[cfg(not(target_os = "macos"))]
    {
        url.to_string()
    }
}

/// Captures the first non-flag argument as the document to open.
fn capture_startup_path() -> Option<PathBuf> {
    std::env::args_os()
        .skip(1)
        .map(PathBuf::from)
        .find(|argument| !argument.to_string_lossy().starts_with('-'))
        .filter(|argument| argument.is_file())
}

/// The page background, in the two themes the reader has.
const PAPER: tauri::window::Color = tauri::window::Color(0xf4, 0xef, 0xe6, 0xff);
const INK: tauri::window::Color = tauri::window::Color(0x14, 0x16, 0x1b, 0xff);

/// The number of the user the reader is running as.
///
/// The runtime directory of a session is named after it, and it is where the
/// accessibility bus publishes its socket.
#[cfg(target_os = "linux")]
fn own_uid() -> Option<u32> {
    let status = std::fs::read_to_string("/proc/self/status").ok()?;
    let uid = status
        .lines()
        .find_map(|line| line.strip_prefix("Uid:"))?
        .split_whitespace()
        .next()?
        .parse()
        .ok()?;
    Some(uid)
}

/// The sockets an accessibility bus would be on, if the session has one.
///
/// There are two ways to find it. The session may advertise its address in
/// the environment, and the bus always publishes a socket in the session's
/// runtime directory.
#[cfg(target_os = "linux")]
fn accessibility_bus_sockets() -> Vec<PathBuf> {
    let mut sockets = Vec::new();

    for name in ["AT_SPI_BUS_ADDRESS", "AT_SPI_BUS"] {
        if let Some(address) = std::env::var_os(name) {
            let address = address.to_string_lossy();
            if let Some(path) = address.strip_prefix("unix:path=") {
                sockets.push(PathBuf::from(path));
            }
        }
    }

    let mut directories = Vec::new();
    if let Some(runtime) = std::env::var_os("XDG_RUNTIME_DIR") {
        directories.push(PathBuf::from(runtime));
    } else if let Some(uid) = own_uid() {
        directories.push(PathBuf::from(format!("/run/user/{uid}")));
    }

    for directory in directories {
        let Ok(entries) = std::fs::read_dir(directory.join("at-spi")) else {
            continue;
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let is_bus = path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with("bus"));

            if is_bus {
                sockets.push(path);
            }
        }
    }

    sockets
}

/// Whether this session has an accessibility bus that is answering.
///
/// GTK registers with the accessibility bus when it starts, so that a screen
/// reader can see the window. When the session has no such bus, the attempt
/// times out and GTK prints a warning that is about the session rather than
/// about the reader. The bus is a socket, so whether anything is listening
/// on one is a good enough answer.
#[cfg(target_os = "linux")]
fn accessibility_bus_is_listening() -> bool {
    use std::os::unix::net::UnixStream;

    accessibility_bus_sockets()
        .iter()
        .any(|path| UnixStream::connect(path).is_ok())
}

/// Keeps the accessibility warnings out of the way.
///
/// The accessibility bridge announces itself on the accessibility bus when it
/// starts, and says so loudly when the session has no bus for it to reach.
/// It is a fact about the session, not about the reader, and it is said on
/// every start, so the message is dropped rather than the bridge: a screen
/// reader that turns up later still finds the reader.
#[cfg(target_os = "linux")]
fn quiet_the_accessibility_warnings() {
    glib::log_set_handler(
        Some("dbind"),
        glib::LogLevels::LEVEL_WARNING | glib::LogLevels::LEVEL_CRITICAL,
        false,
        false,
        |domain, level, message| {
            if message.contains("accessibility bus") {
                return;
            }

            glib::log_default_handler(domain, level, Some(message));
        },
    );
}

/// Keeps the web engine from announcing itself on a bus that is not there.
///
/// The engine does its own connecting, in the process it starts, and its
/// message cannot be filtered from here. It is only told about the bus when
/// the session has one, which is the only time the bus is worth talking to.
#[cfg(target_os = "linux")]
fn quiet_the_web_engine() {
    if accessibility_bus_is_listening() {
        return;
    }

    std::env::set_var("WEBKIT_A11Y_BUS_ADDRESS", "");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let startup = capture_startup_path();

    #[cfg(target_os = "linux")]
    {
        quiet_the_accessibility_warnings();
        quiet_the_web_engine();
    }

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init());

    // The updater checks a signed manifest and installs the download itself.
    // Phones are updated through their store instead, so the plugin is only
    // registered on the desktop. The builder is shadowed rather than
    // reassigned, so neither platform has a binding it does not use.
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    let app = builder
        .setup(|app| {
            // The window is on screen before the page has painted, so it is
            // given the color the page will be, rather than the white a
            // webview starts out as.
            if let Some(window) = app.get_webview_window("main") {
                let dark = window
                    .theme()
                    .map(|theme| theme == tauri::Theme::Dark)
                    .unwrap_or(false);
                let _ = window.set_background_color(Some(if dark { INK } else { PAPER }));
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_document,
            allow_asset_directory,
            read_startup_document
        ])
        .build(tauri::generate_context!())
        .expect("error while building the markdown reader");

    if let Some(path) = startup {
        request_document(app.handle(), path.to_string_lossy().into_owned());
    }

    app.run(
        #[cfg_attr(
            not(any(target_os = "macos", target_os = "ios", target_os = "android")),
            allow(unused_variables)
        )]
        |app, event| match event {
            // macOS and iOS deliver documents opened from the file manager as
            // an event rather than as an argument, so they are picked up here.
            // Android delivers the same way when a document is opened.
            #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
            tauri::RunEvent::Opened { urls } => {
                if let Some(url) = urls.first() {
                    request_document(app, location_of(url));
                }
            }
            _ => {}
        },
    );
}
