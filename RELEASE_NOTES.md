Double Interlock now has a Windows desktop app, built with Tauri 2 and Microsoft Edge WebView2.

- Install **Double-Interlock-1.0.0-windows-x64-setup.exe** on Windows 10 or 11 (64-bit Intel/AMD). No Node.js, Rust, or administrator account is needed. Setup installs WebView2 if it is missing; that step needs an internet connection.
- Play offline in a resizable, hardware-accelerated window. The installer uses the system WebView2 runtime and includes the complete simulation.
- Choose **Check for updates** from the contracts menu to check the latest stable GitHub release and download its installer. Update checks are manual; updates are never installed during a game.
- Saved progress stays on this PC across app upgrades. Browser saves are separate from desktop saves.
- Includes all gameplay changes through Cycle 8.

The installer is currently unsigned, so Windows may show a SmartScreen prompt. SHA-256 hashes are provided in **SHA256SUMS.txt**. The self-contained **double-interlock.html** is also available for browser play.
