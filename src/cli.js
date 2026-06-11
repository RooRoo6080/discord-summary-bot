// Helper to parse arguments
export function parseArgs() {
  const args = process.argv.slice(2);
  let channelId = null;
  let guildId = null;
  let hours = null;
  let forceLogin = false;
  let modelName = 'openrouter/free';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--channel-id' || args[i] === '-c') {
      channelId = args[++i];
    } else if (args[i] === '--guild-id' || args[i] === '-g') {
      guildId = args[++i];
    } else if (args[i] === '--hours' || args[i] === '-h') {
      hours = parseFloat(args[++i]);
    } else if (args[i] === '--login') {
      forceLogin = true;
    } else if (args[i] === '--model' || args[i] === '-m') {
      modelName = args[++i];
    } else if (args[i] === '--help') {
      console.log(`
Usage: node summary-bot.js [options]

Options:
  -c, --channel-id <id>  Discord Channel ID (Optional if -g is specified)
  -g, --guild-id <id>    Discord Guild (Server) ID (Optional, defaults to '@me' for DMs if -c is provided)
  -h, --hours <number>   Number of hours of history to summarize (Optional)
  -m, --model <name>     OpenRouter model name (Optional, defaults to openrouter/free)
  --login                Force open browser to log in and save session
  --help                 Show this help message
`);
      process.exit(0);
    }
  }

  if (!channelId && !guildId && !forceLogin) {
    console.error('Error: Either --channel-id or --guild-id (or both) is required. Run with --help for options.');
    process.exit(1);
  }

  // If channelId is provided but guildId is not, default guildId to '@me'
  if (channelId && !guildId) {
    guildId = '@me';
  }

  return { channelId, guildId, hours, forceLogin, modelName };
}
