const NumberModel = require("../models/Number");
const { normalizeNumber } = require("../normalization/normalizeNumber");
const { banUser } = require("../services/banService");

const isGroup = (ctx) =>
  ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";

const punish = async (ctx, normalizedPhone) => {
  await banUser(ctx, {
    reason: "unallowed_contact",
    matchedNumber: normalizedPhone,
  });
};

const checkContactNumber = async (ctx) => {
  const phone = ctx.message?.contact?.phone_number;
  if (!phone) return false;

  const normalized = normalizeNumber(phone);

  const allowed = await NumberModel.find();
  const allowedSet = new Set(
    allowed.map((n) => normalizeNumber(n.value.toString())),
  );

  if (!allowedSet.has(normalized)) {
    await punish(ctx, normalized);
    return true;
  }

  return false;
};

const isAllowedContact = async (ctx, next) => {
  if (!isGroup(ctx)) return next();

  if (await checkContactNumber(ctx)) return;

  await next();
};

module.exports = { isAllowedContact };
