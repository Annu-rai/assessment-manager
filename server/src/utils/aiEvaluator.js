import { getClient, AI_MODEL } from '../config/anthropic.js';

/**
 * AI Evaluation (Module 6).
 *
 * Grades free-form essay answers with Claude: each answer is scored 0..maxPoints
 * against the question, with a short justification. One batched API call grades
 * every essay in a submission. Uses structured outputs so the result is valid
 * JSON keyed by list index (we map back to answers on our side).
 */

const SYSTEM_PROMPT = `You are a fair, consistent exam grader.
For each item you receive a question, the candidate's answer, and the maximum points.
Award an integer score from 0 to maxPoints based on correctness, completeness and clarity.
Give one or two sentences of constructive feedback. Be objective; do not inflate scores.
An empty or irrelevant answer scores 0.`;

// Build the JSON schema. maxItems isn't supported by structured outputs, so the
// count is enforced only by the prompt; we defensively match by index on return.
const buildSchema = () => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    evaluations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          index: { type: 'integer' },
          score: { type: 'integer' },
          feedback: { type: 'string' },
        },
        required: ['index', 'feedback', 'score'],
      },
    },
  },
  required: ['evaluations'],
});

/**
 * Grade a list of essay items.
 * @param {Array<{question: string, answer: string, maxPoints: number}>} items
 * @returns {Promise<Array<{index, score, feedback}>>} clamped to [0, maxPoints]
 */
export async function evaluateEssays(items) {
  const anthropic = getClient();
  if (!anthropic) {
    const err = new Error('AI is not configured (missing ANTHROPIC_API_KEY)');
    err.statusCode = 503;
    throw err;
  }
  if (!items.length) return [];

  const prompt = [
    'Grade the following answers. Return one evaluation object per item, using the same index.',
    '',
    ...items.map(
      (it, i) =>
        `Item ${i}:\n  Question: ${it.question}\n  Max points: ${it.maxPoints}\n  Candidate answer: ${it.answer || '(blank)'}`
    ),
  ].join('\n');

  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
    output_config: { format: { type: 'json_schema', schema: buildSchema() } },
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('AI returned no content');

  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error('AI returned malformed JSON');
  }

  const evals = Array.isArray(parsed.evaluations) ? parsed.evaluations : [];
  // Clamp each score to its item's max, matching by index.
  return evals
    .filter((e) => Number.isInteger(e.index) && items[e.index])
    .map((e) => ({
      index: e.index,
      score: Math.max(0, Math.min(items[e.index].maxPoints, Number(e.score) || 0)),
      feedback: String(e.feedback || ''),
    }));
}
