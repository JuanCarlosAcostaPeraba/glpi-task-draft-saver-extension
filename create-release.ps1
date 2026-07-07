# create-release.ps1
# Packages the GLPI Draft Saver Pro extensions for Chrome and Firefox.

# Function to build ZIP with forward-slashes for paths (required by Firefox and best practice)
function Build-ZipPackage($sourcePath, $outputFile) {
    if (Test-Path $outputFile) { Remove-Item $outputFile }
    
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem

    $zipStream = [System.IO.File]::Open($outputFile, [System.IO.FileMode]::Create)
    $zipArchive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)

    # Copy files manually to ensure forward slashes
    Get-ChildItem -Path $sourcePath -Recurse | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
        $relativePath = $_.FullName.Substring($sourcePath.Length + 1)
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
}

# 1. Package Chrome Extension
$chromeVersion = (Get-Content "chrome\manifest.json" | ConvertFrom-Json).version
$chromeReleaseName = "glpi-draft-saver-pro-chrome-v$chromeVersion.zip"
$chromeOutput = Join-Path $PSScriptRoot $chromeReleaseName
Write-Host "Packaging Chrome version $chromeVersion into $chromeReleaseName..."
Build-ZipPackage (Join-Path $PSScriptRoot "chrome") $chromeOutput

# 2. Package Firefox Extension
$firefoxVersion = (Get-Content "firefox\manifest.json" | ConvertFrom-Json).version
$firefoxReleaseName = "glpi-draft-saver-pro-firefox-v$firefoxVersion.zip"
$firefoxOutput = Join-Path $PSScriptRoot $firefoxReleaseName
Write-Host "Packaging Firefox version $firefoxVersion into $firefoxReleaseName..."
Build-ZipPackage (Join-Path $PSScriptRoot "firefox") $firefoxOutput

Write-Host "`nAll releases successfully created in the root folder:"
Write-Host "- Chrome Release: $chromeOutput"
Write-Host "- Firefox Release: $firefoxOutput"
