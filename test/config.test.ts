import test from "node:test";
import assert from "node:assert/strict";

import { loadTelegramConfig } from "../src/config.js";

test("loads Telegram configuration", () => {
  const config = loadTelegramConfig({
    TELEGRAM_BOT_TOKEN: "test-token",
    TELEGRAM_SANDBOX_CHAT_ID: "-123456"
  });

  assert.equal(config.botToken, "test-token");
  assert.equal(config.sandboxChatId, "-123456");
});

test("requires Telegram bot token", () => {
  assert.throws(
    () =>
      loadTelegramConfig({
        TELEGRAM_SANDBOX_CHAT_ID: "-123456"
      }),
    /Missing required environment variable: TELEGRAM_BOT_TOKEN/
  );
});

test("requires Telegram sandbox chat ID", () => {
  assert.throws(
    () =>
      loadTelegramConfig({
        TELEGRAM_BOT_TOKEN: "test-token"
      }),
    /Missing required environment variable: TELEGRAM_SANDBOX_CHAT_ID/
  );
});