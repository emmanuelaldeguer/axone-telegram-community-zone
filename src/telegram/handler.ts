export interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
    title?: string;
  };
  from?: {
    id: number;
  };
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface TelegramReply {
  chatId: string;
  text: string;
}

function commandName(text: string): string | null {
  const firstToken = text.trim().split(/\s+/, 1)[0];

  if (!firstToken?.startsWith("/")) {
    return null;
  }

  const command = firstToken.slice(1).split("@", 1)[0];

  return command?.toLowerCase() ?? null;
}

export function handleTelegramUpdate(
  update: TelegramUpdate,
  sandboxChatId: string
): TelegramReply | null {
  const message = update.message;

  if (!message) {
    return null;
  }

  if (String(message.chat.id) !== sandboxChatId) {
    return null;
  }

  if (!message.text) {
    return null;
  }

  const command = commandName(message.text);

  if (command !== "start") {
    return null;
  }

  return {
    chatId: sandboxChatId,
    text:
      "Axone Community Zone Sandbox\n\n" +
      "The bot is running in read-only mode.\n" +
      "No Telegram permissions are modified during Milestone 3."
  };
}