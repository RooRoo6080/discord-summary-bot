import { extractRawItems, processGroupedMessages } from './scraper.js';
import { summarizeText } from './summarizer.js';

// Process a single channel
export async function processChannel(page, guildId, channelId, hours, modelName, apiKey, isMultiChannel = false) {
  const targetUrl = `https://discord.com/channels/${guildId}/${channelId}`;
  if (isMultiChannel) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Processing Channel ID: ${channelId}`);
    console.log(`--------------------------------------------------`);
  } else {
    console.log(`Navigating to channel: ${targetUrl}...`);
  }

  await page.goto(targetUrl);
  
  // Check if we got redirected to login
  if (page.url().includes('/login')) {
    console.error('Error: Session expired or invalid. Please re-run the script with --login to authenticate.');
    return { error: 'session_expired' };
  }
  
  console.log('Waiting for channel messages to load...');
  try {
    await page.waitForSelector('ol[data-list-id="chat-messages"], ol[role="list"], [class*="messagesWrapper"]', { timeout: 15000 });
  } catch (err) {
    console.error('Warning: Message history failed to load for this channel.');
    return { error: 'load_failed' };
  }
  
  console.log('Scrolling and gathering messages...');
  let scrollCount = 0;
  let consecutiveMatches = 0;
  let lastOldestId = null;
  let parsedMessages = [];
  
  const cutoffTime = hours ? new Date(Date.now() - hours * 60 * 60 * 1000) : null;
  
  while (true) {
    const rawItems = await extractRawItems(page);
    parsedMessages = processGroupedMessages(rawItems);
    
    if (parsedMessages.length === 0) {
      console.log('No messages visible in the DOM. Waiting...');
      await page.waitForTimeout(2000);
      continue;
    }
    
    const oldestMessage = parsedMessages.find(m => m.type === 'message');
    const hasUnreadDivider = parsedMessages.some(m => m.type === 'divider' && m.text === 'New Messages');
    
    // Evaluate stopping criteria
    if (hours && oldestMessage && oldestMessage.timestamp) {
      const oldestTime = new Date(oldestMessage.timestamp);
      if (oldestTime <= cutoffTime) {
        console.log(`Oldest message loaded is from ${oldestTime.toLocaleString()}, which is older than the required ${hours} hours.`);
        break;
      }
    } else if (!hours) {
      if (hasUnreadDivider) {
        console.log('Found the "New Messages" unread divider.');
        break;
      }
    }
    
    // Get the DOM ID of the current first message element
    const currentOldestId = await page.evaluate(() => {
      const firstMsg = document.querySelector('li[id^="chat-messages-"]') || document.querySelector('li[class*="messageListItem"]');
      return firstMsg ? firstMsg.id : null;
    });
    
    if (currentOldestId === lastOldestId) {
      consecutiveMatches++;
      if (consecutiveMatches >= 4) {
        console.log('Reached the very top of the channel history.');
        break;
      }
    } else {
      consecutiveMatches = 0;
      lastOldestId = currentOldestId;
    }
    
    scrollCount++;
    if (!isMultiChannel) {
      process.stdout.write(`\rScrolled up ${scrollCount} times...`);
    }
    
    // Scroll scroller container to top to trigger older message loads
    await page.evaluate(() => {
      const container = document.querySelector('ol[data-list-id="chat-messages"]') || 
                        document.querySelector('ol[role="list"]') || 
                        document.querySelector('[class*="messagesWrapper"] ol');
      if (container && container.parentElement) {
        container.parentElement.scrollTop = 0;
      }
    });
    
    await page.waitForTimeout(1500);
  }
  
  // Filter messages based on requirements
  let finalMessages = [];
  if (hours && cutoffTime) {
    finalMessages = parsedMessages.filter(m => m.type === 'message' && m.timestamp && new Date(m.timestamp) >= cutoffTime);
  } else {
    // Unread messages: find the "New Messages" divider and take all messages AFTER it
    const dividerIndex = parsedMessages.findIndex(m => m.type === 'divider' && m.text === 'New Messages');
    if (dividerIndex !== -1) {
      finalMessages = parsedMessages.slice(dividerIndex + 1).filter(m => m.type === 'message');
    } else {
      console.log('No new messages');
      return { status: 'no_new_messages' };
    }
  }
  
  if (finalMessages.length === 0) {
    console.log('No messages found to summarize.');
    return { status: 'empty' };
  }
  
  console.log(`Found ${finalMessages.length} messages to summarize.`);
  
  // Format the transcript (only include the message text, excluding usernames and timestamps)
  const transcript = finalMessages
    .map(m => m.content)
    .filter(Boolean)
    .join('\n');
  
  // Summarize
  try {
    const summary = await summarizeText(transcript, apiKey, modelName);
    console.log('\n=========================================');
    console.log('                SUMMARY');
    console.log('=========================================');
    console.log(summary);
    console.log('=========================================\n');
    return { status: 'success', summary };
  } catch (error) {
    console.error(`Error summarizing messages: ${error.message}`);
    return { error: 'summary_failed', transcript };
  }
}
