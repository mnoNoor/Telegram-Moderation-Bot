const BanWord = require("../models/BanWord");
const { normalize } = require("../normalization/normalizedText");

const readMessages = async (ctx, next) => {
  if (!ctx.message?.text) return next();

  const isGroup = ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
  if (!isGroup) return next();

  const normalizedText = normalize(ctx.message.text.toLowerCase());

  const blockedWordsDocs = await BanWord.find();
  const blockedWords = blockedWordsDocs.map((b) =>
    normalize(b.word.toLowerCase()),
  );

  for (const word of blockedWords) {
    if (!word) continue;

    if (normalizedText.includes(word)) {
      try {
        await ctx.deleteMessage();
        await ctx.telegram.banChatMember(ctx.chat.id, ctx.from.id, {
          revoke_messages: true,
        });

        const username = ctx.from.username
          ? `@${ctx.from.username}`
          : "unknown user";

        console.log(
          `${ctx.from.id}, (${username}) got banned because of blocked word: ${word} in message`,
        );
        return;
      } catch (error) {
        console.error("Error deleting message:", error);
        return;
      }
    }
  }

  await next();
};

module.exports = { readMessages };
