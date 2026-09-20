import { loadTelegramConfig } from "../config.js";
import {
  getTelegramUpdates,
  sendTelegramMessage
} from "./api.js";
import { handleTelegramUpdate } from "./handler.js";

async function main(): Promise<void> {
  const config = loadTelegramConfig();

  const updates = await getTelegramUpdates(config.botToken);

  if (updates.length === 0) {
    console.log("No Telegram updates available.");
    return;
  }

  console.log(`Received ${updates.length} Telegram update(s).`);

  let highestUpdateId = -1;

  for (const update of updates) {
    highestUpdateId = Math.max(highestUpdateId, update.update_id);

    const reply = handleTelegramUpdate(
      update,
      config.sandboxChatId
    );

    if (!reply) {
      continue;
    }

    await sendTelegramMessage(
      config.botToken,
      reply.chatId,
      reply.text
    );

    console.log(
      `Reply sent for Telegram update ${update.update_id}.`
    );
  }

  // Confirm that the updates processed above do not need to be returned again
  // during the next one-shot execution.
  if (highestUpdateId >= 0) {
    await getTelegramUpdates(
      config.botToken,
      highestUpdateId + 1
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});