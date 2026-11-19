# Ejecuta todas las suites de pruebas de Club Pingüi y resume el resultado.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\test-all.ps1
#
# Devuelve exit code 1 si alguna suite falla.

$ErrorActionPreference = "Continue"

$proj = Split-Path -Parent $PSScriptRoot

# Node: primero el instalado por usuario, luego el del PATH.
$node = Join-Path $env:LOCALAPPDATA "Programs\nodejs\node.exe"
if (-not (Test-Path $node)) {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { $node = $cmd.Source }
}
if (-not (Test-Path $node)) {
  Write-Output "ERROR: no se encontró node.exe. Instala Node.js o añádelo al PATH."
  exit 1
}

$runner = Join-Path $proj "public\test\runner.mjs"
$suites = @("t-logica", "t-auth", "t-combate", "t-armas", "t-movimiento", "t-servidor", "t-loot", "t-modos", "t-coliseo", "t-escondite", "t-tnt", "t-assets")

$summary = @()
$failed = 0

foreach ($name in $suites) {
  $file = Join-Path $proj "public\test\$name.mjs"
  Write-Output ""
  Write-Output "================ $name ================"
  & $node $runner $file
  $code = $LASTEXITCODE
  $summary += [pscustomobject]@{ Suite = $name; Resultado = if ($code -eq 0) { "OK" } else { "FALLO ($code)" } }
  if ($code -ne 0) { $failed++ }
}

Write-Output ""
Write-Output "================ RESUMEN ================"
$summary | Format-Table -AutoSize

if ($failed -gt 0) {
  Write-Output "RESULTADO: $failed suite(s) con fallos."
  exit 1
}

Write-Output "RESULTADO: todas las suites pasaron."
exit 0
