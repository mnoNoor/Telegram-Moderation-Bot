// allowedNumbers.js
const NumberModel = require("../models/Number");
const { normalizeNumber } = require("../normalization/normalizeNumber");

const stripUrls = (text) =>
  text
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\bwww\.\S+/gi, " ")
    .replace(/\b(wa\.me|t\.me|telegram\.me|whatsapp\.com)\/\S*/gi, " ")
    .replace(
      /\b[a-z0-9-]+\.(?:com|net|org|io|me|ly|co|info|xyz|app|dev|tk|gg|to|link|site|online)(?:\/\S*)?/gi,
      " ",
    );

const SEPARATOR_CLASS =
  "[\\s.\\-_/\\\\|·•*~^`'\"`,;:\\u200B-\\u200F\\u202A-\\u202E]";

const collapseSeparatorsBetweenDigits = (text) => {
  const re = new RegExp(`([0-9٠-٩۰-۹])${SEPARATOR_CLASS}+(?=[0-9٠-٩۰-۹])`, "g");
  return text.replace(re, "$1");
};

const NUMBER_REGEX = /(?<![a-zA-Z])[0-9٠-٩۰-۹]{8,15}(?![a-zA-Z])/g;

const looksLikeDate = (seq) =>
  /^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(seq) ||
  /^(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])(19|20)\d{2}$/.test(seq);

const looksLikeSpam = (seq) => /^(\d)\1{7,}$/.test(seq);

const isAllowedNumber = async (ctx, next) => {
  if (!ctx.message?.text) return next();

  const isGroupChat =
    ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
  if (!isGroupChat) return next();

  let cleaned = stripUrls(ctx.message.text);
  cleaned = collapseSeparatorsBetweenDigits(cleaned);

  const rawSequences = cleaned.match(NUMBER_REGEX) || [];
  const numberSequences = rawSequences
    .map(normalizeNumber)
    .filter((s) => s.length >= 8)
    .filter((s) => !looksLikeDate(s))
    .filter((s) => !looksLikeSpam(s));

  if (numberSequences.length === 0) return next();

  const allowed = await NumberModel.find();
  const allowedSet = new Set(
    allowed.map((n) => normalizeNumber(n.value.toString())),
  );

  for (const seq of numberSequences) {
    let containsAllowed = false;
    for (const allowedNum of allowedSet) {
      if (seq.includes(allowedNum)) {
        containsAllowed = true;
        break;
      }
    }

    if (containsAllowed) continue;

    const isLong = seq.length >= 10;
    if (!isLong) continue;

    try {
      await ctx.deleteMessage();
      await ctx.telegram.banChatMember(ctx.chat.id, ctx.from.id);

      const username = ctx.from.username
        ? `@${ctx.from.username}`
        : "unknown user";

      console.log(
        `${ctx.from.id}, (${username}) got banned because of unallowed number: ${seq}`,
      );
      return;
    } catch (error) {
      console.error("Error banning user:", error);
      return next();
    }
  }

  await next();
};

module.exports = { isAllowedNumber };
