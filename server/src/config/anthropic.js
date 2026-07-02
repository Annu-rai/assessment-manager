import Anthropic from '@anthropic-ai/sdk';

/**
 * Central Anthropic Claude client (Module 5/6 — AI features).
 *
 * The API key comes from ANTHROPIC_API_KEY. When it isn't set, AI features are
 * disabled gracefully rather than crashing the server, so the rest of the app
 * keeps working without a key.
 */

// Default to Claude Opus 4.8; override with ANTHROPIC_MODEL if desired.
export const AI_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

export const isAIEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client = null;

// Lazily construct the client so a missing key never throws at import time.
export function getClient() {
  if (!isAIEnabled()) return null;
  if (!client) {
    client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  }
  return client;
}
