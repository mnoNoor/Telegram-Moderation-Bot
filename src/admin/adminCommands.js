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

  const backRow = [
    Markup.button.callback("⬅️ Back", "menu_main"),
    Markup.button.callback("❌ Close", "menu_close"),
  ];

  const mainMenuKeyboard = () =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback("📝 Ban Words", "menu_banwords"),
        Markup.button.callback("📞 Numbers", "menu_numbers"),
      ],
      [
        Markup.button.callback("👥 Admins", "menu_admins"),
        Markup.button.callback("📊 Stats", "menu_stats"),
      ],
      [Markup.button.callback("❌ Close", "menu_close")],
    ]);

  const banWordsMenuKeyboard = () =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback("➕ Add Word", "banword_add"),
        Markup.button.callback("📋 List", "banword_list:0"),
      ],
      [Markup.button.callback("🗑️ Remove Word", "banword_remove_list:0")],
      backRow,
    ]);

  const numbersMenuKeyboard = () =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback("➕ Add Number", "number_add"),
        Markup.button.callback("📋 List", "number_list:0"),
      ],
      [Markup.button.callback("🗑️ Remove Number", "number_remove_list:0")],
      backRow,
    ]);

  const adminsMenuKeyboard = () =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback("➕ Add Admin", "admin_add"),
        Markup.button.callback("📋 List", "admin_list"),
      ],
      [Markup.button.callback("🗑️ Remove Admin", "admin_remove_list")],
      backRow,
    ]);

  const statsMenuKeyboard = () =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback("📝 Ban Words", "stats_banwords"),
        Markup.button.callback("📞 Numbers", "stats_numbers"),
      ],
      [Markup.button.callback("👥 Admins", "stats_admins")],
      backRow,
    ]);

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

    await ctx.reply("⚙️ Admin Panel", mainMenuKeyboard());
  });

  bot.action("noop", (ctx) => ctx.answerCbQuery());

  bot.action("menu_main", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await ctx.answerCbQuery();
    await ctx
      .editMessageText("⚙️ Admin Panel", mainMenuKeyboard())
      .catch(() => {});
  });

  bot.action("menu_close", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage().catch(() => {});
  });

  bot.action("menu_banwords", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await ctx.answerCbQuery();
    await ctx
      .editMessageText("📝 Ban Words Management", banWordsMenuKeyboard())
      .catch(() => {});
  });

  bot.action("menu_numbers", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await ctx.answerCbQuery();
    await ctx
      .editMessageText("📞 Numbers Management", numbersMenuKeyboard())
      .catch(() => {});
  });

  bot.action("menu_admins", async (ctx) => {
    if (!(await requireSuperAdmin(ctx))) return;
    await ctx.answerCbQuery();
    await ctx
      .editMessageText("👥 Admins Management", adminsMenuKeyboard())
      .catch(() => {});
  });

  bot.action("menu_stats", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await ctx.answerCbQuery();
    await ctx
      .editMessageText("📊 Statistics", statsMenuKeyboard())
      .catch(() => {});
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

  bot.action("banword_add", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    waitingForBanPhrase[ctx.from.id] = true;
    await ctx.answerCbQuery();
    await ctx
      .editMessageText(
        "✍️ Send the word or phrase you want to ban:",
        Markup.inlineKeyboard([
          Markup.button.callback("❌ Cancel", "cancel_ban"),
        ]),
      )
      .catch(() => {});
  });

  bot.action("number_add", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    waitingForAllowedNumber[ctx.from.id] = true;
    await ctx.answerCbQuery();
    await ctx
      .editMessageText(
        "🔢 Send the number you want to allow:",
        Markup.inlineKeyboard([
          Markup.button.callback("❌ Cancel", "cancel_number"),
        ]),
      )
      .catch(() => {});
  });

  bot.action("admin_add", async (ctx) => {
    if (!(await requireSuperAdmin(ctx))) return;
    waitingForAdminId[ctx.from.id] = true;
    await ctx.answerCbQuery();
    await ctx
      .editMessageText(
        "👤 Send the Telegram ID of the new admin:",
        Markup.inlineKeyboard([
          Markup.button.callback("❌ Cancel", "cancel_admin"),
        ]),
      )
      .catch(() => {});
  });

  bot.action("cancel_ban", async (ctx) => {
    delete waitingForBanPhrase[ctx.from.id];
    await ctx.answerCbQuery("Cancelled");
    await ctx
      .editMessageText("📝 Ban Words Management", banWordsMenuKeyboard())
      .catch(() => {});
  });

  bot.action("cancel_number", async (ctx) => {
    delete waitingForAllowedNumber[ctx.from.id];
    await ctx.answerCbQuery("Cancelled");
    await ctx
      .editMessageText("📞 Numbers Management", numbersMenuKeyboard())
      .catch(() => {});
  });

  bot.action("cancel_admin", async (ctx) => {
    delete waitingForAdminId[ctx.from.id];
    await ctx.answerCbQuery("Cancelled");
    await ctx
      .editMessageText("👥 Admins Management", adminsMenuKeyboard())
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
        return ctx.reply(
          "❌ Invalid phrase.",
          Markup.inlineKeyboard([
            [
              Markup.button.callback("⬅️ Back", "menu_banwords"),
              Markup.button.callback("❌ Close", "menu_close"),
            ],
          ]),
        );
      }

      try {
        await BanWord.create({ word: phrase });
        await ctx.reply(
          `✅ Phrase added:\n"${phrase}"`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback("⬅️ Back", "menu_banwords"),
              Markup.button.callback("❌ Close", "menu_close"),
            ],
          ]),
        );
      } catch (error) {
        if (error.code === 11000) {
          await ctx.reply(
            "⚠️ Phrase already exists.",
            Markup.inlineKeyboard([
              [
                Markup.button.callback("⬅️ Back", "menu_banwords"),
                Markup.button.callback("❌ Close", "menu_close"),
              ],
            ]),
          );
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
          Markup.inlineKeyboard([
            [
              Markup.button.callback("⬅️ Back", "menu_numbers"),
              Markup.button.callback("❌ Close", "menu_close"),
            ],
          ]),
        );
      }

      try {
        await NumberModel.create({ value: numberValue });
        await ctx.reply(
          `✅ Number ${numberValue} allowed.`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback("⬅️ Back", "menu_numbers"),
              Markup.button.callback("❌ Close", "menu_close"),
            ],
          ]),
        );
      } catch (error) {
        if (error.code === 11000) {
          await ctx.reply(
            "⚠️ This number is already allowed.",
            Markup.inlineKeyboard([
              [
                Markup.button.callback("⬅️ Back", "menu_numbers"),
                Markup.button.callback("❌ Close", "menu_close"),
              ],
            ]),
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
        return ctx.reply(
          "❌ Invalid Telegram ID.",
          Markup.inlineKeyboard([
            [
              Markup.button.callback("⬅️ Back", "menu_admins"),
              Markup.button.callback("❌ Close", "menu_close"),
            ],
          ]),
        );
      }

      try {
        await Admin.create({ telegramId: newId, role: "admin" });
        await ctx.reply(
          `✅ Admin ${newId} added.`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback("⬅️ Back", "menu_admins"),
              Markup.button.callback("❌ Close", "menu_close"),
            ],
          ]),
        );
      } catch (error) {
        if (error.code === 11000) {
          await ctx.reply(
            "⚠️ This user is already an admin.",
            Markup.inlineKeyboard([
              [
                Markup.button.callback("⬅️ Back", "menu_admins"),
                Markup.button.callback("❌ Close", "menu_close"),
              ],
            ]),
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
};

module.exports = { adminCommands };
