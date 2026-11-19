const BanWord = require("../models/BanWord");
const { normalize } = require("../normalization/normalizedText");
const { banUser } = require("../services/banService");
const { matchesBannedWord } = require("../normalization/matchesBannedWord");

const readMessages = async (ctx, next) => {
  const text = ctx.message?.text ?? ctx.message?.caption;
  if (!text) return next();

  const isGroup = ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
  if (!isGroup) return next();

  const normalizedText = normalize(text.toLowerCase());

  const blockedWordsDocs = await BanWord.find();
  const blockedWords = blockedWordsDocs.map((b) =>
    normalize(b.word.toLowerCase()),
  );

  for (const word of blockedWords) {
    if (matchesBannedWord(normalizedText, word)) {
      await banUser(ctx, { reason: "banned_word", matchedWord: word });
      return;
    }
  }

  await next();
};

module.exports = { readMessages };
