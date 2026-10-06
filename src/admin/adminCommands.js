const BanWord = require("../models/BanWord");
const Admin = require("../models/Admin");
const NumberModel = require("../models/Number");
const { Markup } = require("telegraf");
const { normalize } = require("../normalization/normalizedText");
const { normalizeNumber } = require("../normalization/normalizeNumber");

const adminCommands = (bot) => {
  const waitingForBanPhrase = {};
  const waitingForAllowedNumber = {};
  const waitingForAdminId = {};
  const listSessions = {};

  const PAGE_SIZE = 10;

  const getAdmin = async (userId) =>
    await Admin.findOne({ telegramId: userId });

  const requireAdmin = async (ctx) => {
    const admin = await getAdmin(ctx.from.id);
    if (!admin) {
      await ctx.answerCbQuery("❌ Not authorized", { show_alert: true });
      return null;
    }
    return admin;
  };

  const requireSuperAdmin = async (ctx) => {
    const admin = await getAdmin(ctx.from.id);
    if (!admin || admin.role !== "superAdmin") {
      await ctx.answerCbQuery("❌ SuperAdmin only", { show_alert: true });
      return null;
    }
    return admin;
  };

  const mainReplyKeyboard = () =>
    Markup.keyboard([
      ["📝 Ban Words", "📞 Numbers"],
      ["👥 Admins", "📊 Stats"],
      ["❌ Close"],
    ]).resize();

  const banWordsReplyKeyboard = () =>
    Markup.keyboard([
      ["➕ Add Ban Word", "📋 Ban Words List"],
      ["🗑️ Remove Ban Word"],
      ["⬅️ Back", "❌ Close"],
    ]).resize();

  const numbersReplyKeyboard = () =>
    Markup.keyboard([
      ["➕ Add Number", "📋 Numbers List"],
      ["🗑️ Remove Number"],
      ["⬅️ Back", "❌ Close"],
    ]).resize();

  const adminsReplyKeyboard = () =>
    Markup.keyboard([
      ["➕ Add Admin", "📋 Admins List"],
      ["🗑️ Remove Admin"],
      ["⬅️ Back", "❌ Close"],
    ]).resize();

  const statsReplyKeyboard = () =>
    Markup.keyboard([
      ["📝 Ban Words Stats", "📞 Numbers Stats"],
      ["👥 Admins Stats"],
      ["⬅️ Back", "❌ Close"],
    ]).resize();

  const cancelReplyKeyboard = () => Markup.keyboard([["❌ Cancel"]]).resize();

  const backRow = [
    Markup.button.callback("⬅️ Back", "menu_main"),
    Markup.button.callback("❌ Close", "menu_close"),
  ];

  const backOnlyKeyboard = (backTo = "menu_main") =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback("⬅️ Back", backTo),
        Markup.button.callback("❌ Close", "menu_close"),
      ],
    ]);

  const buildPaginatedListKeyboard = (
    items,
    page,
    prefix,
    removePrefix = null,
    backTo = "menu_main",
  ) => {
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const slice = items.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

    const rows = slice.map((item, idx) => {
      const globalIdx = safePage * PAGE_SIZE + idx;
      const label = `• ${item}`.slice(0, 40);
      if (removePrefix) {
        return [
          Markup.button.callback(`🗑️ ${label}`, `${removePrefix}:${globalIdx}`),
        ];
      }
      return [Markup.button.callback(label, "noop")];
    });

    const nav = [];
    if (safePage > 0)
      nav.push(Markup.button.callback("⬅️ Prev", `${prefix}:${safePage - 1}`));
    nav.push(Markup.button.callback(`${safePage + 1}/${totalPages}`, "noop"));
    if (safePage < totalPages - 1)
      nav.push(Markup.button.callback("Next ➡️", `${prefix}:${safePage + 1}`));

    if (nav.length > 1) rows.push(nav);

    rows.push([
      Markup.button.callback("⬅️ Back", backTo),
      Markup.button.callback("❌ Close", "menu_close"),
    ]);

    return Markup.inlineKeyboard(rows);
  };

  bot.command("admin", async (ctx) => {
    if (ctx.chat.type !== "private") return;

    const admin = await getAdmin(ctx.from.id);
    if (!admin) return ctx.reply("❌ You are not an admin.");

    await ctx.reply("⚙️ Admin Panel", mainReplyKeyboard());
  });

  bot.action("noop", (ctx) => ctx.answerCbQuery());

  bot.action("menu_main", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await ctx.answerCbQuery();
    await ctx.deleteMessage().catch(() => {});
    await ctx.reply("⚙️ Admin Panel", mainReplyKeyboard());
  });

  bot.action("menu_close", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage().catch(() => {});
  });

  bot.action("menu_banwords", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await ctx.answerCbQuery();
    await ctx.deleteMessage().catch(() => {});
    await ctx.reply("📝 Ban Words Management", banWordsReplyKeyboard());
  });

  bot.action("menu_numbers", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await ctx.answerCbQuery();
    await ctx.deleteMessage().catch(() => {});
    await ctx.reply("📞 Numbers Management", numbersReplyKeyboard());
  });

  bot.action("menu_admins", async (ctx) => {
    if (!(await requireSuperAdmin(ctx))) return;
    await ctx.answerCbQuery();
    await ctx.deleteMessage().catch(() => {});
    await ctx.reply("👥 Admins Management", adminsReplyKeyboard());
  });

  bot.action("menu_stats", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await ctx.answerCbQuery();
    await ctx.deleteMessage().catch(() => {});
    await ctx.reply("📊 Statistics", statsReplyKeyboard());
  });

  bot.action("stats_banwords", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const count = await BanWord.countDocuments();
    await ctx.answerCbQuery();
    await ctx
      .editMessageText(`📝 Ban Words: ${count}`, backOnlyKeyboard("menu_stats"))
      .catch(() => {});
  });

  bot.action("stats_numbers", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const count = await NumberModel.countDocuments();
    await ctx.answerCbQuery();
    await ctx
      .editMessageText(
        `📞 Allowed Numbers: ${count}`,
        backOnlyKeyboard("menu_stats"),
      )
      .catch(() => {});
  });

  bot.action("stats_admins", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const count = await Admin.countDocuments();
    await ctx.answerCbQuery();
    await ctx
      .editMessageText(`👥 Admins: ${count}`, backOnlyKeyboard("menu_stats"))
      .catch(() => {});
  });

  bot.action(/^banword_list:(\d+)$/, async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const page = Number(ctx.match[1]);
    const words = await BanWord.find().sort({ word: 1 }).lean();
    await ctx.answerCbQuery();

    if (!words.length) {
      return ctx
        .editMessageText(
          "📋 No ban words yet.",
          backOnlyKeyboard("menu_banwords"),
        )
        .catch(() => {});
    }

    const list = words.map((w) => w.word);
    await ctx
      .editMessageText(
        `📋 Ban Words (${words.length}):`,
        buildPaginatedListKeyboard(
          list,
          page,
          "banword_list",
          null,
          "menu_banwords",
        ),
      )
      .catch(() => {});
  });

  bot.action(/^banword_remove_list:(\d+)$/, async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const page = Number(ctx.match[1]);
    const words = await BanWord.find().sort({ word: 1 }).lean();
    await ctx.answerCbQuery();

    if (!words.length) {
      return ctx
        .editMessageText(
          "📋 No ban words to remove.",
          backOnlyKeyboard("menu_banwords"),
        )
        .catch(() => {});
    }

    listSessions[ctx.from.id] = {
      type: "banword",
      ids: words.map((w) => w._id.toString()),
    };

    const list = words.map((w) => w.word);
    await ctx
      .editMessageText(
        `🗑️ Tap a word to remove it (${words.length}):`,
        buildPaginatedListKeyboard(
          list,
          page,
          "banword_remove_list",
          "banword_del",
          "menu_banwords",
        ),
      )
      .catch(() => {});
  });

  bot.action(/^banword_del:(\d+)$/, async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const idx = Number(ctx.match[1]);
    const ids = listSessions[ctx.from.id]?.ids || [];
    const id = ids[idx];

    if (!id) return ctx.answerCbQuery("⚠️ Expired, reopen list");

    const removed = await BanWord.findByIdAndDelete(id);
    await ctx.answerCbQuery(removed ? "✅ Removed" : "⚠️ Not found");

    const words = await BanWord.find().sort({ word: 1 }).lean();
    listSessions[ctx.from.id] = {
      type: "banword",
      ids: words.map((w) => w._id.toString()),
    };

    if (!words.length) {
      return ctx
        .editMessageText(
          "📋 List is now empty.",
          backOnlyKeyboard("menu_banwords"),
        )
        .catch(() => {});
    }

    const list = words.map((w) => w.word);
    await ctx
      .editMessageText(
        `🗑️ Tap a word to remove it (${words.length}):`,
        buildPaginatedListKeyboard(
          list,
          0,
          "banword_remove_list",
          "banword_del",
          "menu_banwords",
        ),
      )
      .catch(() => {});
  });

  bot.action(/^number_list:(\d+)$/, async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const page = Number(ctx.match[1]);
    const numbers = await NumberModel.find().sort({ value: 1 }).lean();
    await ctx.answerCbQuery();

    if (!numbers.length) {
      return ctx
        .editMessageText(
          "📋 No allowed numbers yet.",
          backOnlyKeyboard("menu_numbers"),
        )
        .catch(() => {});
    }

    const list = numbers.map((n) => n.value);
    await ctx
      .editMessageText(
        `📋 Allowed Numbers (${numbers.length}):`,
        buildPaginatedListKeyboard(
          list,
          page,
          "number_list",
          null,
          "menu_numbers",
        ),
      )
      .catch(() => {});
  });

  bot.action(/^number_remove_list:(\d+)$/, async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const page = Number(ctx.match[1]);
    const numbers = await NumberModel.find().sort({ value: 1 }).lean();
    await ctx.answerCbQuery();

    if (!numbers.length) {
      return ctx
        .editMessageText(
          "📋 No numbers to remove.",
          backOnlyKeyboard("menu_numbers"),
        )
        .catch(() => {});
    }

    listSessions[ctx.from.id] = {
      type: "number",
      ids: numbers.map((n) => n._id.toString()),
    };

    const list = numbers.map((n) => n.value);
    await ctx
      .editMessageText(
        `🗑️ Tap a number to remove it (${numbers.length}):`,
        buildPaginatedListKeyboard(
          list,
          page,
          "number_remove_list",
          "number_del",
          "menu_numbers",
        ),
      )
      .catch(() => {});
  });

  bot.action(/^number_del:(\d+)$/, async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const idx = Number(ctx.match[1]);
    const ids = listSessions[ctx.from.id]?.ids || [];
    const id = ids[idx];

    if (!id) return ctx.answerCbQuery("⚠️ Expired, reopen list");

    const removed = await NumberModel.findByIdAndDelete(id);
    await ctx.answerCbQuery(removed ? "✅ Removed" : "⚠️ Not found");

    const numbers = await NumberModel.find().sort({ value: 1 }).lean();
    listSessions[ctx.from.id] = {
      type: "number",
      ids: numbers.map((n) => n._id.toString()),
    };

    if (!numbers.length) {
      return ctx
        .editMessageText(
          "📋 List is now empty.",
          backOnlyKeyboard("menu_numbers"),
        )
        .catch(() => {});
    }

    const list = numbers.map((n) => n.value);
    await ctx
      .editMessageText(
        `🗑️ Tap a number to remove it (${numbers.length}):`,
        buildPaginatedListKeyboard(
          list,
          0,
          "number_remove_list",
          "number_del",
          "menu_numbers",
        ),
      )
      .catch(() => {});
  });

  bot.action("admin_list", async (ctx) => {
    if (!(await requireSuperAdmin(ctx))) return;
    const admins = await Admin.find().sort({ telegramId: 1 }).lean();
    await ctx.answerCbQuery();

    if (!admins.length) {
      return ctx
        .editMessageText("📋 No admins yet.", backOnlyKeyboard("menu_admins"))
        .catch(() => {});
    }

    const lines = admins
      .map((a, i) => `${i + 1}. ${a.telegramId} — ${a.role}`)
      .join("\n");

    await ctx
      .editMessageText(
        `👥 Admins (${admins.length}):\n\n${lines}`,
        backOnlyKeyboard("menu_admins"),
      )
      .catch(() => {});
  });

  bot.action("admin_remove_list", async (ctx) => {
    if (!(await requireSuperAdmin(ctx))) return;
    const admins = await Admin.find().sort({ telegramId: 1 }).lean();
    await ctx.answerCbQuery();

    if (!admins.length) {
      return ctx
        .editMessageText(
          "📋 No admins to remove.",
          backOnlyKeyboard("menu_admins"),
        )
        .catch(() => {});
    }

    listSessions[ctx.from.id] = {
      type: "admin",
      ids: admins.map((a) => a._id.toString()),
    };

    const rows = admins.map((a, idx) => [
      Markup.button.callback(
        `🗑️ ${a.telegramId} (${a.role})`,
        `admin_del:${idx}`,
      ),
    ]);
    rows.push([
      Markup.button.callback("⬅️ Back", "menu_admins"),
      Markup.button.callback("❌ Close", "menu_close"),
    ]);

    await ctx
      .editMessageText(
        `🗑️ Tap an admin to remove it (${admins.length}):`,
        Markup.inlineKeyboard(rows),
      )
      .catch(() => {});
  });

  bot.action(/^admin_del:(\d+)$/, async (ctx) => {
    if (!(await requireSuperAdmin(ctx))) return;
    const idx = Number(ctx.match[1]);
    const ids = listSessions[ctx.from.id]?.ids || [];
    const id = ids[idx];

    if (!id) return ctx.answerCbQuery("⚠️ Expired, reopen list");

    const target = await Admin.findById(id);
    if (!target) return ctx.answerCbQuery("⚠️ Not found");

    if (target.role === "superAdmin") {
      return ctx.answerCbQuery("❌ Cannot remove a superAdmin", {
        show_alert: true,
      });
    }

    await Admin.findByIdAndDelete(id);
    await ctx.answerCbQuery("✅ Removed");

    const admins = await Admin.find().sort({ telegramId: 1 }).lean();
    listSessions[ctx.from.id] = {
      type: "admin",
      ids: admins.map((a) => a._id.toString()),
    };

    if (!admins.length) {
      return ctx
        .editMessageText(
          "📋 List is now empty.",
          backOnlyKeyboard("menu_admins"),
        )
        .catch(() => {});
    }

    const rows = admins.map((a, i) => [
      Markup.button.callback(
        `🗑️ ${a.telegramId} (${a.role})`,
        `admin_del:${i}`,
      ),
    ]);
    rows.push([
      Markup.button.callback("⬅️ Back", "menu_admins"),
      Markup.button.callback("❌ Close", "menu_close"),
    ]);

    await ctx
      .editMessageText(
        `🗑️ Tap an admin to remove it (${admins.length}):`,
        Markup.inlineKeyboard(rows),
      )
      .catch(() => {});
  });

  bot.hears("❌ Cancel", async (ctx, next) => {
    const userId = ctx.from.id;

    if (waitingForBanPhrase[userId]) {
      delete waitingForBanPhrase[userId];
      await ctx.reply("Cancelled", banWordsReplyKeyboard());
      return;
    }

    if (waitingForAllowedNumber[userId]) {
      delete waitingForAllowedNumber[userId];
      await ctx.reply("Cancelled", numbersReplyKeyboard());
      return;
    }

    if (waitingForAdminId[userId]) {
      delete waitingForAdminId[userId];
      await ctx.reply("Cancelled", adminsReplyKeyboard());
      return;
    }

    return next();
  });

  bot.on("text", async (ctx, next) => {
    if (ctx.chat.type !== "private") return next();

    const userId = ctx.from.id;

    if (waitingForBanPhrase[userId]) {
      const admin = await getAdmin(userId);
      if (!admin) {
        delete waitingForBanPhrase[userId];
        return ctx.reply("❌ Not authorized.");
      }

      const phrase = normalize(ctx.message.text.trim().toLowerCase());
      delete waitingForBanPhrase[userId];

      if (!phrase) {
        return ctx.reply("❌ Invalid phrase.", banWordsReplyKeyboard());
      }

      try {
        await BanWord.create({ word: phrase });
        await ctx.reply(
          `✅ Phrase added:\n"${phrase}"`,
          banWordsReplyKeyboard(),
        );
      } catch (error) {
        if (error.code === 11000) {
          await ctx.reply("⚠️ Phrase already exists.", banWordsReplyKeyboard());
        } else {
          await ctx.reply("❌ Failed to save phrase.");
          console.log(error);
        }
      }
      return;
    }

    if (waitingForAllowedNumber[userId]) {
      const admin = await getAdmin(userId);
      if (!admin) {
        delete waitingForAllowedNumber[userId];
        return ctx.reply("❌ Not authorized.");
      }

      const numberValue = normalizeNumber(ctx.message.text.trim());
      delete waitingForAllowedNumber[userId];

      if (!numberValue || numberValue.length < 6) {
        return ctx.reply(
          "❌ Please send a valid number (at least 6 digits).",
          numbersReplyKeyboard(),
        );
      }

      try {
        await NumberModel.create({ value: numberValue });
        await ctx.reply(
          `✅ Number ${numberValue} allowed.`,
          numbersReplyKeyboard(),
        );
      } catch (error) {
        if (error.code === 11000) {
          await ctx.reply(
            "⚠️ This number is already allowed.",
            numbersReplyKeyboard(),
          );
        } else {
          await ctx.reply("❌ Failed to save number.");
          console.log(error);
        }
      }
      return;
    }

    if (waitingForAdminId[userId]) {
      const superAdmin = await Admin.findOne({
        telegramId: userId,
        role: "superAdmin",
      });
      if (!superAdmin) {
        delete waitingForAdminId[userId];
        return ctx.reply("❌ SuperAdmin only.");
      }

      const raw = ctx.message.text.trim();
      const newId = Number(raw);
      delete waitingForAdminId[userId];

      if (!Number.isInteger(newId) || newId <= 0) {
        return ctx.reply("❌ Invalid Telegram ID.", adminsReplyKeyboard());
      }

      try {
        await Admin.create({ telegramId: newId, role: "admin" });
        await ctx.reply(`✅ Admin ${newId} added.`, adminsReplyKeyboard());
      } catch (error) {
        if (error.code === 11000) {
          await ctx.reply(
            "⚠️ This user is already an admin.",
            adminsReplyKeyboard(),
          );
        } else {
          await ctx.reply("❌ Failed to add admin.");
          console.log(error);
        }
      }
      return;
    }

    return next();
  });

  bot.hears("📝 Ban Words", async (ctx) => {
    const admin = await getAdmin(ctx.from.id);
    if (!admin) return ctx.reply("❌ Not authorized");
    await ctx.reply("📝 Ban Words Management", banWordsReplyKeyboard());
  });

  bot.hears("📞 Numbers", async (ctx) => {
    const admin = await getAdmin(ctx.from.id);
    if (!admin) return ctx.reply("❌ Not authorized");
    await ctx.reply("📞 Numbers Management", numbersReplyKeyboard());
  });

  bot.hears("👥 Admins", async (ctx) => {
    const admin = await getAdmin(ctx.from.id);
    if (!admin || admin.role !== "superAdmin") {
      return ctx.reply("❌ SuperAdmin only");
    }
    await ctx.reply("👥 Admins Management", adminsReplyKeyboard());
  });

  bot.hears("📊 Stats", async (ctx) => {
    const admin = await getAdmin(ctx.from.id);
    if (!admin) return ctx.reply("❌ Not authorized");
    await ctx.reply("📊 Statistics", statsReplyKeyboard());
  });

  bot.hears("➕ Add Ban Word", async (ctx) => {
    const admin = await getAdmin(ctx.from.id);
    if (!admin) return ctx.reply("❌ Not authorized");
    waitingForBanPhrase[ctx.from.id] = true;
    await ctx.reply(
      "✍️ Send the word or phrase you want to ban:",
      cancelReplyKeyboard(),
    );
  });

  bot.hears("📋 Ban Words List", async (ctx) => {
    const admin = await getAdmin(ctx.from.id);
    if (!admin) return ctx.reply("❌ Not authorized");

    const words = await BanWord.find().sort({ word: 1 }).lean();
    if (!words.length) {
      return ctx.reply("📋 No ban words yet.", banWordsReplyKeyboard());
    }

    const list = words.map((w) => w.word);
    await ctx.reply(
      `📋 Ban Words (${words.length}):`,
      buildPaginatedListKeyboard(
        list,
        0,
        "banword_list",
        null,
        "menu_banwords",
      ),
    );
  });

  bot.hears("🗑️ Remove Ban Word", async (ctx) => {
    const admin = await getAdmin(ctx.from.id);
    if (!admin) return ctx.reply("❌ Not authorized");

    const words = await BanWord.find().sort({ word: 1 }).lean();
    if (!words.length) {
      return ctx.reply("📋 No ban words to remove.", banWordsReplyKeyboard());
    }

    listSessions[ctx.from.id] = {
      type: "banword",
      ids: words.map((w) => w._id.toString()),
    };

    const list = words.map((w) => w.word);
    await ctx.reply(
      `🗑️ Tap a word to remove it (${words.length}):`,
      buildPaginatedListKeyboard(
        list,
        0,
        "banword_remove_list",
        "banword_del",
        "menu_banwords",
      ),
    );
  });

  bot.hears("➕ Add Number", async (ctx) => {
    const admin = await getAdmin(ctx.from.id);
    if (!admin) return ctx.reply("❌ Not authorized");
    waitingForAllowedNumber[ctx.from.id] = true;
    await ctx.reply(
      "🔢 Send the number you want to allow:",
      cancelReplyKeyboard(),
    );
  });

  bot.hears("📋 Numbers List", async (ctx) => {
    const admin = await getAdmin(ctx.from.id);
    if (!admin) return ctx.reply("❌ Not authorized");

    const numbers = await NumberModel.find().sort({ value: 1 }).lean();
    if (!numbers.length) {
      return ctx.reply("📋 No allowed numbers yet.", numbersReplyKeyboard());
    }

    const list = numbers.map((n) => n.value);
    await ctx.reply(
      `📋 Allowed Numbers (${numbers.length}):`,
      buildPaginatedListKeyboard(list, 0, "number_list", null, "menu_numbers"),
    );
  });

  bot.hears("🗑️ Remove Number", async (ctx) => {
    const admin = await getAdmin(ctx.from.id);
    if (!admin) return ctx.reply("❌ Not authorized");

    const numbers = await NumberModel.find().sort({ value: 1 }).lean();
    if (!numbers.length) {
      return ctx.reply("📋 No numbers to remove.", numbersReplyKeyboard());
    }

    listSessions[ctx.from.id] = {
      type: "number",
      ids: numbers.map((n) => n._id.toString()),
    };

    const list = numbers.map((n) => n.value);
    await ctx.reply(
      `🗑️ Tap a number to remove it (${numbers.length}):`,
      buildPaginatedListKeyboard(
        list,
        0,
        "number_remove_list",
        "number_del",
        "menu_numbers",
      ),
    );
  });

  bot.hears("➕ Add Admin", async (ctx) => {
    const admin = await getAdmin(ctx.from.id);
    if (!admin || admin.role !== "superAdmin") {
      return ctx.reply("❌ SuperAdmin only");
    }
    waitingForAdminId[ctx.from.id] = true;
    await ctx.reply(
      "👤 Send the Telegram ID of the new admin:",
      cancelReplyKeyboard(),
    );
  });

  bot.hears("📋 Admins List", async (ctx) => {
    const admin = await getAdmin(ctx.from.id);
    if (!admin || admin.role !== "superAdmin") {
      return ctx.reply("❌ SuperAdmin only");
    }

    const admins = await Admin.find().sort({ telegramId: 1 }).lean();
    if (!admins.length) {
      return ctx.reply("📋 No admins yet.", adminsReplyKeyboard());
    }

    const lines = admins
      .map((a, i) => `${i + 1}. ${a.telegramId} — ${a.role}`)
      .join("\n");

    await ctx.reply(
      `👥 Admins (${admins.length}):\n\n${lines}`,
      adminsReplyKeyboard(),
    );
  });

  bot.hears("🗑️ Remove Admin", async (ctx) => {
    const admin = await getAdmin(ctx.from.id);
    if (!admin || admin.role !== "superAdmin") {
      return ctx.reply("❌ SuperAdmin only");
    }

    const admins = await Admin.find().sort({ telegramId: 1 }).lean();
    if (!admins.length) {
      return ctx.reply("📋 No admins to remove.", adminsReplyKeyboard());
    }

    listSessions[ctx.from.id] = {
      type: "admin",
      ids: admins.map((a) => a._id.toString()),
    };

    const rows = admins.map((a, idx) => [
      Markup.button.callback(
        `🗑️ ${a.telegramId} (${a.role})`,
        `admin_del:${idx}`,
      ),
    ]);
    rows.push([
      Markup.button.callback("⬅️ Back", "menu_admins"),
      Markup.button.callback("❌ Close", "menu_close"),
    ]);

    await ctx.reply(
      `🗑️ Tap an admin to remove it (${admins.length}):`,
      Markup.inlineKeyboard(rows),
    );
  });

  bot.hears("📝 Ban Words Stats", async (ctx) => {
    const admin = await getAdmin(ctx.from.id);
    if (!admin) return ctx.reply("❌ Not authorized");
    const count = await BanWord.countDocuments();
    await ctx.reply(`📝 Ban Words: ${count}`, statsReplyKeyboard());
  });

  bot.hears("📞 Numbers Stats", async (ctx) => {
    const admin = await getAdmin(ctx.from.id);
    if (!admin) return ctx.reply("❌ Not authorized");
    const count = await NumberModel.countDocuments();
    await ctx.reply(`📞 Allowed Numbers: ${count}`, statsReplyKeyboard());
  });

  bot.hears("👥 Admins Stats", async (ctx) => {
    const admin = await getAdmin(ctx.from.id);
    if (!admin) return ctx.reply("❌ Not authorized");
    const count = await Admin.countDocuments();
    await ctx.reply(`👥 Admins: ${count}`, statsReplyKeyboard());
  });

  bot.hears("⬅️ Back", async (ctx) => {
    const admin = await getAdmin(ctx.from.id);
    if (!admin) return ctx.reply("❌ Not authorized");
    await ctx.reply("⚙️ Admin Panel", mainReplyKeyboard());
  });

  bot.hears("❌ Close", async (ctx) => {
    await ctx.reply("تم الإغلاق", Markup.removeKeyboard());
  });
};

module.exports = { adminCommands };
