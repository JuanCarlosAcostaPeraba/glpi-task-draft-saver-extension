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

# Create ZIP
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $outputFile)

# Clean up
Remove-Item -Recurse -Force $tempDir

Write-Host "Release created: $outputFile"
Write-Host "To install in Chrome/Edge (Dev Mode): Unzip and 'Load Unpacked'"
Write-Host "To install in Firefox (Signed): Rename to .xpi if signed, or load as temporary addon."
