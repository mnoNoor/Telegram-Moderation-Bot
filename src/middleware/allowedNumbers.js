const NumberModel = require("../models/Number");
const { normalizeNumber } = require("../normalization/normalizeNumber");
const { containsAllowedNumber } = require("../normalization/matchNumber");
const { banUser } = require("../services/banService");

const getMessageText = (ctx) => ctx.message?.text ?? ctx.message?.caption;

const stripUrls = (text) =>
  text
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\bwww\.\S+/gi, " ")
    .replace(/\b(wa\.me|t\.me|telegram\.me|whatsapp\.com)\/\S*/gi, " ")
    .replace(
      /\b[a-z0-9-]+\.(?:com|net|org|io|me|ly|co|info|xyz|app|dev|tk|gg|to|link|site|online)(?:\/\S*)?/gi,
      " ",
    );

// ASCII digits: 0-9
const convertDigits = (text) =>
  text
    .replace(/[٠-٩]/g, (d) =>
      String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48),
    )
    .replace(/[۰-۹]/g, (d) =>
      String.fromCharCode(d.charCodeAt(0) - 0x06f0 + 48),
    );

const SEPARATOR_CLASS =
  "[\\s.\\-_/\\\\|·•*~^`'\"`,;:()\\u200B-\\u200F\\u202A-\\u202E]";

const collapseSeparatorsBetweenDigits = (text) => {
  const re = new RegExp(`([0-9])${SEPARATOR_CLASS}+(?=[0-9])`, "g");
  return text.replace(re, "$1");
};

// Global regex to match phone numbers in various formats
const COUNTRY_CODES = [
  "966",
  "963",
  "971",
  "962",
  "965",
  "964",
  "968",
  "967",
  "974",
  "973",
  "961",
  "970",
  "212",
  "213",
  "216",
  "218",
  "249",
];

const PHONE_REGEX = new RegExp(
  [
    // +966501234567
    `(?<![0-9])\\+[0-9]{7,15}(?![0-9])`,
    // 00966501234567
    `(?<![0-9])00[0-9]{7,13}(?![0-9])`,
    // 0501234567 / 0112345678
    `(?<![0-9])0[0-9]{9,10}(?![0-9])`,
    // 966501234567 / 963912345678
    `(?<![0-9])(?:${COUNTRY_CODES.join("|")})[1-9][0-9]{6,9}(?![0-9])`,
  ].join("|"),
  "g",
);

const extractPhoneNumbers = (line) => {
  const collapsed = collapseSeparatorsBetweenDigits(line);
  const matches = collapsed.match(PHONE_REGEX) || [];
  return matches.map((m) => normalizeNumber(m));
};

const isAllowedNumber = async (ctx, next) => {
  const text = getMessageText(ctx);
  if (!text) return next();

  const isGroupChat =
    ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
  if (!isGroupChat) return next();

  const cleaned = convertDigits(stripUrls(text));

  const phoneNumbers = cleaned.split(/\r?\n/).flatMap(extractPhoneNumbers);

  if (phoneNumbers.length === 0) return next();

  const allowed = await NumberModel.find();
  const allowedSet = new Set(
    allowed.map((n) => normalizeNumber(n.value.toString())),
  );

  for (const seq of phoneNumbers) {
    if (containsAllowedNumber(seq, allowedSet)) continue;

    await banUser(ctx, {
      reason: "unallowed_number",
      matchedNumber: seq,
    });
    return;
  }

  await next();
};

module.exports = { isAllowedNumber };
