import { getClient, AI_MODEL } from '../config/anthropic.js';

/**
 * AI Insights (Module 16).
 *
 * Takes pre-computed org analytics (pass rate, average score, weak categories,
 * per-assessment performance) and asks Claude to turn the numbers into a short
 * plain-English narrative: a summary, ranked insights, and recommendations.
 */

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    insights: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['title', 'detail', 'severity'],
      },
    },
    recommendations: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'insights', 'recommendations'],
};

const SYSTEM_PROMPT = `You are a talent-analytics advisor for an assessment platform.
You are given aggregate statistics for an organization's assessments.
Write a concise, decision-useful analysis:
- summary: 1-2 sentences on overall performance.
- insights: 3-5 specific findings. Call out weak topics/categories (low average %), strong areas, and pass-rate concerns. Set severity by how much it needs attention.
- recommendations: 2-4 concrete, actionable next steps (e.g. targeted training on a weak topic).
Reference concrete numbers from the data. Do not invent data that isn't provided.`;

export async function generateInsights(stats) {
  const anthropic = getClient();
  if (!anthropic) {
    const err = new Error('AI is not configured (missing ANTHROPIC_API_KEY)');
    err.statusCode = 503;
    throw err;
  }

  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Here is the organization's assessment data as JSON:\n\n${JSON.stringify(stats, null, 2)}\n\nProduce the analysis in the required format.`,
      },
    ],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('AI returned no content');
  try {
    return JSON.parse(textBlock.text);
  } catch {
    throw new Error('AI returned malformed JSON');
  }
}
