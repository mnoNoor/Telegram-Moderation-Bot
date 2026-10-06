# UPM Admin Bot

UPM Admin Bot is a Telegram moderation bot for managing group safety and admin operations. It helps detect spam, banned phrases, unauthorized numbers, coded messages, and contact-based abuse, while giving admins a private dashboard to manage moderation rules.

## Features

- 🛡️ Multi-layer moderation checks
- 🚫 Banned word management
- 📞 Allowed-number management
- 🤖 Admin and super-admin roles
- 🧹 Spam and suspicious message handling
- 🔐 Private admin panel via `/admin`
- 🌐 Production webhook support and local polling mode

## Requirements

- Node.js
- MongoDB
- Telegram Bot Token

## Environment Variables

Create a `.env` file in the project root:

```env
BOT_TOKEN=your_telegram_bot_token
MONGO_URI=mongodb://localhost:27017/upm-admin
NODE_ENV=development
PORT=3000

# Optional for production webhook mode
WEBHOOK_BASE_URL=https://your-domain.com
WEBHOOK_SECRET=your_secret_token
```

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create the super-admin user by setting your Telegram user ID in the script and running:

```bash
node --env-file=.env src/admin/addAdmin.js
```

3. Start the bot:

```bash
npm start
```

When `NODE_ENV` is not set to `production`, the bot runs in polling mode by default.

## Production Deployment

For Render or any similar hosting platform:

1. Push the project to GitHub.
2. Create a new Web Service.
3. Configure:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Add environment variables:
   - `BOT_TOKEN`
   - `MONGO_URI`
   - `NODE_ENV=production`
   - `WEBHOOK_BASE_URL=https://your-app.onrender.com`
   - `WEBHOOK_SECRET=some-random-secret`
5. Deploy.

The app will set Telegram webhook automatically in production mode.

## Moderation Flow

Incoming messages pass through the moderation pipeline in this order:

- message reading / cleanup
- spam detection
- allowed-number checks
- coded-message detection
- allowed-contact checks

## Admin Commands

- `/admin` — open the admin panel in a private chat
- Keyboard actions for:
  - add/remove banned words
  - add/remove allowed numbers
  - list current rules
  - manage admin users
  - view basic stats

## Project Structure

```text
src/
├── admin/
│   ├── addAdmin.js
│   └── adminCommands.js
├── config/
│   └── db.js
├── middleware/
├── models/
├── normalization/
├── index.js
├── server.js
└── ...
```

## License

[MIT License](LICENSE)
