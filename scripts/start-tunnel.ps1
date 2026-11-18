# Arranca el túnel de Cloudflare para Club Pingüi.
# Requiere el archivo de credenciales del túnel en C:\Cloudflared\Cloudflared\.
# Si falta, escribe un aviso en logs\tunnel-launcher.log y termina sin error fatal.

$ErrorActionPreference = "SilentlyContinue"

$proj = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $proj "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$cfDir = "C:\Cloudflared\Cloudflared"
$exe = Join-Path $cfDir "cloudflared-windows-amd64.exe"
$cfg = Join-Path $cfDir "config.yml"
$cred = Join-Path $cfDir "20b6aaac-ba6e-47f2-9651-255f780138f7.json"
$launcherLog = Join-Path $logDir "tunnel-launcher.log"

function Log([string]$msg) {
  Add-Content -Path $launcherLog -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
}

if (-not (Test-Path $exe)) { Log "ERROR: no existe $exe"; exit 1 }
if (-not (Test-Path $cfg)) { Log "ERROR: no existe $cfg"; exit 1 }
if (-not (Test-Path $cred)) {
  Log "ERROR: faltan las credenciales del túnel: $cred"
  Log "Copia ese archivo desde el otro dispositivo (C:\Users\CINTHIA TOVAR\.cloudflared\) y vuelve a iniciar sesión."
  exit 1
}

# Si cloudflared ya corre como servicio de Windows, no lanzar un segundo conector.
$svc = Get-Service -Name cloudflared -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq 'Running') {
  Log "El servicio cloudflared ya esta en ejecucion; no se lanza otro tunel."
  exit 0
}

# Evita duplicados: si ya hay un cloudflared usando este config, no arranca otro.
$running = Get-CimInstance Win32_Process -Filter "Name='cloudflared-windows-amd64.exe'" |
  Where-Object { $_.CommandLine -like "*$cfg*" }
if ($running) { Log "Ya hay un túnel en ejecución (PID $($running.ProcessId))."; exit 0 }

Log "Iniciando túnel..."
Start-Process -FilePath $exe `
  -ArgumentList "--config `"$cfg`" tunnel run" `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $logDir "tunnel.log") `
  -RedirectStandardError  (Join-Path $logDir "tunnel.err.log")
