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

interface ParsedCommand {
  name: string;
  args: string[];
}

function parseCommand(text: string): ParsedCommand | null {
  const parts = text.trim().split(/\s+/);
  const firstToken = parts[0];

  if (!firstToken?.startsWith("/")) {
    return null;
  }

  const name = firstToken
    .slice(1)
    .split("@", 1)[0]
    ?.toLowerCase();

  if (!name) {
    return null;
  }

  return {
    name,
    args: parts.slice(1)
  };
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

  const command = parseCommand(message.text);

  if (!command) {
    return null;
  }

  if (command.name === "start") {
    return {
      chatId: sandboxChatId,
      text:
        "Axone Community Zone Sandbox\n\n" +
        "The bot is running in read-only mode.\n" +
        "No Telegram permissions are modified during Milestone 3."
    };
  }

  if (command.name === "verify") {
    if (command.args.length > 0) {
      return {
        chatId: sandboxChatId,
        text:
          "Do not send an Axone wallet address through Telegram.\n\n" +
          "The Community Zone is designed to preserve unlinkability between " +
          "your Telegram identity and your Axone wallet.\n\n" +
          "The privacy-preserving qualification flow is not available yet."
      };
    }

    return {
      chatId: sandboxChatId,
      text:
        "Privacy-preserving verification is not available yet.\n\n" +
        "When implemented, /verify will start a separate qualification flow " +
        "without exposing your Axone wallet address to Telegram."
    };
  }

  return null;
}