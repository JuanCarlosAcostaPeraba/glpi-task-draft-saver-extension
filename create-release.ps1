# create-release.ps1
# Packages the GLPI Draft Saver Pro extension into a ZIP file for distribution.

$version = (Get-Content "extension\manifest.json" | ConvertFrom-Json).version
$releaseName = "glpi-draft-saver-pro-v$version.zip"
$tempDir = Join-Path $PSScriptRoot "release_temp"
$outputFile = Join-Path $PSScriptRoot $releaseName

Write-Host "Packaging version $version into $releaseName..."

# Clean up previous attempts
if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
if (Test-Path $outputFile) { Remove-Item $outputFile }

# Create temp structure
New-Item -ItemType Directory -Path $tempDir

# Copy extension files
Copy-Item -Recurse "extension\*" $tempDir

# Remove any unwanted files (e.g. source maps, hidden files)
Get-ChildItem -Path $tempDir -Recurse -Filter ".DS_Store" | Remove-Item -Force
Get-ChildItem -Path $tempDir -Recurse -Filter "*.map" | Remove-Item -Force

# Create ZIP with forward-slash paths (required for Firefox AMO compatibility)
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipStream = [System.IO.File]::Open($outputFile, [System.IO.FileMode]::Create)
$zipArchive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)

Get-ChildItem -Path $tempDir -Recurse | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
    $relativePath = $_.FullName.Substring($tempDir.Length + 1)
    # Force forward slash for zip entry path
    $entryName = $relativePath.Replace('\', '/')
    
    $entry = $zipArchive.CreateEntry($entryName)
    $entryStream = $entry.Open()
    $fileStream = [System.IO.File]::OpenRead($_.FullName)
    $fileStream.CopyTo($entryStream)
    $fileStream.Close()
    $entryStream.Close()
}

$zipArchive.Dispose()
$zipStream.Close()

# Clean up
Remove-Item -Recurse -Force $tempDir

Write-Host "Release created: $outputFile"
Write-Host "To install in Chrome/Edge (Dev Mode): Unzip and 'Load Unpacked'"
Write-Host "To install in Firefox (Signed): Rename to .xpi if signed, or load as temporary addon."
