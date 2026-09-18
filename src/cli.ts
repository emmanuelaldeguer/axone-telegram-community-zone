import { loadConfig } from "./config.js";
import { fetchActiveDelegations } from "./axone/staking.js";
import { qualifyByStake } from "./zone/qualification.js";

function usage(): void {
  console.error("Usage: npm run stake -- axone1...");
  process.exit(2);
}

async function main(): Promise<void> {
  const address = process.argv[2];
  if (!address) {
    usage();
    return;
  }

  const config = loadConfig();
  const staking = await fetchActiveDelegations(
    config.restUrl,
    address,
    config.pageLimit
  );
  const qualification = qualifyByStake(
    staking.totalUaxone,
    config.minStakeUaxone
  );

  console.log(
    JSON.stringify(
      {
        address: staking.address,
        activeDelegations: staking.delegationCount,
        totalUaxone: staking.totalUaxone.toString(),
        thresholdUaxone: qualification.thresholdUaxone.toString(),
        deficitUaxone: qualification.deficitUaxone.toString(),
        status: qualification.status
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
