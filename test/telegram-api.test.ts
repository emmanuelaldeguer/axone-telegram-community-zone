import test from "node:test";
import assert from "node:assert/strict";

import {
  getTelegramUpdates,
  sendTelegramMessage
} from "../src/telegram/api.js";

test("gets Telegram updates", async () => {
  const calls: Array<{
    url: string;
    body: Record<string, unknown>;
  }> = [];

  const fakeFetch: typeof fetch = async (input, init) => {
    calls.push({
      url: String(input),
      body: JSON.parse(String(init?.body))
    });

    return new Response(
      JSON.stringify({
        ok: true,
        result: [
          {
            update_id: 100,
            message: {
              message_id: 1,
              chat: {
                id: -123,
                type: "group"
              },
              text: "/start"
            }
          }
        ]
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      }
    );
  };

  const updates = await getTelegramUpdates(
    "test-token",
    99,
    fakeFetch
  );

  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.update_id, 100);

  assert.equal(
    calls[0]?.url,
    "https://api.telegram.org/bottest-token/getUpdates"
  );

  assert.equal(calls[0]?.body.offset, 99);
});

test("sends Telegram message", async () => {
  const calls: Array<{
    url: string;
    body: Record<string, unknown>;
  }> = [];

  const fakeFetch: typeof fetch = async (input, init) => {
    calls.push({
      url: String(input),
      body: JSON.parse(String(init?.body))
    });

    return new Response(
      JSON.stringify({
        ok: true,
        result: {
          message_id: 2
        }
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      }
    );
  };

  await sendTelegramMessage(
    "test-token",
    "-123",
    "Hello Axone",
    fakeFetch
  );

  assert.equal(
    calls[0]?.url,
    "https://api.telegram.org/bottest-token/sendMessage"
  );

  assert.deepEqual(calls[0]?.body, {
    chat_id: "-123",
    text: "Hello Axone"
  });
});

test("rejects Telegram API errors", async () => {
  const fakeFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        ok: false,
        description: "Bad Request"
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      }
    );
  };

  await assert.rejects(
    () => getTelegramUpdates("test-token", undefined, fakeFetch),
    /Telegram API error: Bad Request/
  );
});