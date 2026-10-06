const BanWord = require("../models/BanWord");
const NumberModel = require("../models/Number");
const Admin = require("../models/Admin");
const { normalize } = require("../normalization/normalizedText");
const { normalizeNumber } = require("../normalization/normalizeNumber");

const checkUserName = async (ctx, next) => {
  if (!ctx.from) return next();

  const isGroupChat =
    ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
  if (!isGroupChat) return next();

  const fullName = `
    ${ctx.from.first_name || ""}
    ${ctx.from.last_name || ""}
  `.toLowerCase();

  if (!fullName.trim()) return next();

  const normalizedName = normalize(fullName);
  const normalizedNumbers = normalizeNumber(fullName);

  const bannedWordsDocs = await BanWord.find();
  const bannedWords = bannedWordsDocs.map((b) =>
    normalize(b.word.toLowerCase()),
  );

  const matchedWord = bannedWords.find(
    (word) => word && normalizedName.includes(word),
  );

  const hasNumber = normalizedNumbers.length > 0;

  if (!matchedWord && !hasNumber) return next();

  const admin = await Admin.findOne({ telegramId: ctx.from.id });
  if (admin) return next();

  if (matchedWord) {
    try {
      await ctx.telegram.banChatMember(ctx.chat.id, ctx.from.id);
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

  let containsAllowed = false;
  for (const allowed of allowedSet) {
    if (normalizedNumbers.includes(allowed)) {
      containsAllowed = true;
      break;
    }
  }

  if (!containsAllowed) {
    try {
      await ctx.telegram.banChatMember(ctx.chat.id, ctx.from.id);
      console.log(
        `${fullName} (${ctx.from.id}) got banned because of unallowed number in their name`,
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
