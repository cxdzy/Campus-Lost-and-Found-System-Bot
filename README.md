# Campus Lost & Found: Telegram Bot

The Telegram bot for **Campus Lost & Found**, a lost and found recovery system built for UiTM as the ITT626 Back-End Technology project. Students use this bot to report found items and to link their Telegram account to the web portal so they can receive match alerts.

The bot is a thin client. It collects the report from the student and hands everything to the Laravel back-end over HTTP. All storage, AI tagging, and matching happen in the back-end.

**Live portal:** https://campuslostfound.cxdzy.dev

## Related repository

| Repository | What it does |
| --- | --- |
| **This repo** | Telegram bot: guided found-item reporting and account linking |
| [Campus Lost and Found System (Laravel back-end and web portal)](https://github.com/cxdzy/REPLACE-WITH-MAIN-REPO-NAME) | API, database, Vision AI tagging, matching engine, student portal, security dashboard |

## What the bot does

- Guides a Finder through reporting a found item: category, photo with caption, then GPS location.
- Links a Telegram account to an existing web account using the student's matric number.
- Lets the student cancel a report at any point.

### What it does not do

This repo only handles messages coming in from students. It has no code for sending match alerts or claim OTPs. Those messages are sent by the Laravel back-end.

## Commands

| Command | Description |
| --- | --- |
| `/start` | Shows a welcome message and a short guide |
| `/found` | Starts the found-item report flow |
| `/link YOUR_MATRIC_NUMBER` | Links this Telegram account to a registered web account, for example `/link 2025181477` |
| `/cancel` | Cancels the current report and resets the session |

## Found-item flow

1. The student sends `/found`. The bot shows the category buttons.
2. The student taps a category. The bot asks for a photo and tells the student to put the item description in the photo caption.
3. The student sends the photo. The bot fetches the highest-resolution version, sends it to the back-end (`/api/bot/submit`), and replies "Item logged".
4. The bot asks the student to share their current location using Telegram's location attachment.
5. The student shares the location. The bot sends the coordinates to the back-end (`/api/bot/update-location`) and confirms the report is complete.

The item is created at step 3 and receives its coordinates at step 5. The AI analysis and matching then run on the back-end.

If the student sends a message that does not fit the current step, the bot replies with a reminder of what it is waiting for. A photo or location sent outside the flow is rejected with a prompt to run `/found` first.

## Categories

The category buttons use fixed IDs, so they must match the `categories` table in the back-end database.

| ID | Category | ID | Category |
| --- | --- | --- | --- |
| 1 | Others | 6 | Accessories |
| 2 | Electronics | 7 | Bags & Backpacks |
| 3 | Wallets | 8 | Clothing |
| 4 | Keys | 9 | Books |
| 5 | IDs | 10 | Stationery |

## Back-end API used

Every request is a JSON `POST` to the Laravel app and carries an `X-Bot-Secret` header.

| Endpoint | Sent by | Payload |
| --- | --- | --- |
| `/api/bot/link-account` | `/link` | `matric_number`, `telegram_chat_id` |
| `/api/bot/submit` | photo step | `image_url`, `caption`, `telegram_chat_id`, `category_id` |
| `/api/bot/update-location` | location step | `latitude`, `longitude`, `found_item_id` |

The `submit` response must contain the new item's `id`. The bot keeps it in the session and sends it back with the location.

## Tech stack

| Part | Version |
| --- | --- |
| Node.js | 18 or newer (the bot uses the built-in `fetch`) |
| [Telegraf](https://telegraf.js.org/) | ^4.16.3 |
| dotenv | ^17.4.2 |
| pg | ^8.21.0 (listed in `package.json` but not used by `bot.js`) |

The bot uses long polling (`bot.launch()`), so it does not need a public URL or a webhook.

## Getting started

### Prerequisites

- Node.js 18 or newer
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- A running instance of the Laravel back-end, with the bot secret configured on it

### Install and run

```bash
git clone https://github.com/cxdzy/Campus-Lost-and-Found-System-Bot.git
cd Campus-Lost-and-Found-System-Bot
npm install
```

Create a `.env` file in the project root:

```env
TELEGRAM_BOT_TOKEN=
LARAVEL_APP_URL=
LARAVEL_BOT_SECRET=
```

Start the bot:

```bash
npm start
```

`npm start` runs `node --dns-result-order=ipv4first bot.js`. The flag makes Node prefer IPv4 addresses when resolving hostnames.

### Environment variables

| Variable | Description |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Token issued by BotFather |
| `LARAVEL_APP_URL` | Base URL of the back-end without a trailing slash, for example `https://campuslostfound.cxdzy.dev` |
| `LARAVEL_BOT_SECRET` | Shared secret sent in the `X-Bot-Secret` header. It must match the value configured on the back-end |

`.env` is listed in `.gitignore`. Never commit it.

## Deployment

There is no Dockerfile in this repo. The bot is a single Node.js process, so any host that can run `npm start` and reach both Telegram and the back-end over HTTPS will work. It runs as its own process, separate from the Laravel app.

## Project structure

```
.
├── bot.js            # All bot logic: commands, session handling, API calls
├── package.json
├── package-lock.json
└── .gitignore
```

## Known limitations

- **Sessions are kept in memory.** A restart clears every in-progress report, and only one bot instance can run at a time.
- **No session timeout.** A report stays open until the student finishes it, sends `/cancel`, or the process restarts.
- **Reports can be left without coordinates.** The item is saved when the photo arrives, so a student who never shares a location leaves an item without GPS data.
- **Category IDs are hard-coded** in `bot.js` and must be kept in sync with the back-end by hand.
- **The `pg` dependency is unused** and can be removed.
- **No automated tests.**

## Course information

- **Subject:** ITT626 Back-End Technology
- **Institution:** Universiti Teknologi MARA (UiTM)
- **Lecturer:** Idayati Mazlan
- **Author:** Mohamad Haziq Naqib Bin Zaid (2025181477)
