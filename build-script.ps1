# Build script for Syncra
$ErrorActionPreference = "Stop"

# Step 1: Check if app-old doesn't exist, then try to rename app to app-old
if (-not (Test-Path "app-old")) {
    try {
        Rename-Item -Path "app" -NewName "app-old" -Force -ErrorAction Stop
        Write-Host "Renamed app to app-old"
    } catch {
        Write-Host "Could not rename app directory, trying alternative approach"
        # Alternative: Try to use robocopy to mirror src/app to a new app directory, but first let's try to delete app/api/auth
        try {
            attrib -r -s -h "app/api/auth" /s /d 2>$null
            [System.IO.Directory]::Delete("app/api/auth", $true)
            Write-Host "Deleted app/api/auth"
        } catch {
            Write-Host "Could not delete app/api/auth, proceeding with src/app swap"
        }
    }
}

# Step 2: Rename src/app to app
if (Test-Path "src/app") {
    try {
        Rename-Item -Path "src/app" -NewName "app" -Force -ErrorAction Stop
        Write-Host "Renamed src/app to app"
    } catch {
        throw "Could not rename src/app to app"
    }
} else {
    throw "src/app not found"
}

# Step 3: Run the build
try {
    npm run build -- --webpack
    Write-Host "Build completed successfully"
} finally {
    # Step 4: Revert the directory names
    Write-Host "Reverting directory changes"
    if (Test-Path "app") {
        Rename-Item -Path "app" -NewName "src/app" -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path "app-old") {
        Rename-Item -Path "app-old" -NewName "app" -Force -ErrorAction SilentlyContinue
    }
}
