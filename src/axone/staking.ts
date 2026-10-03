export interface DelegationBalance {
  delegation?: {
    delegator_address?: string;
    validator_address?: string;
  };
  balance?: {
    denom?: string;
    amount?: string;
  };
}

export interface DelegationResponse {
  delegation_responses?: DelegationBalance[];
  pagination?: {
    next_key?: string | null;
    total?: string;
  };
}

export interface Validator {
  operator_address?: string;
}

export interface ValidatorsResponse {
  validators?: Validator[];
  pagination?: {
    next_key?: string | null;
    total?: string;
  };
}

export interface ActiveDelegationSummary {
  address: string;
  totalUaxone: bigint;
  delegationCount: number;
}

export type FetchLike = typeof fetch;

export function isPlausibleAxoneAddress(address: string): boolean {
  return /^axone1[0-9a-z]{20,80}$/.test(address);
}

function parseAmount(amount: string | undefined): bigint {
  if (!amount || !/^\d+$/.test(amount)) {
    throw new Error(`Invalid delegation amount: ${amount ?? "<missing>"}`);
  }
  return BigInt(amount);
}

async function fetchBondedValidatorAddresses(
  restUrl: string,
  pageLimit: number,
  fetchImpl: FetchLike
): Promise<Set<string>> {
  const bondedValidators = new Set<string>();
  let nextKey: string | undefined;

  do {
    const url = new URL(
      "/cosmos/staking/v1beta1/validators",
      restUrl
    );

    url.searchParams.set("status", "BOND_STATUS_BONDED");
    url.searchParams.set("pagination.limit", String(pageLimit));

    if (nextKey) {
      url.searchParams.set("pagination.key", nextKey);
    }

    const response = await fetchImpl(url);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Axone REST request failed: ${response.status} ${response.statusText}${body ? ` - ${body}` : ""}`
      );
    }

    const payload = (await response.json()) as ValidatorsResponse;

    for (const validator of payload.validators ?? []) {
      if (validator.operator_address) {
        bondedValidators.add(validator.operator_address);
      }
    }

    nextKey = payload.pagination?.next_key || undefined;
  } while (nextKey);

  return bondedValidators;
}

export async function fetchActiveDelegations(
  restUrl: string,
  address: string,
  pageLimit = 100,
  fetchImpl: FetchLike = fetch
): Promise<ActiveDelegationSummary> {
  if (!isPlausibleAxoneAddress(address)) {
    throw new Error("Address does not look like an Axone bech32 address");
  }

  const bondedValidators = await fetchBondedValidatorAddresses(
    restUrl,
    pageLimit,
    fetchImpl
  );

  let nextKey: string | undefined;
  let totalUaxone = 0n;
  let delegationCount = 0;

  do {
    const url = new URL(
      `/cosmos/staking/v1beta1/delegations/${encodeURIComponent(address)}`,
      restUrl
    );

    url.searchParams.set("pagination.limit", String(pageLimit));

    if (nextKey) {
      url.searchParams.set("pagination.key", nextKey);
    }

    const response = await fetchImpl(url);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Axone REST request failed: ${response.status} ${response.statusText}${body ? ` - ${body}` : ""}`
      );
    }

    const payload = (await response.json()) as DelegationResponse;
    const delegations = payload.delegation_responses ?? [];

    for (const item of delegations) {
      const validatorAddress = item.delegation?.validator_address;

      if (
        !validatorAddress ||
        !bondedValidators.has(validatorAddress)
      ) {
        continue;
      }

      const denom = item.balance?.denom;

      if (denom !== "uaxone") {
        continue;
      }

      totalUaxone += parseAmount(item.balance?.amount);
      delegationCount += 1;
    }

    nextKey = payload.pagination?.next_key || undefined;
  } while (nextKey);

  return {
    address,
    totalUaxone,
    delegationCount
  };
}
