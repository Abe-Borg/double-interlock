# Windows desktop app

The game remains vanilla JavaScript and canvas. Tauri 2 embeds the built HTML in a native executable;
WebView2 supplies the Chromium rendering and JavaScript engine. There is no local server, Node.js
runtime, or runtime asset download. The frame-budgeted simulation and reduced hydraulic graph stay
unchanged. Packaging alone does not guarantee a frame rate on every PC; the browser tests and
campaign exercise the existing engine, and graphics still depend on the PC's drivers and hardware.

## Build on Windows

Install Node.js 24, stable Rust with the `x86_64-pc-windows-msvc` target, and Visual Studio 2022
Build Tools with **Desktop development with C++** and the Windows SDK. Install WebView2 if needed.

```powershell
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:desktop
npm run test:ui
cargo test --manifest-path src-tauri/Cargo.toml --locked --release --target x86_64-pc-windows-msvc
npm run desktop:build -- --target x86_64-pc-windows-msvc --bundles nsis -- --locked
./scripts/package-release.ps1
```

The installer and SHA-256 hashes are in `dist/release/`. For local development use `npm run desktop:dev`;
the frontend is staged before launch, so rerun after editing sources. The installer embeds Microsoft's
WebView2 bootstrapper and installs the runtime only if missing. This keeps downloads small while
requiring network access on PCs without WebView2. The app itself works offline.

Setup installs for the current user, creates a Start menu shortcut, supports uninstall through Windows
Settings, and upgrades the same app identity. Keep `com.abeborg.doubleinterlock` and the product name
stable: WebView2's user profile under the app's local data directory holds progress. Uninstalling does
not explicitly delete that profile. Browser saves are separate and are not imported automatically.

## Update checks

The contracts menu shows **Check for updates** only in the desktop app. A manual check fetches
`https://api.github.com/repos/Abe-Borg/double-interlock/releases/latest`, times out after 10 seconds,
compares stable semantic versions numerically, and requires an uploaded Windows installer with the
expected name and repository URL. Drafts, preview releases, downgrades, and incomplete releases
cannot produce an update offer. Offline and rate-limit errors leave a **View releases** fallback.

The native bridge can open only this repository's release page or its versioned installer URL.
The webview has no general filesystem or shell permissions. Downloading opens the default browser;
the app never executes a downloaded program or interrupts gameplay to install an update. No GitHub
token or signing key is embedded in the application.

## Cut a release

1. Bump the same stable version in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`,
   `src-tauri/Cargo.lock`, and `src-tauri/tauri.conf.json`. Update `RELEASE_NOTES.md` and the README's
   installer name. Keep the asset naming convention in `scripts/package-release.ps1`.
2. Run the checks above and commit the release changes.
3. Push the commit and an annotated tag matching the version, for example `v1.0.0`.

The **Windows installer** GitHub Actions workflow also builds on pull requests and manual dispatches.
Tag builds validate versions, test the engine and UI, build the installer on Windows, smoke-test a
silent install and launch, and upload a workflow artifact. Only a successful tag build creates a
draft GitHub Release with the installer, standalone HTML, and `SHA256SUMS.txt`, then publishes it as
latest. This keeps an incomplete build out of the update feed. Re-running publication for an existing
release fails safely; inspect that release before changing or replacing its assets.

The installer is currently unsigned. Authenticode signing requires the publisher's Windows signing
certificate or signing service, which is not configured here. Tauri updater signatures are not needed
because the app offers a browser download rather than automatic in-app installation.
