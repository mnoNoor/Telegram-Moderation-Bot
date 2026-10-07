const { banUser } = require("../services/banService");

const bannedCharRegex = /[ڪטּﻳﺗ]/u;

const isMessageCoded = async (ctx, next) => {
  try {
    if (!ctx.message?.text) return next();

    const isGroup =
      ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
    if (!isGroup) return next();

    const text = ctx.message.text;

    if (bannedCharRegex.test(text)) {
      await banUser(ctx, { reason: "coded_message" });
      return;
    }

    await next();
  } catch (error) {
    console.log("Error in isMessageCoded:", error);
    await next();
  }
};

module.exports = { isMessageCoded };
