# add-defender-exclusions.ps1
# Run this script once from an ELEVATED (Run as Administrator) PowerShell window.
# It adds Windows Defender exclusions for the high-churn Next.js directories,
# which eliminates real-time AV scanning overhead (fixes the 422ms FS benchmark).

$projectRoot = "D:\Syncar\syncra"
$paths = @(
    "$projectRoot\.next",
    "$projectRoot\node_modules",
    $projectRoot          # project root catches tsconfig.tsbuildinfo etc.
)

foreach ($p in $paths) {
    try {
        Add-MpPreference -ExclusionPath $p -ErrorAction Stop
        Write-Host "[OK] Excluded: $p" -ForegroundColor Green
    } catch {
        Write-Host "[FAIL] Could not exclude $p — are you running as Administrator?" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Done. Restart the Next.js dev server and check if the 422ms FS warning is gone." -ForegroundColor Cyan
