$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " OGA - CREATION DU ZIP APRES CYCLE 6 LOT 2B" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$Project = (Get-Location).Path

if (-not (Test-Path (Join-Path $Project "package.json"))) {
    throw "ERREUR : package.json est introuvable. Ouvrez le depot Omnia Global Academy dans VS Code."
}

if (-not (Test-Path (Join-Path $Project "src"))) {
    throw "ERREUR : le dossier src est introuvable."
}

if (-not (Test-Path (Join-Path $Project "supabase"))) {
    throw "ERREUR : le dossier supabase est introuvable."
}

function Get-RealDownloadsPath {
    $registryPaths = @(
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders",
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders"
    )

    foreach ($registryPath in $registryPaths) {
        if (Test-Path $registryPath) {
            $item = Get-ItemProperty -Path $registryPath -ErrorAction SilentlyContinue
            $value = $item.'{374DE290-123F-4565-9164-39C4925E467B}'

            if ($value) {
                $expanded = [Environment]::ExpandEnvironmentVariables($value)

                if (Test-Path $expanded) {
                    return (Resolve-Path $expanded).Path
                }
            }
        }
    }

    $candidates = @(
        (Join-Path $env:OneDrive "Downloads"),
        (Join-Path $env:OneDriveConsumer "Downloads"),
        (Join-Path $env:OneDrive "Téléchargements"),
        (Join-Path $env:OneDriveConsumer "Téléchargements"),
        (Join-Path $HOME "OneDrive\Downloads"),
        (Join-Path $HOME "OneDrive\Téléchargements"),
        (Join-Path $HOME "Downloads"),
        (Join-Path $HOME "Téléchargements")
    ) | Where-Object { $_ -and (Test-Path $_) }

    if ($candidates) {
        return (Resolve-Path ($candidates | Select-Object -First 1)).Path
    }

    throw "ERREUR : aucun dossier Downloads n'a ete detecte."
}

$Downloads = Get-RealDownloadsPath

Write-Host "Projet detecte :" -ForegroundColor Green
Write-Host $Project
Write-Host ""
Write-Host "Dossier Downloads detecte :" -ForegroundColor Green
Write-Host $Downloads
Write-Host ""

$Stamp = Get-Date -Format "yyyyMMdd-HHmm"
$ZipName = "omnia-global-academy-v2-cycle6-lot2b-valide-$Stamp.zip"
$ZipPath = Join-Path $Downloads $ZipName

$TempRoot = Join-Path $env:TEMP "oga_cycle6_lot2b_$Stamp"
$TempProject = Join-Path $TempRoot "omnia-global-academy-v2-cycle6-lot2b-valide"

if (Test-Path $TempRoot) {
    Remove-Item $TempRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $TempProject -Force | Out-Null

$ExcludedDirectories = @(
    ".git",
    "node_modules",
    "dist",
    ".supabase",
    "coverage",
    ".vite",
    ".cache"
)

$ExcludedFiles = @(
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".env.test",
    "*.log",
    "*.zip",
    "npm-debug.log*",
    "yarn-debug.log*",
    "yarn-error.log*"
)

Write-Host "Creation d'une copie propre du projet..." -ForegroundColor Cyan

$RoboArgs = @(
    $Project,
    $TempProject,
    "/E",
    "/R:1",
    "/W:1",
    "/COPY:DAT",
    "/DCOPY:DAT",
    "/NFL",
    "/NDL",
    "/NJH",
    "/NJS",
    "/NP",
    "/XD"
) + $ExcludedDirectories + @("/XF") + $ExcludedFiles

& robocopy @RoboArgs | Out-Null
$RoboExitCode = $LASTEXITCODE

if ($RoboExitCode -gt 7) {
    throw "ERREUR : la copie du projet a echoue. Code Robocopy : $RoboExitCode"
}

$StateFile = Join-Path $TempProject "ETAT_AUDIT_OGA.txt"

@"
OMNIA GLOBAL ACADEMY - ETAT DE REPRISE

Version :
Cycle 6 - Lot 2B valide

Validations :
- Build reussi
- Correction CRON_SECRET appliquee
- coaching-cron deploye et teste
- cron-anti-abandon deploye et teste
- Corrections poussees avec GitHub Desktop

Securite :
- Les planifications Cron restent desactivees jusqu'a activation explicite.

Prochaine etape :
Cycle 6 - Lot 2C
- Remboursements
- Reprise ou annulation des commissions
- Recuperation des gains Coaching
- Recuperation des gains Omnia Live
- Verification des tables financieres reelles dans Supabase

Regle de reference :
Ce ZIP devient la version de reference pour poursuivre l'audit.
"@ | Set-Content -Path $StateFile -Encoding UTF8

if (Test-Path $ZipPath) {
    Remove-Item $ZipPath -Force
}

Write-Host "Compression du projet..." -ForegroundColor Cyan
Compress-Archive `
    -Path (Join-Path $TempProject "*") `
    -DestinationPath $ZipPath `
    -CompressionLevel Optimal `
    -Force

if (-not (Test-Path $ZipPath)) {
    throw "ERREUR : le ZIP n'a pas ete cree."
}

$ZipSizeMB = [Math]::Round((Get-Item $ZipPath).Length / 1MB, 2)

Remove-Item $TempRoot -Recurse -Force

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " ZIP CREE AVEC SUCCES" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Nom exact du fichier :" -ForegroundColor Yellow
Write-Host $ZipName
Write-Host ""
Write-Host "Emplacement :" -ForegroundColor Yellow
Write-Host $ZipPath
Write-Host ""
Write-Host "Taille : $ZipSizeMB MB"
Write-Host ""
Write-Host "Envoyez maintenant ce ZIP dans le chat." -ForegroundColor Cyan

Set-Clipboard -Value $ZipPath
Write-Host "Le chemin complet a ete copie dans le presse-papiers." -ForegroundColor DarkGray
