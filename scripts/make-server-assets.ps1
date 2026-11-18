# Genera los recursos de imagen del servidor a partir del JPEG original.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\make-server-assets.ps1
#
# Salidas:
#   public/assets/server-card.jpg       1600x900 (banner login / miniatura menú / OG)
#   public/assets/icons/icon-512.png    icono manifest
#   public/assets/icons/icon-192.png    icono manifest
#   public/assets/icons/icon-180.png    apple-touch-icon
#   public/assets/icons/icon-32.png     favicon
#
# No requiere ImageMagick ni ffmpeg: usa System.Drawing de Windows.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$proj = Split-Path -Parent $PSScriptRoot
$srcPath = Join-Path $proj "assets\11dcffba10c84f61a2abea46a917bcef.jpeg"
if (-not (Test-Path $srcPath)) {
  Write-Output "ERROR: no se encontró $srcPath"
  exit 1
}

$outDir = Join-Path $proj "public\assets"
$iconDir = Join-Path $outDir "icons"
New-Item -ItemType Directory -Force -Path $outDir, $iconDir | Out-Null

$src = [System.Drawing.Image]::FromFile($srcPath)
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq "image/jpeg" } | Select-Object -First 1

function New-Canvas([int]$w, [int]$h) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  return @{ Bitmap = $bmp; Graphics = $g }
}

function Save-Jpeg($image, [int]$w, [int]$h, [string]$path, [int]$quality = 85) {
  $c = New-Canvas $w $h
  $c.Graphics.DrawImage($image, 0, 0, $w, $h)
  $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality, [long]$quality)
  $c.Bitmap.Save($path, $jpegCodec, $params)
  $c.Graphics.Dispose()
  $c.Bitmap.Dispose()
}

# Recorte cuadrado centrado (para iconos): no deforma la imagen.
function Save-SquarePng($image, [int]$size, [string]$path) {
  $side = [Math]::Min($image.Width, $image.Height)
  $sx = [int](($image.Width - $side) / 2)
  $sy = [int](($image.Height - $side) / 2)
  $c = New-Canvas $size $size
  $dest = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $srcRect = New-Object System.Drawing.Rectangle($sx, $sy, $side, $side)
  $c.Graphics.DrawImage($image, $dest, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  $c.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $c.Graphics.Dispose()
  $c.Bitmap.Dispose()
}

try {
  Save-Jpeg $src 1600 900 (Join-Path $outDir "server-card.jpg") 85
  Save-SquarePng $src 512 (Join-Path $iconDir "icon-512.png")
  Save-SquarePng $src 192 (Join-Path $iconDir "icon-192.png")
  Save-SquarePng $src 180 (Join-Path $iconDir "icon-180.png")
  Save-SquarePng $src 32  (Join-Path $iconDir "icon-32.png")
} finally {
  $src.Dispose()
}

Get-ChildItem $outDir -Recurse -File | ForEach-Object {
  Write-Output ("{0}  {1} KB" -f $_.FullName.Replace($proj + "\", ""), [math]::Round($_.Length / 1KB, 1))
}
