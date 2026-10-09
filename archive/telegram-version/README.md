# DeskFlow — Telegram Edition Archive 🤖

> **Preserved Snapshot**: Complete Telegram Bot integration, 2FA via Telegram (@controllibrarybot), and Private Telegram Channel audit archiver.

## 📦 What is in this archive?
- **Full Bot Codebase (`bot/`)**:
  - `bot/index.js`: Express API + Grammy Telegram Bot implementation.
  - `bot/services/otp.js`: 4-digit token generation and dispatch to Telegram.
  - `bot/services/monthly_report.js`: Monthly PDF generation & channel dispatch.
  - `bot/services/db.js`: Supabase database queries & admin telegram chat bindings.
  - Database schema scripts for breaks, geofences, attendance, and admin tables.

## 🔀 Git Branch & Tag
This exact working state is also permanently preserved in Git:
- **Branch**: `telegram-edition`
- **Tag**: `v1.0.0-telegram-edition`

To switch to this version in Git at any time:
```bash
git checkout telegram-edition
```

To run the Telegram bot from this archive or branch:
```bash
cd bot
npm install
node index.js
```
