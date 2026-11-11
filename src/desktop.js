// Optional desktop integration. The browser/standalone game stays fully offline.
var DI = globalThis.DI || (globalThis.DI = {});
(function () {
  const REPO = 'https://github.com/Abe-Borg/double-interlock';
  const API = 'https://api.github.com/repos/Abe-Borg/double-interlock/releases/latest';
  const invoke = (...args) => globalThis.__TAURI__.core.invoke(...args);
  const desktop = DI.desktop = {
    available: !!globalThis.__TAURI__?.core?.invoke,
    // Stable releases only; compare numeric components, never version strings.
    version(v) { return typeof v === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(v) ? v.split('.').map(Number) : null; },
    readRelease(data, current) {
      const installed = desktop.version(current), next = desktop.version(data?.tag_name?.replace(/^v/, ''));
      if (!installed || !next || data.draft || data.prerelease || !data.tag_name.startsWith('v')) throw new Error('The latest release has an unsupported version.');
      let newer = false;
      for (let i = 0; i < 3; i++) { if (next[i] !== installed[i]) { newer = next[i] > installed[i]; break; } }
      if (!newer) return null;
      const version = data.tag_name.slice(1), name = 'Double-Interlock-' + version + '-windows-x64-setup.exe';
      const url = REPO + '/releases/download/v' + version + '/' + name;
      if (!Array.isArray(data.assets) || !data.assets.some((a) => a.name === name && a.browser_download_url === url && a.size > 0 && a.state === 'uploaded')) throw new Error('The Windows installer is not available yet. Try again later.');
      return { version };
    },
    async check() {
      if (!desktop.available) return;
      DI.ui.modal('<h4>DOUBLE INTERLOCK</h4><h2>Check for updates</h2><p id="updateStatus" role="status" aria-live="polite">Checking for updates…</p><div class="mrow"><button id="updateDownload" class="go" hidden>Download update</button><button id="updateReleases">View releases</button><button id="updateClose">Back</button></div>', false);
      const status = document.getElementById('updateStatus'), download = document.getElementById('updateDownload');
      const open = async (version) => { try { await invoke('open_release', { version }); } catch (e) { status.textContent = 'Could not open your browser. Visit ' + REPO + '/releases/latest to download the installer.'; } };
      document.getElementById('updateClose').onclick = DI.ui.showMenu;
      document.getElementById('updateReleases').onclick = () => open(null);
      try {
        const info = await invoke('desktop_info');
        if (info.arch !== 'x86_64') throw new Error('Use View releases to find an installer for this machine.');
        const response = await fetch(API, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(10000), cache: 'no-store' });
        if (!response.ok) throw new Error(response.status === 404 ? 'No published release was found. Use View releases to check GitHub.' : response.status === 403 || response.status === 429 ? 'GitHub is limiting update checks. Try again later or use View releases.' : 'The update service is unavailable. Try again later.');
        const update = desktop.readRelease(await response.json(), info.version);
        status.textContent = update ? 'Version ' + update.version + ' is available. You have ' + info.version + '. Download the installer, close the game, then run it to update. Your saved progress is kept.' : 'You’re up to date. Installed version: ' + info.version + '.';
        if (update) { download.hidden = false; download.onclick = () => open(update.version); }
      } catch (e) {
        status.textContent = e.name === 'TimeoutError' || e.name === 'AbortError' ? 'The update check timed out. Check your connection and try again.' : e instanceof TypeError ? 'Could not reach GitHub. Check your connection and try again, or use View releases.' : e.message || 'Could not check for updates. Try again later.';
      }
    }
  };
})();
