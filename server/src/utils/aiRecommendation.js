import { getClient, AI_MODEL } from '../config/anthropic.js';

/**
 * AI Recommendation Engine (Module 38).
 *
 * Given a candidate's assessment performance by topic, Claude suggests suitable
 * role(s) with reasoning + confidence, plus strengths and gaps. Structured
 * output keeps the result machine-readable.
 */
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    suggestedRoles: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role: { type: 'string' },
          reason: { type: 'string' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['role', 'reason', 'confidence'],
      },
    },
    strengths: { type: 'array', items: { type: 'string' } },
    gaps: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'suggestedRoles', 'strengths', 'gaps'],
};

const SYSTEM_PROMPT = `You are a technical recruiting advisor.
Given a candidate's assessment performance (overall and by topic/category), recommend
1-3 suitable job roles with a short reason and a confidence level, and list concrete
strengths and skill gaps. Base every claim on the numbers provided — do not invent data.
If data is thin, say so and lower confidence.`;

export async function generateRecommendation(stats) {
  const anthropic = getClient();
  if (!anthropic) {
    const err = new Error('AI is not configured (missing ANTHROPIC_API_KEY)');
    err.statusCode = 503;
    throw err;
  }

  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Candidate performance data (JSON):\n\n${JSON.stringify(stats, null, 2)}\n\nProduce the recommendation in the required format.`,
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
