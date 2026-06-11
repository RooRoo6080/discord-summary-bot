// Function to extract messages and dividers in order
export async function extractRawItems(page) {
  return await page.evaluate(() => {
    const container = document.querySelector('ol[data-list-id="chat-messages"]') || 
                      document.querySelector('ol[role="list"]') || 
                      document.querySelector('[class*="messagesWrapper"] ol');
    if (!container) return [];
    
    const children = Array.from(container.children);
    return children.map(el => {
      // Check for unread divider
      const isUnreadDivider = el.id === '---new-messages-bar' || 
                              (el.getAttribute('role') === 'separator' && el.matches('[class*="isUnread"]'));
      if (isUnreadDivider) {
        return { type: 'divider', text: 'New Messages' };
      }
      
      // Check for message item
      const isMessage = el.tagName === 'LI' && (el.id.startsWith('chat-messages-') || el.matches('[class*="messageListItem"]'));
      if (isMessage) {
        // Username
        const usernameEl = el.querySelector('[class*="username"]');
        const username = usernameEl ? usernameEl.textContent.trim() : null;
        
        // Timestamp
        const timeEl = el.querySelector('time');
        const timestamp = timeEl ? timeEl.getAttribute('datetime') : null;
        const readableTime = timeEl ? timeEl.textContent.trim() : '';
        
        // Content
        const contentEl = el.querySelector('[class*="messageContent"]');
        const content = contentEl ? contentEl.textContent.trim() : '';
        
        return {
          type: 'message',
          username,
          timestamp,
          readableTime,
          content
        };
      }
      return null;
    }).filter(Boolean);
  });
}

// Process raw items to reconstruct full grouped messages
export function processGroupedMessages(rawItems) {
  let currentAuthor = 'Unknown';
  let currentTimestamp = null;
  let currentReadableTime = '';
  
  const parsed = [];
  for (const item of rawItems) {
    if (item.type === 'divider') {
      parsed.push(item);
      continue;
    }
    
    if (item.type === 'message') {
      if (item.username) {
        currentAuthor = item.username;
        currentTimestamp = item.timestamp;
        currentReadableTime = item.readableTime;
      }
      
      parsed.push({
        type: 'message',
        username: currentAuthor,
        timestamp: item.timestamp || currentTimestamp,
        readableTime: item.readableTime || currentReadableTime,
        content: item.content
      });
    }
  }
  return parsed;
}
