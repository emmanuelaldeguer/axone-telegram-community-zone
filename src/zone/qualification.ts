export type QualificationStatus = "eligible" | "read_only";

export interface Qualification {
  status: QualificationStatus;
  totalUaxone: bigint;
  thresholdUaxone: bigint;
  deficitUaxone: bigint;
}

export function qualifyByStake(
  totalUaxone: bigint,
  thresholdUaxone: bigint
): Qualification {
  if (thresholdUaxone < 0n) {
    throw new Error("Threshold cannot be negative");
  }

  const eligible = totalUaxone >= thresholdUaxone;
  return {
    status: eligible ? "eligible" : "read_only",
    totalUaxone,
    thresholdUaxone,
    deficitUaxone: eligible ? 0n : thresholdUaxone - totalUaxone
  };
}
