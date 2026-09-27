const normalizeNumber = (text) => {
  return String(text ?? "")
    .replace(/[٠-٩]/g, (d) =>
      String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48),
    )
    .replace(/[۰-۹]/g, (d) =>
      String.fromCharCode(d.charCodeAt(0) - 0x06f0 + 48),
    )
    .replace(/\D/g, "");
};

module.exports = { normalizeNumber };
