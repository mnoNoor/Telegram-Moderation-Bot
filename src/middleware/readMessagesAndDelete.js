const BanWord = require("../models/BanWord");
const { normalize } = require("../normalization/normalizedText");
const { banUser } = require("../services/banService");

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
      await banUser(ctx, { reason: "banned_word", matchedWord: word });
      return;
    }
  }

  await next();
};

module.exports = { readMessages };
