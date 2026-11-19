# UPM Admin Bot

UPM Admin Bot is a Telegram moderation bot built for managing group safety, spam control, and admin workflow. It monitors incoming messages, filters suspicious content, and provides an in-chat admin dashboard for managing bans and exceptions.

## What it does

- Detects repeated spam patterns in group chats
- Blocks banned words in messages and member names
- Checks new members' names for banned words and suspicious numbers
- Allows trusted phone numbers and contacts
- Detects coded or obfuscated text attempts
- Verifies admin privileges for moderation actions
- Exposes a private `/admin` panel for admins to manage rules
- Supports both local polling mode and production webhook mode

## Features

- 🛡️ Multi-step moderation pipeline
- 🚫 Ban word management
- 📞 Allowed number management
- 👥 Admin and super-admin roles
- 🧹 Spam detection and automatic actions
- 🔔 Notifications sent to super-admins when a user is banned
- 🆔 Quick Telegram ID lookup with `id` in private chat
- 🔐 Private admin panel accessible with `/admin`
- 🌐 Webhook mode for deployment and polling mode for local development

## Requirements

- Node.js 20+
- MongoDB
- Telegram Bot Token

## Environment variables

Create a `.env` file in the project root:

```env
BOT_TOKEN=your_telegram_bot_token
MONGO_URI=mongodb://localhost:27017/upm-admin
NODE_ENV=development
PORT=3000

# Required when NODE_ENV=production
WEBHOOK_BASE_URL=https://your-domain.com

# Optional: protects the webhook endpoint when configured
WEBHOOK_SECRET=your_random_secret
```

## Installation

1. Install dependencies:

```bash
npm install
```

2. Configure the super-admin account.

Set `SUPER_ADMIN_ID` in `src/admin/addAdmin.js` to your Telegram user ID, then run:

```bash
node --env-file=.env src/admin/addAdmin.js
```

This creates the super-admin record in MongoDB if it does not already exist.

3. Start the bot:

```bash
npm start
```

If `NODE_ENV` is not set to `production`, the app runs with Telegram polling mode by default.

## Production deployment

For Render, Railway, Fly.io, or similar hosting:

1. Push the project to GitHub.
2. Create a new app/service.
3. Set build and start commands:
   - Build: `npm install`
   - Start: `npm start`
4. Add environment variables:
   - `BOT_TOKEN`
   - `MONGO_URI`
   - `NODE_ENV=production`
   - `WEBHOOK_BASE_URL=https://your-app.example.com`
   - `WEBHOOK_SECRET=some-random-secret` (recommended)
5. Deploy.

In production, the bot registers a Telegram webhook at
`<WEBHOOK_BASE_URL>/telegram-webhook`. If `WEBHOOK_SECRET` is set, requests
without the matching Telegram secret-token header are rejected.

## Moderation flow

Group messages are processed in this order:

- checks for newly joined members
- checks the sender's name
- checks message text and captions for banned words
- spam detection
- checks for unallowed phone numbers
- coded-message detection
- checks shared contacts for unallowed numbers

## Admin commands

Run `/admin` in a private chat with an authorized admin account.

Useful commands and behavior:

- `/admin` — open the private admin panel
- Send `id` (without a slash) in a private chat — return your Telegram user ID
- Super-admins receive notification messages when a user is banned for spam, banned words, unallowed numbers, or other moderation reasons
- The admin panel supports:
  - Add/remove banned words
  - Add/remove allowed numbers
  - View current rules and stats
  - Manage admin users (super-admin only)
  - Browse lists with pagination

## Project structure

```text
src/
├── admin/
│   ├── addAdmin.js
│   └── adminCommands.js
├── config/
│   └── db.js
├── middleware/
│   ├── checkNewMembers.js
│   ├── allowedContact.js
│   ├── allowedNumbers.js
│   ├── checkUserName.js
│   ├── isMessageCoded.js
│   ├── readMessagesAndDelete.js
│   └── spamHandler.js
├── models/
│   ├── Admin.js
│   ├── BanWord.js
│   └── Number.js
├── normalization/
│   ├── matchNumber.js
│   ├── matchesBannedWord.js
│   ├── normalizeNumber.js
│   └── normalizedText.js
├── services/
│   └── banService.js
├── index.js
└── server.js
```

## Notes

- The project uses MongoDB for storing banned words, allowed numbers, and admin records.
- Telegram private admin panel actions are controlled through the `Admin` model and role checks.
- For local development, `BOT_TOKEN` and `MONGO_URI` are enough to run the bot in polling mode. `PORT` defaults to `3000`.

## License

[MIT License](LICENSE)
