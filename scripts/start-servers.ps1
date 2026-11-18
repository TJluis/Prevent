# Inicia los servidores de Club Pingüi:
#   - Juego        -> puerto 3050  (server/index.js)
#   - Puerta/menú  -> puerto 3000  (server/redirect-server.js) -> 3050
# Pensado para ejecutarse automáticamente al iniciar sesión en Windows.
# Si un puerto ya está en uso, no arranca un duplicado.

$ErrorActionPreference = "SilentlyContinue"

$proj = Split-Path -Parent $PSScriptRoot
$node = Join-Path $env:LOCALAPPDATA "Programs\nodejs\node.exe"
if (-not (Test-Path $node)) {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { $node = $cmd.Source } else { exit 1 }
}

$logDir = Join-Path $proj "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Test-PortInUse([int]$Port) {
  return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

# Servidor de juego (3050)
if (-not (Test-PortInUse 3050)) {
  $env:PORT = "3050"
  Start-Process -FilePath $node `
    -ArgumentList "server/index.js" `
    -WorkingDirectory $proj `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir "game.log") `
    -RedirectStandardError  (Join-Path $logDir "game.err.log")
}

# Puerta 3000 -> 3050
if (-not (Test-PortInUse 3000)) {
  $env:PORT = "3000"
  Start-Process -FilePath $node `
    -ArgumentList "server/redirect-server.js" `
    -WorkingDirectory $proj `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir "redirect.log") `
    -RedirectStandardError  (Join-Path $logDir "redirect.err.log")
}
