export interface AppConfig {
  restUrl: string;
  minStakeUaxone: bigint;
  pageLimit: number;
}

export interface TelegramConfig {
  botToken: string;
  sandboxChatId: string;
}

function requiredEnvFrom(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requiredEnv(name: string): string {
  return requiredEnvFrom(process.env, name);
}

function parsePositiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseNonNegativeBigInt(value: string, name: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a non-negative integer string`);
  }
  return BigInt(value);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const restUrlRaw = env.AXONE_REST_URL?.trim();
  if (!restUrlRaw) {
    throw new Error("Missing required environment variable: AXONE_REST_URL");
  }

  let restUrl: URL;
  try {
    restUrl = new URL(restUrlRaw);
  } catch {
    throw new Error("AXONE_REST_URL must be a valid URL");
  }

  const minStake = env.AXONE_MIN_STAKE_UAXONE?.trim() ?? "0";
  const pageLimitRaw = env.AXONE_STAKING_PAGE_LIMIT?.trim() ?? "100";

  return {
    restUrl: restUrl.toString().replace(/\/$/, ""),
    minStakeUaxone: parseNonNegativeBigInt(
      minStake,
      "AXONE_MIN_STAKE_UAXONE"
    ),
    pageLimit: parsePositiveInteger(
      pageLimitRaw,
      "AXONE_STAKING_PAGE_LIMIT"
    )
  };
}

export function loadTelegramConfig(
  env: NodeJS.ProcessEnv = process.env
): TelegramConfig {
  return {
    botToken: requiredEnvFrom(env, "TELEGRAM_BOT_TOKEN"),
    sandboxChatId: requiredEnvFrom(env, "TELEGRAM_SANDBOX_CHAT_ID")
  };
}

export { requiredEnv };