$ErrorActionPreference = 'Stop'
$version = (Get-Content package.json | ConvertFrom-Json).version
if ($env:GITHUB_REF_TYPE -eq 'tag' -and $env:GITHUB_REF_NAME -ne "v$version") {
  throw 'Release tag must match package.json version'
}
$installers = @(Get-ChildItem src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*-setup.exe)
if ($installers.Count -ne 1) { throw 'Expected exactly one Windows x64 installer' }
New-Item -ItemType Directory -Force dist/release | Out-Null
$name = "Double-Interlock-$version-windows-x64-setup.exe"
Copy-Item $installers[0].FullName "dist/release/$name"
Copy-Item double-interlock.html dist/release/double-interlock.html
$lines = Get-ChildItem dist/release -File | Sort-Object Name | ForEach-Object {
  "$((Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower())  $($_.Name)"
}
[IO.File]::WriteAllText((Join-Path (Get-Location) 'dist/release/SHA256SUMS.txt'), ($lines -join "`n") + "`n")
