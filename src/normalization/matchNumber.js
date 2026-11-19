const { normalizeNumber } = require("./normalizeNumber");

const canonicalNumber = (value) => normalizeNumber(value).replace(/^0+/, "");

const MIN_SUFFIX = 9;

const numbersMatch = (candidate, allowed) => {
  const c = canonicalNumber(candidate);
  const a = canonicalNumber(allowed);

  if (!c || !a) return false;
  if (c === a) return true;
  if (a.length < MIN_SUFFIX || c.length < MIN_SUFFIX) return false;

  return c.slice(-MIN_SUFFIX) === a.slice(-MIN_SUFFIX);
};

const containsAllowedNumber = (candidate, allowedSet) => {
  for (const allowed of allowedSet) {
    if (numbersMatch(candidate, allowed)) return true;
  }
  return false;
};

module.exports = { numbersMatch, containsAllowedNumber, canonicalNumber };
