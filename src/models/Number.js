const mongoose = require("mongoose");

const NumberSchema = new mongoose.Schema(
  {
    value: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Number", NumberSchema);
