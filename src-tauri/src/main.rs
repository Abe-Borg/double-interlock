#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_opener::OpenerExt;

const RELEASES: &str = "https://github.com/Abe-Borg/double-interlock/releases/latest";

#[derive(serde::Serialize)]
struct DesktopInfo {
    version: String,
    arch: &'static str,
}

#[tauri::command]
fn desktop_info(app: tauri::AppHandle) -> DesktopInfo {
    DesktopInfo {
        version: app.package_info().version.to_string(),
        arch: std::env::consts::ARCH,
    }
}

fn release_url(version: Option<&str>) -> Result<String, String> {
    let Some(version) = version else {
        return Ok(RELEASES.into());
    };
    let parsed = semver::Version::parse(version).map_err(|_| "Invalid release version")?;
    if !parsed.pre.is_empty() || !parsed.build.is_empty() || parsed.to_string() != version {
        return Err("Only stable releases can be downloaded".into());
    }
    Ok(format!("https://github.com/Abe-Borg/double-interlock/releases/download/v{version}/Double-Interlock-{version}-windows-x64-setup.exe"))
}

// Only this repository's release page or a versioned installer can leave the app.
// The webview has no general shell, filesystem, or URL-opening permissions.
#[tauri::command]
fn open_release(app: tauri::AppHandle, version: Option<String>) -> Result<(), String> {
    let url = release_url(version.as_deref())?;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![desktop_info, open_release])
        .run(tauri::generate_context!())
        .expect("Could not start Double Interlock");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn download_links_stay_in_the_release_repository() {
        assert_eq!(release_url(None).unwrap(), RELEASES);
        assert!(release_url(Some("1.2.3"))
            .unwrap()
            .ends_with("/v1.2.3/Double-Interlock-1.2.3-windows-x64-setup.exe"));
        for invalid in [
            "https://evil.example",
            "../1.2.3",
            "1.2.3/evil",
            "v1.2.3",
            "1.2.3-beta.1",
            "1.2.3+build",
        ] {
            assert!(release_url(Some(invalid)).is_err(), "accepted {invalid}");
        }
    }
}
