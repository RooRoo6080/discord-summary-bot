// OpenRouter API summarizer
export async function summarizeText(transcript, apiKey, modelName) {
  if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
    throw new Error('Please configure a valid OPENROUTER_API_KEY in your .env file.');
  }

  console.log(`Sending transcript to OpenRouter using model "${modelName}"...`);
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/reueljoseph/discord-channel-summary-bot',
      'X-Title': 'Discord Channel Summary Bot',
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes conversations. Write the summary as a cohesive, single paragraph of plain text (or a few short paragraphs if very long). Do NOT use any markdown formatting, bullet points, headers, bold text, or italics. Reply in paragraph format only with no markdown.'
        },
        {
          role: 'user',
          content: `Please summarize the following Discord messages:\n\n${transcript}`
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorData}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No summary could be generated.';
}
