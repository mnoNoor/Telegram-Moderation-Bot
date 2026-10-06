const mongoose = require("mongoose");
const Admin = require("../models/Admin.js");

const mongoUri = process.env.MONGO_URI;

const SUPER_ADMIN_ID = 6250327483;

mongoose
  .connect(mongoUri)
  .then(async () => {
    console.log("MongoDB connected");

    const exists = await Admin.findOne({ telegramId: SUPER_ADMIN_ID });
    if (exists) {
      console.log("SuperAdmin already exists!");
    } else {
      await Admin.create({ telegramId: SUPER_ADMIN_ID, role: "superAdmin" });
      console.log(`SuperAdmin ${SUPER_ADMIN_ID} created!`);
    }

    mongoose.disconnect();
  })
  .catch(console.error);
