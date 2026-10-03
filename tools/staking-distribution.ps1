param(
    [string]$RestUrl = "https://api.axone-mainnet.aknodes.net",
    [string]$NetworkName = "Axone mainnet"
)
# Computes an aggregate staking distribution without printing or storing
# delegator addresses.
#
# Only delegations to validators currently in BOND_STATUS_BONDED are counted.
# Unbonding delegations and delegations to UNBONDED/UNBONDING validators are
# outside the active_stake definition used by the Community Zone.

$ErrorActionPreference = "Stop"

function Invoke-AxoneJson {
    param(
        [string]$Uri
    )

    $maxAttempts = 3

    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        try {
            return Invoke-RestMethod -Uri $Uri -Method Get
        }
        catch {
            if ($attempt -eq $maxAttempts) {
                throw
            }

            Start-Sleep -Seconds $attempt
        }
    }
}

Write-Host "Reading $NetworkName accounts..."

$accountsResponse = Invoke-AxoneJson `
    "$RestUrl/cosmos/auth/v1beta1/accounts?pagination.limit=1&pagination.count_total=true"

$totalAccounts = [int64]$accountsResponse.pagination.total

Write-Host "Accounts in x/auth: $totalAccounts"
Write-Host ""
Write-Host "Reading validators..."

$validatorStatuses = @(
    "BOND_STATUS_BONDED"
)

$validators = [System.Collections.Generic.HashSet[string]]::new()

foreach ($status in $validatorStatuses) {
    $nextKey = $null

    do {
        $uri =
            "$RestUrl/cosmos/staking/v1beta1/validators" +
            "?status=$status" +
            "&pagination.limit=200"

        if (-not [string]::IsNullOrWhiteSpace($nextKey)) {
            $encodedKey = [uri]::EscapeDataString($nextKey)
            $uri += "&pagination.key=$encodedKey"
        }

        $page = Invoke-AxoneJson $uri

        foreach ($validator in @($page.validators)) {
            [void]$validators.Add(
                [string]$validator.operator_address
            )
        }

        $nextKey = [string]$page.pagination.next_key
    }
    while (-not [string]::IsNullOrWhiteSpace($nextKey))
}

Write-Host "Validators found: $($validators.Count)"
Write-Host ""
Write-Host "Reading delegations to BONDED validators..."

$delegatorTotals = @{}
$validatorIndex = 0

foreach ($validatorAddress in $validators) {
    $validatorIndex++

    Write-Progress `
        -Activity "Reading Axone delegations" `
        -Status "Validator $validatorIndex / $($validators.Count)" `
        -PercentComplete (($validatorIndex / $validators.Count) * 100)

    $nextKey = $null

    do {
        $uri =
            "$RestUrl/cosmos/staking/v1beta1/validators/" +
            "$validatorAddress/delegations" +
            "?pagination.limit=1000"

        if (-not [string]::IsNullOrWhiteSpace($nextKey)) {
            $encodedKey = [uri]::EscapeDataString($nextKey)
            $uri += "&pagination.key=$encodedKey"
        }

        $page = Invoke-AxoneJson $uri

        foreach ($item in @($page.delegation_responses)) {
            if ($item.balance.denom -ne "uaxone") {
                continue
            }

            $delegator =
                [string]$item.delegation.delegator_address

            $amount =
                [System.Numerics.BigInteger]::Parse(
                    [string]$item.balance.amount
                )

            if ($amount -le 0) {
                continue
            }

            if ($delegatorTotals.ContainsKey($delegator)) {
                $delegatorTotals[$delegator] =
                    [System.Numerics.BigInteger]$delegatorTotals[$delegator] +
                    $amount
            }
            else {
                $delegatorTotals[$delegator] = $amount
            }
        }

        $nextKey = [string]$page.pagination.next_key
    }
    while (-not [string]::IsNullOrWhiteSpace($nextKey))
}

Write-Progress -Activity "Reading Axone delegations" -Completed

$activeStakers = $delegatorTotals.Count

Write-Host ""
Write-Host "Unique addresses delegated to BONDED validators: $activeStakers"
Write-Host ""

$thresholds = @(
    1,
    100,
    1000,
    10000,
    100000,
    1000000,
    10000000
)

$uaxonePerAxone =
    [System.Numerics.BigInteger]::Parse("1000000")

$results = foreach ($threshold in $thresholds) {

    $thresholdUaxone =
        [System.Numerics.BigInteger]::Parse(
            $threshold.ToString()
        ) * $uaxonePerAxone

    $count = 0

    foreach ($amount in $delegatorTotals.Values) {
        if (
            [System.Numerics.BigInteger]$amount -ge
            $thresholdUaxone
        ) {
            $count++
        }
    }

    $pctAccounts =
        if ($totalAccounts -gt 0) {
            [math]::Round(
                ($count / $totalAccounts) * 100,
                2
            )
        }
        else {
            0
        }

    $pctStakers =
        if ($activeStakers -gt 0) {
            [math]::Round(
                ($count / $activeStakers) * 100,
                2
            )
        }
        else {
            0
        }

    [PSCustomObject]@{
        "Minimum AXONE" = $threshold.ToString("N0")
        "Addresses" = $count
        "% all accounts" = $pctAccounts
        "% active stakers" = $pctStakers
    }
}

Write-Host "Axone staking distribution"
Write-Host "=========================="
Write-Host ""

$results | Format-Table -AutoSize