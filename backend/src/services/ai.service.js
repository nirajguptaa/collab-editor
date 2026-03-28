/**
 * AI Autocomplete Service
 * Supports Anthropic Claude (default) or OpenAI.
 * Called via REST — POST /api/rooms/:slug/ai/complete
 */

async function getCompletion({ code, language, cursorPosition, prefix, suffix }) {
  const provider = process.env.AI_PROVIDER || 'anthropic';

  const prompt = buildPrompt({ code, language, cursorPosition, prefix, suffix });

  if (provider === 'anthropic') return anthropicComplete(prompt);
  if (provider === 'openai')    return openaiComplete(prompt);
  throw new Error(`Unknown AI provider: ${provider}`);
}

function buildPrompt({ language, prefix, suffix }) {
  return `You are a code autocomplete engine. Complete the code at the cursor position.
Language: ${language}

Code before cursor:
\`\`\`${language}
${prefix}
\`\`\`

Code after cursor:
\`\`\`${language}
${suffix}
\`\`\`

Respond with ONLY the completion text to insert at the cursor. No explanation, no markdown, no backticks. Just the raw code continuation.`;
}

async function anthropicComplete(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', // fast + cheap for autocomplete
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text?.trim() || '';
}

async function openaiComplete(prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI API error: ${res.statusText}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

module.exports = { getCompletion };
