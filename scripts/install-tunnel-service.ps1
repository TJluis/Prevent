# Instala cloudflared como servicio de Windows usando el token del tunel.
# Debe ejecutarse en una consola elevada (Administrador).
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\install-tunnel-service.ps1 -Token "<token>"

param(
  [Parameter(Mandatory = $true)][string]$Token
)

$ErrorActionPreference = "Continue"

$cfDir = "C:\Cloudflared\Cloudflared"
$exe = Join-Path $cfDir "cloudflared-windows-amd64.exe"
$log = Join-Path $env:TEMP "cloudflared-service-install.log"

function Log([string]$msg) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
  Write-Host $line
  Add-Content -Path $log -Value $line
}

$isAdmin = (New-Object Security.Principal.WindowsPrincipal(
  [Security.Principal.WindowsIdentity]::GetCurrent()
)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

Log "Elevado: $isAdmin"
if (-not $isAdmin) {
  Log "ERROR: este script necesita permisos de Administrador."
  exit 1
}
if (-not (Test-Path $exe)) {
  Log "ERROR: no existe $exe"
  exit 1
}

# 1) Instalar el servicio con el token (el token ya incluye cuenta, tunel y secreto).
Log "Instalando servicio cloudflared..."
& $exe service install $Token 2>&1 | ForEach-Object { Log $_ }
Log "ExitCode service install = $LASTEXITCODE"

# 2) Desactivar la tarea programada para no tener dos conectores duplicados.
$task = Get-ScheduledTask -TaskName "ClubPingui Tunnel" -ErrorAction SilentlyContinue
if ($task) {
  Disable-ScheduledTask -TaskName "ClubPingui Tunnel" -ErrorAction SilentlyContinue | Out-Null
  Log "Tarea 'ClubPingui Tunnel' desactivada."
} else {
  Log "No existe la tarea 'ClubPingui Tunnel'."
}

# 3) Detener el tunel lanzado a mano (sin --token) para evitar duplicados.
Get-CimInstance Win32_Process -Filter "Name='cloudflared-windows-amd64.exe'" -ErrorAction SilentlyContinue |
  ForEach-Object {
    if ($_.CommandLine -notlike "*--token*") {
      Log "Deteniendo proceso manual PID $($_.ProcessId)"
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
  }

# 4) Asegurar arranque automatico y servicio iniciado.
Set-Service -Name cloudflared -StartupType Automatic -ErrorAction SilentlyContinue
Start-Service cloudflared -ErrorAction SilentlyContinue
Start-Sleep -Seconds 8

$svc = Get-Service cloudflared -ErrorAction SilentlyContinue
if ($svc) {
  Log "Servicio cloudflared: estado=$($svc.Status) inicio=$($svc.StartType)"
} else {
  Log "ERROR: el servicio cloudflared no aparece instalado."
}

Log "FIN"
