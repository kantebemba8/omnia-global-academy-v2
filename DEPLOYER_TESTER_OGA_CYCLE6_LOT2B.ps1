# OGA - Cycle 6 - Lot 2B
# Deploiement et tests controles de coaching-cron et cron-anti-abandon.
# A executer depuis la racine du projet dans le terminal PowerShell de VS Code.

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Project = (Get-Location).Path
$Desktop = [Environment]::GetFolderPath("Desktop")
$ReportPath = Join-Path $Desktop "OGA_RESULTAT_CYCLE6_LOT2B.txt"
$TempEnvFile = $null
$ReportLines = New-Object System.Collections.Generic.List[string]

function Add-Report {
    param([string]$Text = "")
    $ReportLines.Add($Text)
}

function Save-Report {
    $encoding = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $true
    [System.IO.File]::WriteAllLines($ReportPath, $ReportLines.ToArray(), $encoding)
}

function Write-Step {
    param([string]$Text)
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " $Text" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    Add-Report ""
    Add-Report "=== $Text ==="
}

function Invoke-SupabaseCli {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [switch]$AllowFailure
    )

    $display = "npx --yes supabase@latest " + ($Arguments -join " ")
    Write-Host "> $display" -ForegroundColor DarkGray

    $output = & npx --yes supabase@latest @Arguments 2>&1
    $exitCode = $LASTEXITCODE

    foreach ($line in $output) {
        Write-Host $line
    }

    if ($exitCode -ne 0 -and -not $AllowFailure) {
        throw "La commande Supabase a echoue : $($Arguments -join ' ')"
    }

    return [PSCustomObject]@{
        ExitCode = $exitCode
        Output = ($output | Out-String).Trim()
    }
}

function New-CronSecret {
    $bytes = New-Object byte[] 48
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    }
    finally {
        $generator.Dispose()
    }

    return ([Convert]::ToBase64String($bytes)).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Invoke-CronFunction {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRef,
        [Parameter(Mandatory = $true)]
        [string]$FunctionName,
        [Parameter(Mandatory = $true)]
        [string]$Secret,
        [Parameter(Mandatory = $true)]
        [bool]$Forced
    )

    Add-Type -AssemblyName System.Net.Http

    $url = "https://$ProjectRef.supabase.co/functions/v1/$FunctionName"
    $client = New-Object System.Net.Http.HttpClient

    try {
        $request = New-Object -TypeName System.Net.Http.HttpRequestMessage -ArgumentList @([System.Net.Http.HttpMethod]::Post, $url)
        $request.Headers.Add("x-cron-secret", $Secret)
        if ($Forced) {
            $request.Headers.Add("x-cron-force", "true")
        }
        $request.Content = New-Object -TypeName System.Net.Http.StringContent -ArgumentList @("{}", [System.Text.Encoding]::UTF8, "application/json")

        $response = $client.SendAsync($request).GetAwaiter().GetResult()
        $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        $statusCode = [int]$response.StatusCode

        $jsonBody = $null
        try {
            if (-not [string]::IsNullOrWhiteSpace($body)) {
                $jsonBody = $body | ConvertFrom-Json
            }
        }
        catch {
            $jsonBody = $null
        }

        return [PSCustomObject]@{
            StatusCode = $statusCode
            Body = $body
            Json = $jsonBody
        }
    }
    finally {
        $client.Dispose()
    }
}

function Assert-SafeDisabledResponse {
    param(
        [string]$FunctionName,
        [object]$Result
    )

    Add-Report "$FunctionName - test sans force - HTTP $($Result.StatusCode)"
    Add-Report $Result.Body

    $isSkipped = $false
    $reason = ""
    if ($null -ne $Result.Json) {
        if ($null -ne $Result.Json.PSObject.Properties["skipped"]) {
            $isSkipped = [bool]$Result.Json.skipped
        }
        if ($null -ne $Result.Json.PSObject.Properties["reason"]) {
            $reason = [string]$Result.Json.reason
        }
    }

    if ($Result.StatusCode -ne 202 -or -not $isSkipped -or $reason -ne "JOB_DISABLED") {
        Write-Host ""
        Write-Host "REPONSE INATTENDUE POUR $FunctionName" -ForegroundColor Red
        Write-Host "HTTP $($Result.StatusCode)" -ForegroundColor Red
        Write-Host $Result.Body
        throw "Le job $FunctionName n'est pas confirme comme desactive. Aucun test force ne sera lance."
    }

    Write-Host "$FunctionName : authentification valide et job desactive." -ForegroundColor Green
}

function Assert-ForcedResponse {
    param(
        [string]$FunctionName,
        [object]$Result
    )

    Add-Report "$FunctionName - test force - HTTP $($Result.StatusCode)"
    Add-Report $Result.Body

    $success = $false
    if ($null -ne $Result.Json -and $null -ne $Result.Json.PSObject.Properties["success"]) {
        $success = [bool]$Result.Json.success
    }

    if ($Result.StatusCode -ne 200 -or -not $success) {
        Write-Host ""
        Write-Host "ECHEC DU TEST FORCE : $FunctionName" -ForegroundColor Red
        Write-Host "HTTP $($Result.StatusCode)" -ForegroundColor Red
        Write-Host $Result.Body
        throw "Le test force de $FunctionName a echoue."
    }

    Write-Host "$FunctionName : test force reussi." -ForegroundColor Green
    Write-Host $Result.Body
}

try {
    Add-Report "OGA - Cycle 6 - Lot 2B"
    Add-Report "Date : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Add-Report "Projet local : $Project"

    Write-Step "1. Verification du projet local"

    if (-not (Test-Path (Join-Path $Project "package.json"))) {
        throw "package.json est introuvable. Ouvrez la racine du depot Omnia dans VS Code."
    }

    $RequiredFiles = @(
        "supabase\functions\_shared\cron-control.ts",
        "supabase\functions\coaching-cron\index.ts",
        "supabase\functions\cron-anti-abandon\index.ts",
        "supabase\migrations\20260730233000_123_cycle6_payout_cron_control.sql",
        "supabase\config.toml"
    )

    foreach ($relativePath in $RequiredFiles) {
        $fullPath = Join-Path $Project $relativePath
        if (-not (Test-Path $fullPath)) {
            throw "Fichier obligatoire introuvable : $relativePath"
        }
        Write-Host "Present : $relativePath" -ForegroundColor Green
    }

    $sharedContent = Get-Content (Join-Path $Project "supabase\functions\_shared\cron-control.ts") -Raw
    $coachingContent = Get-Content (Join-Path $Project "supabase\functions\coaching-cron\index.ts") -Raw
    $antiContent = Get-Content (Join-Path $Project "supabase\functions\cron-anti-abandon\index.ts") -Raw
    $configContent = Get-Content (Join-Path $Project "supabase\config.toml") -Raw

    if ($sharedContent -notmatch "normalizeCronSecret") {
        throw "La correction normalizeCronSecret est absente de cron-control.ts."
    }
    if ($coachingContent -notmatch "normalizeCronSecret") {
        throw "coaching-cron n'utilise pas normalizeCronSecret."
    }
    if ($antiContent -notmatch "normalizeCronSecret") {
        throw "cron-anti-abandon n'utilise pas normalizeCronSecret."
    }
    if ($configContent -notmatch "(?ms)\[functions\.coaching-cron\]\s*verify_jwt\s*=\s*false") {
        throw "verify_jwt=false est absent pour coaching-cron dans supabase/config.toml."
    }
    if ($configContent -notmatch "(?ms)\[functions\.cron-anti-abandon\]\s*verify_jwt\s*=\s*false") {
        throw "verify_jwt=false est absent pour cron-anti-abandon dans supabase/config.toml."
    }

    Write-Host "Correction locale validee." -ForegroundColor Green
    Add-Report "Verification locale : OK"

    Write-Step "2. Verification de la connexion Supabase"

    $projectsCheck = Invoke-SupabaseCli -Arguments @("projects", "list") -AllowFailure
    if ($projectsCheck.ExitCode -ne 0) {
        Write-Host "Connexion Supabase requise." -ForegroundColor Yellow
        Invoke-SupabaseCli -Arguments @("login") | Out-Null
        Invoke-SupabaseCli -Arguments @("projects", "list") | Out-Null
    }

    $ProjectRef = ""
    $linkedRefPath = Join-Path $Project "supabase\.temp\project-ref"
    if (Test-Path $linkedRefPath) {
        $ProjectRef = (Get-Content $linkedRefPath -Raw).Trim()
    }

    if ([string]::IsNullOrWhiteSpace($ProjectRef)) {
        Write-Host ""
        Write-Host "Copiez le PROJECT ID affiche dans la liste Supabase." -ForegroundColor Yellow
        $ProjectRef = (Read-Host "PROJECT ID").Trim()
    }
    else {
        Write-Host "Projet Supabase deja lie : $ProjectRef" -ForegroundColor Green
    }

    if ($ProjectRef -notmatch "^[a-z0-9]+$") {
        throw "PROJECT ID invalide."
    }

    Invoke-SupabaseCli -Arguments @("link", "--project-ref", $ProjectRef) | Out-Null
    Add-Report "Project ref : $ProjectRef"

    Write-Step "3. Rotation securisee des secrets Cron"

    $CronSecret = New-CronSecret
    if ($CronSecret -notmatch "^[A-Za-z0-9_-]+$") {
        throw "Le secret genere contient un caractere non autorise."
    }

    $TempEnvFile = Join-Path $env:TEMP ("oga-cron-secrets-" + [Guid]::NewGuid().ToString("N") + ".env")
    $envContent = "CRON_SECRET=$CronSecret`r`nCOACHING_CRON_SECRET=$CronSecret`r`n"
    $utf8NoBom = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
    [System.IO.File]::WriteAllText($TempEnvFile, $envContent, $utf8NoBom)

    Invoke-SupabaseCli -Arguments @("secrets", "set", "--env-file", $TempEnvFile, "--project-ref", $ProjectRef) | Out-Null
    Remove-Item $TempEnvFile -Force
    $TempEnvFile = $null

    Write-Host "CRON_SECRET et COACHING_CRON_SECRET ont ete remplaces." -ForegroundColor Green
    Write-Host "La valeur n'est ni affichee ni enregistree dans le projet." -ForegroundColor DarkGray
    Add-Report "Rotation des secrets : OK"
    Start-Sleep -Seconds 3

    Write-Step "4. Deploiement des deux Edge Functions"

    Invoke-SupabaseCli -Arguments @(
        "functions", "deploy", "coaching-cron",
        "--project-ref", $ProjectRef,
        "--no-verify-jwt",
        "--use-api"
    ) | Out-Null

    Invoke-SupabaseCli -Arguments @(
        "functions", "deploy", "cron-anti-abandon",
        "--project-ref", $ProjectRef,
        "--no-verify-jwt",
        "--use-api"
    ) | Out-Null

    Write-Host "Les deux fonctions ont ete deployees." -ForegroundColor Green
    Add-Report "Deploiement coaching-cron : OK"
    Add-Report "Deploiement cron-anti-abandon : OK"
    Start-Sleep -Seconds 5

    Write-Step "5. Controle sans execution des traitements"

    Write-Host "Ce controle doit renvoyer JOB_DISABLED pour chaque fonction." -ForegroundColor Yellow
    Write-Host "Si une fonction est activee, le script s'arrete avant les tests forces." -ForegroundColor Yellow
    Write-Host ""
    $disabledConfirmation = (Read-Host "Confirmez que les planifications Cron sont desactivees en tapant DESACTIVEES").Trim()
    if ($disabledConfirmation -ne "DESACTIVEES") {
        throw "Confirmation non recue. Les fonctions sont deployees, mais aucun appel de test n'a ete effectue."
    }

    $safeCoaching = Invoke-CronFunction -ProjectRef $ProjectRef -FunctionName "coaching-cron" -Secret $CronSecret -Forced $false
    Assert-SafeDisabledResponse -FunctionName "coaching-cron" -Result $safeCoaching

    $safeAnti = Invoke-CronFunction -ProjectRef $ProjectRef -FunctionName "cron-anti-abandon" -Secret $CronSecret -Forced $false
    Assert-SafeDisabledResponse -FunctionName "cron-anti-abandon" -Result $safeAnti

    Write-Step "6. Tests forces du Lot 2B"

    Write-Host "ATTENTION : ces tests executent les traitements reels arrives a echeance." -ForegroundColor Yellow
    Write-Host "coaching-cron peut expirer des reservations, cloturer des sessions et liberer des gains." -ForegroundColor Yellow
    Write-Host "cron-anti-abandon peut envoyer des notifications aux apprenants inactifs." -ForegroundColor Yellow
    Write-Host ""
    $forceConfirmation = (Read-Host "Pour continuer, tapez exactement EXECUTER").Trim()

    if ($forceConfirmation -ne "EXECUTER") {
        Add-Report "Tests forces : NON EXECUTES PAR CHOIX DE L'UTILISATEUR"
        Save-Report
        Write-Host ""
        Write-Host "Deploiement valide et controles sans force reussis." -ForegroundColor Green
        Write-Host "Les tests forces n'ont pas ete lances." -ForegroundColor Yellow
        Write-Host "Rapport : $ReportPath" -ForegroundColor Cyan
        exit 0
    }

    $forcedCoaching = Invoke-CronFunction -ProjectRef $ProjectRef -FunctionName "coaching-cron" -Secret $CronSecret -Forced $true
    Assert-ForcedResponse -FunctionName "coaching-cron" -Result $forcedCoaching

    $forcedAnti = Invoke-CronFunction -ProjectRef $ProjectRef -FunctionName "cron-anti-abandon" -Secret $CronSecret -Forced $true
    Assert-ForcedResponse -FunctionName "cron-anti-abandon" -Result $forcedAnti

    Add-Report "RESULTAT FINAL : DEPLOIEMENT ET TESTS FORCES REUSSIS"
    Add-Report "Les controles oga_cron_controls restent desactives."
    Add-Report "Aucune planification n'a ete activee par ce script."
    Save-Report

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host " CYCLE 6 - LOT 2B : DEPLOIEMENT ET TESTS REUSSIS" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Aucune planification Cron n'a ete activee." -ForegroundColor Yellow
    Write-Host "Rapport cree sur le Bureau :" -ForegroundColor Cyan
    Write-Host $ReportPath -ForegroundColor Cyan
}
catch {
    $message = $_.Exception.Message
    Add-Report ""
    Add-Report "RESULTAT FINAL : ECHEC"
    Add-Report $message
    Save-Report

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host " ECHEC DU CYCLE 6 - LOT 2B" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host $message -ForegroundColor Red
    Write-Host ""
    Write-Host "Rapport cree sur le Bureau :" -ForegroundColor Yellow
    Write-Host $ReportPath -ForegroundColor Yellow
    exit 1
}
finally {
    if ($null -ne $TempEnvFile -and (Test-Path $TempEnvFile)) {
        Remove-Item $TempEnvFile -Force -ErrorAction SilentlyContinue
    }
}
