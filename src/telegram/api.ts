import type { TelegramUpdate } from "./handler.js";

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

type FetchFn = typeof fetch;

async function telegramRequest<T>(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
  fetchFn: FetchFn
): Promise<T> {
  const response = await fetchFn(
    `https://api.telegram.org/bot${botToken}/${method}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    throw new Error(
      `Telegram HTTP error: ${response.status} ${response.statusText}`
    );
  }

  const payload = (await response.json()) as TelegramApiResponse<T>;

  if (!payload.ok || payload.result === undefined) {
    throw new Error(
      `Telegram API error: ${payload.description ?? "unknown error"}`
    );
  }

  return payload.result;
}

export async function getTelegramUpdates(
  botToken: string,
  offset?: number,
  fetchFn: FetchFn = fetch
): Promise<TelegramUpdate[]> {
  const body: Record<string, unknown> = {
    timeout: 0,
    allowed_updates: ["message"]
  };

  if (offset !== undefined) {
    body.offset = offset;
  }

  return telegramRequest<TelegramUpdate[]>(
    botToken,
    "getUpdates",
    body,
    fetchFn
  );
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  fetchFn: FetchFn = fetch
): Promise<void> {
  await telegramRequest(
    botToken,
    "sendMessage",
    {
      chat_id: chatId,
      text
    },
    fetchFn
  );
}