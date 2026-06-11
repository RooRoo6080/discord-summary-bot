import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { parseArgs } from './src/cli.js';
import { processChannel } from './src/channel.js';

dotenv.config();

async function main() {
  const { channelId, guildId, hours, forceLogin, modelName } = parseArgs();
  
  const userDataDir = path.resolve('.discord-session');
  const hasSession = fs.existsSync(userDataDir) && fs.readdirSync(userDataDir).length > 0;
  
  const headless = !forceLogin && hasSession;
  console.log(`Launching browser (headless: ${headless})...`);
  
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  
  const page = context.pages()[0] || await context.newPage();
  
  // Navigate and authenticate if needed
  if (forceLogin || !hasSession) {
    await page.goto('https://discord.com/login');
    console.log('\n==================================================================');
    console.log('Action Required: Please log in to Discord in the browser window.');
    console.log('Once you are logged in and see the main app, you can close the browser or press Enter.');
    console.log('The script will detect when you reach the app URL and save the session.');
    console.log('==================================================================\n');
    
    try {
      await page.waitForURL('**/channels/**', { timeout: 180000 });
      console.log('Successfully logged in!');
      await page.waitForTimeout(3000);
    } catch (err) {
      console.error('Login timeout or error. Closing browser.');
      await context.close();
      process.exit(1);
    }
    
    if (forceLogin && !channelId && !guildId) {
      console.log('Login-only run completed. Session saved successfully.');
      await context.close();
      process.exit(0);
    }
  }
  
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (channelId) {
    // Single channel mode
    await processChannel(page, guildId, channelId, hours, modelName, apiKey, false);
  } else {
    // Guild-only mode (process all unread text channels in the guild)
    const targetUrl = `https://discord.com/channels/${guildId}`;
    console.log(`Navigating to guild: ${targetUrl}...`);
    await page.goto(targetUrl);
    
    // Check if we got redirected to login
    if (page.url().includes('/login')) {
      console.error('Error: Session expired or invalid. Please re-run the script with --login to authenticate.');
      await context.close();
      process.exit(1);
    }

    console.log('Waiting for sidebar channel list...');
    try {
      await page.waitForSelector('a[href^="/channels/"]', { timeout: 20000 });
      // Wait another 3s to let state/icons settle
      await page.waitForTimeout(3000);
    } catch (err) {
      console.error('Error: Failed to load channel sidebar list. Do you have access to this guild?');
      await context.close();
      process.exit(1);
    }

    console.log('Scanning sidebar for unread text channels...');
    const unreadChannels = await page.evaluate((guildId) => {
      const links = Array.from(document.querySelectorAll(`a[href^="/channels/${guildId}/"]`));
      
      const unreads = [];
      for (const link of links) {
        // Check if it's a text channel or announcement channel
        const ariaLabel = link.getAttribute('aria-label') || '';
        const isText = ariaLabel.includes('(text channel)') || ariaLabel.includes('(announcement channel)');
        if (!isText) continue;
        
        // Find the direct LI container
        let li = link;
        while (li && li.tagName !== 'LI' && li.tagName !== 'BODY') {
          li = li.parentElement;
        }
        if (!li || li.tagName !== 'LI') continue;
        
        // Check for unread indicators strictly inside this LI channel container
        const hasUnreadClass = !!li.querySelector('[class*="modeUnread"]') || 
                               !!li.querySelector('[class*="modeUnreadImportant"]') || 
                               !!li.querySelector('[class*="unread__"]');
        
        if (hasUnreadClass) {
          const nameEl = link.querySelector('[class*="name"]') || link;
          const channelId = link.getAttribute('href').split('/').pop();
          unreads.push({
            channelId,
            channelName: nameEl ? nameEl.textContent.trim() : 'unknown'
          });
        }
      }
      return unreads;
    }, guildId);

    if (unreadChannels.length === 0) {
      console.log('No unread messages in any text channels in this guild.');
    } else {
      console.log(`Found ${unreadChannels.length} unread text channel(s): ${unreadChannels.map(c => `#${c.channelName}`).join(', ')}`);
      for (const channel of unreadChannels) {
        console.log(`\n==================================================`);
        console.log(`Summarizing channel: #${channel.channelName}`);
        console.log(`==================================================`);
        await processChannel(page, guildId, channel.channelId, hours, modelName, apiKey, true);
      }
    }
  }

  await context.close();
}

main().catch(console.error);
