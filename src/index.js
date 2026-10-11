const express = require("express");
const mongoose = require("mongoose");
const { Telegraf } = require("telegraf");
const { startServer } = require("./server.js");
const { adminCommands } = require("./admin/adminCommands.js");

const { readMessages } = require("./middleware/readMessagesAndDelete.js");
const { spamHandler } = require("./middleware/spamHandler.js");
const { isAllowedNumber } = require("./middleware/allowedNumbers.js");
const { isMessageCoded } = require("./middleware/isMessageCoded.js");
const { isAllowedContact } = require("./middleware/allowedContact.js");
const { checkUserName } = require("./middleware/checkUserName.js");

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const port = process.env.PORT || 3000;

const IS_PRODUCTION = process.env.NODE_ENV === "production";

app.use(express.json());

bot.catch((err, ctx) => {
  console.error(`❌ Error for ${ctx.updateType}:`, err);
});

bot.hears(/^id$/i, async (ctx) => {
  if (ctx.chat?.type !== "private") return;
  await ctx.reply(`🆔 Your ID: \`${ctx.from.id}\``, {
    parse_mode: "Markdown",
  });
});

adminCommands(bot);

bot.on(
  "message",
  checkUserName,
  readMessages,
  spamHandler,
  isAllowedNumber,
  isMessageCoded,
  isAllowedContact,
);

app.get("/", (_, res) => {
  res.send("UPM Admin Bot is running!");
});

startServer(app, bot, port).catch((err) => {
  console.error("❌ startServer failed:", err);
  process.exit(1);
});

let shuttingDown = false;

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`🛑 Received ${signal}, shutting down gracefully...`);

  if (!IS_PRODUCTION) {
    try {
      bot.stop(signal);
    } catch (err) {
      console.error("bot.stop error:", err.message);
    }
  }

  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log("✅ MongoDB disconnected");
    }
  } catch (err) {
    console.error("mongoose.disconnect error:", err.message);
  }

  setTimeout(() => process.exit(0), 500).unref();
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("⚠️ Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("⚠️ Uncaught Exception:", err);
});
