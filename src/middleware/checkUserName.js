const BanWord = require("../models/BanWord");
const NumberModel = require("../models/Number");
const Admin = require("../models/Admin");
const { normalize } = require("../normalization/normalizedText");
const { normalizeNumber } = require("../normalization/normalizeNumber");

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

const checkUserName = async (ctx, next) => {
  if (!ctx.from) return next();

  const isGroupChat =
    ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
  if (!isGroupChat) return next();

  const fullName = `${ctx.from.first_name || ""} ${
    ctx.from.last_name || ""
  }`.trim();

  if (!fullName) return next();

  const normalizedName = normalize(fullName.toLowerCase());
  const bannedWordsDocs = await BanWord.find();
  const bannedWords = bannedWordsDocs.map((b) =>
    normalize(b.word.toLowerCase()),
  );
  const matchedWord = bannedWords.find(
    (word) => word && normalizedName.includes(word),
  );

  const rawSequences = fullName.match(NUMBER_REGEX) || [];
  const candidateNumbers = rawSequences
    .map((s) => normalizeNumber(s))
    .filter((s) => s.length >= 8)
    .filter((s) => !looksLikeDate(s))
    .filter((s) => !looksLikeSpam(s));

  if (!matchedWord && candidateNumbers.length === 0) return next();

  const admin = await Admin.findOne({ telegramId: ctx.from.id });
  if (admin) return next();

  if (matchedWord) {
    try {
      await ctx.telegram.banChatMember(ctx.chat.id, ctx.from.id, {
        revoke_messages: true,
      });
      console.log(
        `${fullName} (${ctx.from.id}) got banned because of banned word in their name: ${matchedWord}`,
      );
      return;
    } catch (error) {
      console.error("Ban error (word):", error);
      return next();
    }
  }

  const allowedNumbersDocs = await NumberModel.find();
  const allowedSet = new Set(
    allowedNumbersDocs.map((n) => normalizeNumber(n.value.toString())),
  );

  for (const seq of candidateNumbers) {
    let containsAllowed = false;
    for (const allowed of allowedSet) {
      if (seq.includes(allowed)) {
        containsAllowed = true;
        break;
      }
    }
    if (containsAllowed) continue;

    if (seq.length < 10) continue;

    try {
      await ctx.telegram.banChatMember(ctx.chat.id, ctx.from.id, {
        revoke_messages: true,
      });
      console.log(
        `${fullName} (${ctx.from.id}) got banned because of unallowed number in their name: ${seq}`,
      );
      return;
    } catch (error) {
      console.error("Ban error (number):", error);
      return next();
    }
  }

  await next();
};

module.exports = { checkUserName };
