import test from "node:test";
import assert from "node:assert/strict";

import {
  handleTelegramUpdate,
  type TelegramUpdate
} from "../src/telegram/handler.js";

const sandboxChatId = "-5445609275";

function update(
  chatId: number,
  text?: string
): TelegramUpdate {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      chat: {
        id: chatId,
        type: "group",
        title: "Axone Community Zone Sandbox"
      },
      from: {
        id: 123
      },
      text
    }
  };
}

test("responds to /start in sandbox group", () => {
  const result = handleTelegramUpdate(
    update(-5445609275, "/start"),
    sandboxChatId
  );

  assert.ok(result);
  assert.equal(result.chatId, sandboxChatId);
  assert.match(result.text, /read-only mode/);
});

test("responds to addressed /start command in sandbox group", () => {
  const result = handleTelegramUpdate(
    update(-5445609275, "/start@AxoneZoneSandboxBot"),
    sandboxChatId
  );

  assert.ok(result);
});

test("starts privacy-preserving verification without wallet address", () => {
  const result = handleTelegramUpdate(
    update(-5445609275, "/verify"),
    sandboxChatId
  );

  assert.ok(result);
  assert.match(result.text, /Privacy-preserving verification/);
  assert.match(result.text, /without exposing your Axone wallet address/);
});

test("rejects wallet address supplied through Telegram", () => {
  const result = handleTelegramUpdate(
    update(
      -5445609275,
      "/verify axone18e6a52ld4mvq9qurj2k3hc2am92al4jmep2e5j"
    ),
    sandboxChatId
  );

  assert.ok(result);
  assert.match(
    result.text,
    /Do not send an Axone wallet address through Telegram/
  );
});

test("ignores commands from another Telegram group", () => {
  const result = handleTelegramUpdate(
    update(-123456789, "/start"),
    sandboxChatId
  );

  assert.equal(result, null);
});

test("ignores unsupported commands", () => {
  const result = handleTelegramUpdate(
    update(-5445609275, "/somethingelse"),
    sandboxChatId
  );

  assert.equal(result, null);
});

test("ignores Telegram service messages without text", () => {
  const result = handleTelegramUpdate(
    update(-5445609275),
    sandboxChatId
  );

  assert.equal(result, null);
});