# Crea un respaldo comprimido del código de Club Pingüi.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\backup-proyecto.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\backup-proyecto.ps1 -ConDatos
#
# Por defecto respalda solo código (public, server, docs, scripts, config).
# -ConDatos añade una copia CRUDA de data\club.db* (detén los servidores antes
# para que la copia sea consistente).

param(
  [switch]$ConDatos
)

$ErrorActionPreference = "Stop"

$proj = Split-Path -Parent $PSScriptRoot
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outDir = Join-Path $proj "backups"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$zip = Join-Path $outDir "clubpingui_$stamp.zip"
$tmp = Join-Path $env:TEMP "clubpingui_backup_$stamp"

$items = @(
  "public",
  "server",
  "docs",
  "scripts",
  "package.json",
  "package-lock.json",
  "README.md",
  ".env.example",
  ".gitignore"
)

New-Item -ItemType Directory -Force -Path $tmp | Out-Null

try {
  foreach ($item in $items) {
    $src = Join-Path $proj $item
    if (Test-Path $src) {
      Copy-Item $src -Destination $tmp -Recurse -Force
    }
  }

  if ($ConDatos) {
    $dataDir = Join-Path $proj "data"
    $dataOut = Join-Path $tmp "data"
    New-Item -ItemType Directory -Force -Path $dataOut | Out-Null
    if (Test-Path $dataDir) {
      Get-ChildItem $dataDir -File -Filter "club.db*" | ForEach-Object {
        Copy-Item $_.FullName (Join-Path $dataOut $_.Name) -Force
      }
    }
    Write-Output "AVISO: copia cruda de la BD incluida. Si los servidores estaban activos, puede quedar inconsistente."
  }

  Compress-Archive -Path (Join-Path $tmp "*") -DestinationPath $zip -CompressionLevel Optimal -Force
} finally {
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

$size = [math]::Round((Get-Item $zip).Length / 1KB, 1)
Write-Output "Respaldo creado: $zip ($size KB)"
