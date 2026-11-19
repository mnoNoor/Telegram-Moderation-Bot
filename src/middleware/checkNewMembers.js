const BanWord = require("../models/BanWord");
const NumberModel = require("../models/Number");
const { normalize } = require("../normalization/normalizedText");
const { normalizeNumber } = require("../normalization/normalizeNumber");
const { matchesBannedWord } = require("../normalization/matchesBannedWord");
const { containsAllowedNumber } = require("../normalization/matchNumber");
const { banUser } = require("../services/banService");

const SEPARATOR_CLASS =
  "[\\s.\\-_/\\\\|·•*~^`'\"`,;:\\u200B-\\u200F\\u202A-\\u202E]";

const NUMBER_REGEX = new RegExp(
  `(?<![0-9٠-٩۰-۹])[0-9٠-٩۰-۹](?:${SEPARATOR_CLASS}*[0-9٠-٩۰-۹]){7,}(?![0-9٠-٩۰-۹])`,
  "g",
);

const looksLikeDate = (seq) =>
  /^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(seq) ||
  /^(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])(19|20)\d{2}$/.test(seq);

const looksLikeSpam = (seq) => /^(\d)\1{7,}$/.test(seq);

const checkNewMembers = async (ctx, next) => {
  const members = ctx.message?.new_chat_members;
  if (!members?.length) return next();

  const isGroup = ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
  if (!isGroup) return next();

  const bannedWordsDocs = await BanWord.find();
  const bannedWords = bannedWordsDocs.map((b) =>
    normalize(b.word.toLowerCase()),
  );

  const allowedNumbersDocs = await NumberModel.find();
  const allowedSet = new Set(
    allowedNumbersDocs.map((n) => normalizeNumber(n.value.toString())),
  );

  for (const member of members) {
    if (member.is_bot) continue;

    const fullName = `${member.first_name || ""} ${
      member.last_name || ""
    }`.trim();

    if (!fullName) continue;

    const normalizedName = normalize(fullName.toLowerCase());

    const matchedWord = bannedWords.find((word) =>
      matchesBannedWord(normalizedName, word),
    );

    if (matchedWord) {
      await banUser(ctx, {
        reason: "banned_name_word",
        matchedWord,
        skipDelete: true,
        targetUser: member,
      });
      continue;
    }

    const rawSequences = fullName.match(NUMBER_REGEX) || [];

    const candidateNumbers = rawSequences
      .map((s) => normalizeNumber(s))
      .filter((s) => s.length >= 8)
      .filter((s) => !looksLikeDate(s))
      .filter((s) => !looksLikeSpam(s));

    for (const seq of candidateNumbers) {
      if (containsAllowedNumber(seq, allowedSet)) continue;
      if (seq.length < 10) continue;

      await banUser(ctx, {
        reason: "banned_name_number",
        matchedNumber: seq,
        skipDelete: true,
        targetUser: member,
      });
      break;
    }
  }

  await next();
};

module.exports = { checkNewMembers };
