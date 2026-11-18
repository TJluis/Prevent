# Detiene los servidores de Club Pingüi que escuchan en 3000 y 3050.
# Solo cierra procesos "node" para no afectar otras aplicaciones.

$ports = @(3000, 3050)
foreach ($port in $ports) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object {
      $proc = Get-Process -Id $_ -ErrorAction SilentlyContinue
      if ($proc -and $proc.ProcessName -eq "node") {
        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
      }
    }
}
