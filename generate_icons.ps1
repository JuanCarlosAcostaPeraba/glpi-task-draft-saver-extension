# generate_icons.ps1
# Generates extension icons from a base image using .NET libraries (no external dependencies required)

$baseIcon = Join-Path $PSScriptRoot "extension_icon_base.png" # The image I generated
if (-not (Test-Path $baseIcon)) {
    $baseIcon = (Get-ChildItem -Path $PSScriptRoot -Filter "extension_icon_base_*.png" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
}

if (-not $baseIcon) {
    Write-Error "Base icon not found. Please place 'extension_icon_base.png' in the root."
    exit 1
}

$destDir = Join-Path $PSScriptRoot "extension\icons"
if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir }

Add-Type -AssemblyName System.Drawing

function Resize-Image {
    param(
        [string]$SourceFile,
        [int]$Width,
        [int]$Height,
        [string]$DestinationFile
    )
    
    $source = [System.Drawing.Image]::FromFile($SourceFile)
    $dest = New-Object System.Drawing.Bitmap($Width, $Height)
    $graphics = [System.Drawing.Graphics]::FromImage($dest)
    
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $graphics.DrawImage($source, 0, 0, $Width, $Height)
    
    $dest.Save($DestinationFile, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $graphics.Dispose()
    $dest.Dispose()
    $source.Dispose()
    
    Write-Host "Generated: $DestinationFile"
}

Resize-Image $baseIcon 16 16 (Join-Path $destDir "icon16.png")
Resize-Image $baseIcon 48 48 (Join-Path $destDir "icon48.png")
Resize-Image $baseIcon 128 128 (Join-Path $destDir "icon128.png")

Write-Host "All icons generated in $destDir"
