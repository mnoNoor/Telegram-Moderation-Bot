const Admin = require("../models/Admin");

const max_Spam_Count = 3;
const SPAM_WINDOW_MS = 10 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const ENTRY_TTL_MS = 60 * 60 * 1000;

const spamTracker = new Map();

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, data] of spamTracker.entries()) {
    if (now - data.lastTime > ENTRY_TTL_MS) {
      spamTracker.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

if (cleanupInterval.unref) cleanupInterval.unref();

const getSpamContent = (ctx) => {
  if (ctx.message?.text) {
    const text = ctx.message.text.trim();
    if (!text) return null;
    return { type: "text", content: text };
  }
  if (ctx.message?.photo?.length) {
    const largest = ctx.message.photo[ctx.message.photo.length - 1];
    return { type: "photo", content: `photo:${largest.file_unique_id}` };
  }
  return null;
};

const isAdmin = async (userId) => {
  const admin = await Admin.findOne({ telegramId: userId });
  return !!admin;
};

const spamHandler = async (ctx, next) => {
  const isGroup = ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
  if (!isGroup) return next();

  const info = getSpamContent(ctx);
  if (!info) return next();

  const key = `${ctx.chat.id}:${ctx.from.id}`;
  const messageId = ctx.message.message_id;
  const now = Date.now();

  const data = spamTracker.get(key) || {
    type: null,
    content: null,
    count: 0,
    messageIds: [],
    lastTime: 0,
  };

  const withinWindow = now - data.lastTime < SPAM_WINDOW_MS;
  const isSame =
    data.type === info.type && data.content === info.content && withinWindow;

  if (isSame) {
    data.count += 1;
    data.messageIds.push(messageId);
  } else {
    data.type = info.type;
    data.content = info.content;
    data.count = 1;
    data.messageIds = [messageId];
  }

  data.lastTime = now;
  spamTracker.set(key, data);

  if (data.count < max_Spam_Count) return next();

  if (await isAdmin(ctx.from.id)) {
    spamTracker.delete(key);
    return next();
  }

  try {
    await ctx.telegram.banChatMember(ctx.chat.id, ctx.from.id, {
      revoke_messages: true,
    });

    for (const id of data.messageIds) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, id);
        console.log(
          `Deleted message ${id} from user ${ctx.from.id} due to spam`,
        );
      } catch (error) {
        console.error(`Failed to delete message ${id}:`, error);
      }
    }

    spamTracker.delete(key);
    return;
  } catch (error) {
    console.error(error);
    spamTracker.delete(key);
    return next();
  }
};

module.exports = { spamHandler };
