$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " OGA - AUDIT SCHEMA FINANCE - CYCLE 6 LOT 2C" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$Project = (Get-Location).Path
$ScriptName = "AUDITER_SCHEMA_FINANCE_OGA_CYCLE6_LOT2C.ps1"
$OutputZipName = "OGA_CYCLE6_LOT2C_SCHEMA_FINANCE.zip"

if (-not (Test-Path (Join-Path $Project "package.json"))) {
    throw "ERREUR : package.json est introuvable. Ouvrez le depot Omnia Global Academy dans VS Code."
}

if (-not (Test-Path (Join-Path $Project "supabase"))) {
    throw "ERREUR : le dossier supabase est introuvable."
}

function Get-RealDownloadsPath {
    $candidates = New-Object System.Collections.Generic.List[string]

    foreach ($root in @($env:OneDrive, $env:OneDriveConsumer, $env:OneDriveCommercial)) {
        if ($root) {
            foreach ($name in @("Downloads", "Téléchargements")) {
                $candidate = Join-Path $root $name
                if (Test-Path $candidate) { $candidates.Add((Resolve-Path $candidate).Path) }
            }
        }
    }

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
                if (Test-Path $expanded) { $candidates.Add((Resolve-Path $expanded).Path) }
            }
        }
    }

    foreach ($candidate in @(
        (Join-Path $HOME "OneDrive\Downloads"),
        (Join-Path $HOME "OneDrive\Téléchargements"),
        (Join-Path $HOME "Downloads"),
        (Join-Path $HOME "Téléchargements")
    )) {
        if (Test-Path $candidate) { $candidates.Add((Resolve-Path $candidate).Path) }
    }

    if ($candidates.Count -eq 0) {
        $found = Get-ChildItem -Path $HOME -Directory -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -in @("Downloads", "Téléchargements") } |
            Sort-Object @{ Expression = { if ($_.FullName -match "OneDrive") { 0 } else { 1 } } }, LastWriteTime -Descending |
            Select-Object -First 1
        if ($found) { $candidates.Add($found.FullName) }
    }

    if ($candidates.Count -eq 0) {
        throw "ERREUR : aucun dossier Downloads n'a ete detecte."
    }

    return ($candidates | Select-Object -Unique | Select-Object -First 1)
}

function Invoke-SupabaseCli {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [string]$StandardOutputFile = "",
        [string]$StandardErrorFile = ""
    )

    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    try {
        if ($StandardOutputFile -and $StandardErrorFile) {
            & npx.cmd --yes "supabase@2.107.0" @Arguments 1> $StandardOutputFile 2> $StandardErrorFile
        }
        elseif ($StandardOutputFile) {
            & npx.cmd --yes "supabase@2.107.0" @Arguments 1> $StandardOutputFile
        }
        else {
            & npx.cmd --yes "supabase@2.107.0" @Arguments
        }
        return $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
}

$Downloads = Get-RealDownloadsPath
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$TempRoot = Join-Path $env:TEMP "oga_cycle6_lot2c_schema_$Stamp"
$TypesFile = Join-Path $TempRoot "OGA_CYCLE6_LOT2C_DATABASE_TYPES.ts"
$MigrationsFile = Join-Path $TempRoot "OGA_CYCLE6_LOT2C_MIGRATIONS_REMOTE.txt"
$AuditFile = Join-Path $TempRoot "OGA_CYCLE6_LOT2C_AUDIT_LOCAL.txt"
$ErrorFile = Join-Path $TempRoot "OGA_CYCLE6_LOT2C_CLI_ERRORS.txt"
$ZipPath = Join-Path $Downloads $OutputZipName

if (Test-Path $TempRoot) {
    Remove-Item $TempRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null

Write-Host "Projet :" -ForegroundColor Green
Write-Host $Project
Write-Host ""
Write-Host "Dossier de sortie :" -ForegroundColor Green
Write-Host $Downloads
Write-Host ""

$ProjectRefFileCandidates = @(
    (Join-Path $Project "supabase\.temp\project-ref"),
    (Join-Path $Project ".supabase\project-ref"),
    (Join-Path $Project ".supabase\profile")
)

$Linked = $false
foreach ($candidate in $ProjectRefFileCandidates) {
    if (Test-Path $candidate) {
        $Linked = $true
        break
    }
}

if (-not $Linked) {
    Write-Host "Le projet ne semble pas lie localement a Supabase." -ForegroundColor Yellow
    Write-Host "Liste de vos projets Supabase :" -ForegroundColor Cyan

    $projectsExit = Invoke-SupabaseCli -Arguments @("projects", "list")
    if ($projectsExit -ne 0) {
        Write-Host "Connexion Supabase necessaire..." -ForegroundColor Yellow
        $loginExit = Invoke-SupabaseCli -Arguments @("login")
        if ($loginExit -ne 0) {
            throw "ERREUR : connexion Supabase impossible."
        }
        $projectsExit = Invoke-SupabaseCli -Arguments @("projects", "list")
        if ($projectsExit -ne 0) {
            throw "ERREUR : impossible de lister les projets Supabase."
        }
    }

    $ProjectRef = (Read-Host "Collez le PROJECT ID du projet Omnia Global Academy").Trim()
    if ([string]::IsNullOrWhiteSpace($ProjectRef)) {
        throw "ERREUR : PROJECT ID obligatoire."
    }

    $linkExit = Invoke-SupabaseCli -Arguments @("link", "--project-ref", $ProjectRef)
    if ($linkExit -ne 0) {
        throw "ERREUR : impossible de relier le depot au projet Supabase."
    }
}

Write-Host ""
Write-Host "Generation des types depuis le schema public reel..." -ForegroundColor Cyan

$typesExit = Invoke-SupabaseCli `
    -Arguments @("gen", "types", "typescript", "--linked", "--schema", "public") `
    -StandardOutputFile $TypesFile `
    -StandardErrorFile $ErrorFile

if ($typesExit -ne 0 -or -not (Test-Path $TypesFile) -or (Get-Item $TypesFile).Length -lt 100) {
    $details = if (Test-Path $ErrorFile) { Get-Content $ErrorFile -Raw } else { "" }
    throw "ERREUR : generation des types Supabase impossible.`n$details"
}

Write-Host "Types Supabase generes." -ForegroundColor Green
Write-Host ""
Write-Host "Lecture de l'historique des migrations distantes..." -ForegroundColor Cyan

$migrationsErrorFile = Join-Path $TempRoot "OGA_CYCLE6_LOT2C_MIGRATIONS_ERRORS.txt"
$migrationsExit = Invoke-SupabaseCli `
    -Arguments @("migration", "list", "--linked") `
    -StandardOutputFile $MigrationsFile `
    -StandardErrorFile $migrationsErrorFile

if ($migrationsExit -ne 0) {
    @"
La commande de liste des migrations n'a pas abouti.
La generation des types du schema reel a toutefois reussi.

Diagnostic CLI :
$(if (Test-Path $migrationsErrorFile) { Get-Content $migrationsErrorFile -Raw } else { "Aucun detail disponible." })
"@ | Set-Content -Path $MigrationsFile -Encoding UTF8
}

$RequiredTables = @(
    "coaching_payment_orders",
    "coaching_refund_requests",
    "coaching_earnings",
    "coaching_advanced_earnings",
    "wallets",
    "wallet_transactions",
    "payout_requests",
    "live_orders",
    "live_refund_requests",
    "live_organizer_ledger",
    "live_payout_requests",
    "commerce_orders",
    "commerce_creator_balances",
    "commerce_creator_ledger",
    "commerce_payout_requests"
)

$TypesContent = Get-Content $TypesFile -Raw
$PresenceLines = foreach ($table in $RequiredTables) {
    $present = $TypesContent -match "(?m)^\s{6}$([regex]::Escape($table)):\s*\{"
    "- $table : " + $(if ($present) { "PRESENTE" } else { "ABSENTE" })
}

$LocalMigrationChecks = foreach ($table in @(
    "coaching_payment_orders",
    "coaching_refund_requests",
    "coaching_earnings",
    "coaching_advanced_earnings"
)) {
    $match = Get-ChildItem (Join-Path $Project "supabase\migrations") -Filter "*.sql" -File |
        Select-String -Pattern "create\s+table.*public\.$table" -CaseSensitive:$false |
        Select-Object -First 1

    "- migration locale de creation $table : " + $(if ($match) { "TROUVEE dans $($match.Path)" } else { "NON TROUVEE" })
}

@"
OMNIA GLOBAL ACADEMY
AUDIT PREPARATOIRE - CYCLE 6 LOT 2C

Date :
$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Projet local :
$Project

Objectif :
Verifier les tables financieres reelles avant toute correction des remboursements,
commissions et recuperations de gains Coaching / Omnia Live.

Tables detectees dans le schema public distant :
$($PresenceLines -join "`r`n")

Verification des migrations locales Coaching :
$($LocalMigrationChecks -join "`r`n")

Constats locaux deja confirmes :
- Le traitement d'un remboursement Coaching met a jour la demande, la commande et la session.
- Le code local ne montre pas de reprise explicite des gains Coaching deja credites lors de ce traitement.
- Omnia Live contient plusieurs circuits de retraits et de lots de paiement.
- La correction definitive doit utiliser les colonnes et fonctions reellement presentes dans Supabase.
- Aucune donnee utilisateur n'a ete exportee par ce script.

Fichiers joints :
- OGA_CYCLE6_LOT2C_DATABASE_TYPES.ts
- OGA_CYCLE6_LOT2C_MIGRATIONS_REMOTE.txt
"@ | Set-Content -Path $AuditFile -Encoding UTF8

Remove-Item $ErrorFile -Force -ErrorAction SilentlyContinue
Remove-Item $migrationsErrorFile -Force -ErrorAction SilentlyContinue

if (Test-Path $ZipPath) {
    Remove-Item $ZipPath -Force
}

Compress-Archive -Path (Join-Path $TempRoot "*") -DestinationPath $ZipPath -CompressionLevel Optimal -Force

if (-not (Test-Path $ZipPath)) {
    throw "ERREUR : le rapport ZIP n'a pas ete cree."
}

$SizeKb = [Math]::Round((Get-Item $ZipPath).Length / 1KB, 2)

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " AUDIT DU SCHEMA TERMINE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Fichier exact a envoyer dans le chat :" -ForegroundColor Yellow
Write-Host $OutputZipName
Write-Host ""
Write-Host "Emplacement :" -ForegroundColor Yellow
Write-Host $ZipPath
Write-Host ""
Write-Host "Taille : $SizeKb Ko"
Write-Host ""
Write-Host "Aucune donnee personnelle n'a ete exportee." -ForegroundColor Green

Set-Clipboard -Value $ZipPath
