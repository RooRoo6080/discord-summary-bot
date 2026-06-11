# Discord Channel Summary Bot
A CLI tool that uses Playwright to navigate to a Discord channel, scrape message history, and summarize the conversation.

## Technical Details
To bypass CAPTCHAs, Multi-Factor Authentication (MFA), and bot detection, this tool utilizes **Playwright's Persistent Browser Context**. 
- On the first run (or when using the `--login` flag), the script launches a **headed browser** where you manually log in.
- Your session is securely stored in a local `.discord-session` directory.
- Subsequent runs execute in **headless mode** (completely in the background) using your saved session.

---

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **NPM** (normally comes with Node.js)

---

## Installation

1. Clone or copy this project to your local machine.
2. In the project folder, install the dependencies:
   ```bash
   npm install
   ```
3. Install the Playwright Chromium browser:
   ```bash
   npx playwright install chromium
   ```

---

## Configuration

1. Copy the template environment file:
   ```bash
   cp .env.template .env
   ```
2. Open the `.env` file and replace `your_openrouter_api_key_here` with your actual OpenRouter API Key.
   * You can get a free key by signing up at [OpenRouter](https://openrouter.ai/).

---

## How to Use

### 1. Perform Initial Login
Before running summaries, you must save your Discord login session:
```bash
node summary-bot.js --login
```
A Chromium browser window will open. **Log in to Discord manually.** Once you reach the main Discord dashboard/channels interface, the script will automatically detect the success state, save the session, and exit.

---

### 2. Summarize Messages

To summarize messages, you need:
- **Channel ID**: Right-click a channel in Discord and select **Copy Channel ID**.
- **Guild ID**: Right-click the server icon and select **Copy Server ID**.

#### Option A: Summarize all unread messages in a single channel (Default)
By default, the script looks for Discord's red "New Messages" unread divider, extracts every message below it, and summarizes them. **If no unread divider is found, it will print "No new messages" and exit early without calling the AI.**
```bash
node summary-bot.js -c <CHANNEL_ID> -g <GUILD_ID>
```

#### Option B: Guild Scan Mode (Summarize all unread channels in a Server)
If you provide **only the Guild ID** (omitting `-c` / `--channel-id`), the script will automatically scan your sidebar. It identifies any text/announcement channels with active unread indicators (white highlight/unreads) and sequentially processes and summarizes only those channels:
```bash
node summary-bot.js -g <GUILD_ID>
```

#### Option C: Summarize the last N hours of messages
Use the `-h` or `--hours` flag to specify how many hours of history to summarize:
```bash
node summary-bot.js -c <CHANNEL_ID> -g <GUILD_ID> -h 3
```

#### Option D: Customize the OpenRouter model
By default, the script uses the free `openrouter/free` model. You can specify another model using the `-m` or `--model` flag:
```bash
node summary-bot.js -c <CHANNEL_ID> -g <GUILD_ID> -h 2 -m meta-llama/llama-3-8b-instruct:free
```

---

## Command Line Options

| Flag | Long Flag | Description | Default |
|---|---|---|---|
| `-c` | `--channel-id` | Discord Channel ID (Optional if `-g` is provided) | None |
| `-g` | `--guild-id` | Discord Guild (Server) ID | `@me` (DMs) if `-c` is set |
| `-h` | `--hours` | Number of hours of history to summarize | Default: Unread messages only |
| `-m` | `--model` | OpenRouter model to use for summarization | `openrouter/free` |
| | `--login` | Force open browser to login manually and save session | None |
| | `--help` | Show the help message | None |
