import test from "node:test";
import assert from "node:assert/strict";

import { loadTelegramConfig } from "../src/config.js";

test("loads Telegram bot token", () => {
  const config = loadTelegramConfig({
    TELEGRAM_BOT_TOKEN: "test-token"
  });

  assert.equal(config.botToken, "test-token");
});

test("requires Telegram bot token", () => {
  assert.throws(
    () => loadTelegramConfig({}),
    /Missing required environment variable: TELEGRAM_BOT_TOKEN/
  );
});