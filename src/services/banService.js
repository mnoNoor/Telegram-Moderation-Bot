const Admin = require("../models/Admin");

const escapeHtml = (text) =>
  String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const cleanInvisible = (text) =>
  String(text ?? "").replace(/[\u200B-\u200F\u202A-\u202E\u2060\u20E4]/g, "");

const REASON_LABELS = {
  banned_word: "كلمة ممنوعة",
  banned_name_word: "كلمة ممنوعة في الاسم",
  banned_name_number: "رقم غير مسموح في الاسم",
  unallowed_number: "رقم غير مسموح",
  unallowed_contact: "جهة اتصال غير مسموحة",
  coded_message: "رسالة مرمّزة",
  spam: "سبام",
};

const GROUP_ADMIN_CACHE_TTL_MS = 5 * 60 * 1000;
const groupAdminCache = new Map();

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of groupAdminCache.entries()) {
    if (entry.expires <= now) groupAdminCache.delete(key);
  }
}, GROUP_ADMIN_CACHE_TTL_MS);

if (cleanupInterval.unref) cleanupInterval.unref();

const isTelegramGroupAdmin = async (ctx, userId = ctx.from?.id) => {
  const chatId = ctx.chat?.id;

  if (!userId) return true;
  if (userId === chatId) return true;

  const key = `${chatId}:${userId}`;
  const cached = groupAdminCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.isAdmin;

  try {
    const member = await ctx.telegram.getChatMember(chatId, userId);
    const isAdmin =
      member.status === "creator" || member.status === "administrator";

    groupAdminCache.set(key, {
      isAdmin,
      expires: Date.now() + GROUP_ADMIN_CACHE_TTL_MS,
    });
    return isAdmin;
  } catch (error) {
    console.error(
      `getChatMember failed (chat=${chatId}, user=${userId}):`,
      error.message,
    );
    return false;
  }
};

const isBotAdmin = async (userId) => {
  if (!userId) return false;
  const admin = await Admin.findOne({ telegramId: userId }).lean();
  return !!admin;
};

const isExempt = async (ctx, user = ctx.from) => {
  if (await isTelegramGroupAdmin(ctx, user?.id)) return true;
  if (await isBotAdmin(user?.id)) return true;
  return false;
};

const buildNotification = ({
  ctx,
  user = ctx.from,
  reason,
  matchedWord,
  matchedNumber,
  extra,
}) => {
  const u = user || {};
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || "—";
  const username = u.username ? `@${u.username}` : "—";

  const lines = [
    "🚫 <b>حظر عضو</b>",
    "",
    `👤 الاسم: ${escapeHtml(name)}`,
    `🆔 <code>${u.id ?? "—"}</code>`,
    `🔗 ${escapeHtml(username)}`,
    "",
    `📌 السبب: ${REASON_LABELS[reason] || reason}`,
  ];

  if (matchedWord)
    lines.push(`🔑 المطابق: <code>${escapeHtml(matchedWord)}</code>`);
  if (matchedNumber)
    lines.push(`🔢 المطابق: <code>${escapeHtml(matchedNumber)}</code>`);
  if (extra?.spamCount) lines.push(`🔁 التكرار: ${extra.spamCount}`);

  const messageText = ctx.message?.text ?? ctx.message?.caption;

  if (messageText) {
    const cleanText = cleanInvisible(messageText).slice(0, 300);
    lines.push(
      "",
      "💬 الرسالة:",
      `<blockquote>${escapeHtml(cleanText)}</blockquote>`,
    );
  }

  const keyboard =
    u.id && ctx.chat?.id
      ? {
          inline_keyboard: [
            [
              {
                text: "🔓 فك الحظر",
                callback_data: `unban:${ctx.chat.id}:${u.id}`,
              },
            ],
          ],
        }
      : undefined;

  return { text: lines.join("\n"), keyboard };
};

const notifySuperAdmins = async (ctx, message, replyMarkup) => {
  try {
    const superAdmins = await Admin.find({ role: "superAdmin" }).lean();
    if (!superAdmins.length) return;

    await Promise.allSettled(
      superAdmins.map((admin) =>
        ctx.telegram
          .sendMessage(admin.telegramId, message, {
            parse_mode: "HTML",
            link_preview_options: { is_disabled: true },
            ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
          })
          .catch((error) => {
            console.error(
              `Failed to notify superAdmin ${admin.telegramId}:`,
              error.message,
            );
          }),
      ),
    );
  } catch (error) {
    console.error("notifySuperAdmins error:", error);
  }
};

const banUser = async (
  ctx,
  {
    reason,
    matchedWord,
    matchedNumber,
    extra,
    skipDelete = false,
    targetUser = null,
  },
) => {
  const user = targetUser || ctx.from;

  if (await isExempt(ctx, user)) {
    const id = user?.id ?? "anonymous";
    console.log(`⏭️ Skip ban — ${id} is exempt (${reason})`);
    return;
  }

  if (!skipDelete && !targetUser) {
    try {
      await ctx.deleteMessage();
    } catch (_) {}
  }

  try {
    await ctx.telegram.banChatMember(ctx.chat.id, user.id, undefined, {
      revoke_messages: true,
    });
  } catch (error) {
    console.error(`Failed to ban ${user.id}:`, error.message);
    return;
  }

  const username = user.username ? `@${user.username}` : "no-username";
  console.log(
    `🚫 Banned ${user.id} (${username}) — ${reason}` +
      (matchedWord ? ` | word: ${matchedWord}` : "") +
      (matchedNumber ? ` | number: ${matchedNumber}` : ""),
  );

  const { text, keyboard } = buildNotification({
    ctx,
    user,
    reason,
    matchedWord,
    matchedNumber,
    extra,
  });

  await notifySuperAdmins(ctx, text, keyboard);
};

module.exports = { banUser, isExempt };
