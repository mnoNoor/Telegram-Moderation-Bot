const escapeRegex = (text) =>
  String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const matchesBannedWord = (normalizedText, word) => {
  if (!word) return false;

  if (/^[a-z0-9]+$/i.test(word)) {
    const re = new RegExp(`(?<![a-z0-9])${escapeRegex(word)}(?![a-z0-9])`, "i");
    return re.test(normalizedText);
  }

  return normalizedText.includes(word);
};

module.exports = { matchesBannedWord };
