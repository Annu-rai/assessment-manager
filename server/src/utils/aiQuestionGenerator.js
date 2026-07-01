import { getClient, AI_MODEL } from '../config/anthropic.js';

/**
 * AI Question Generator (Module 5).
 *
 * Uses the Claude API with structured outputs (output_config.format) so the
 * model returns JSON that already matches a fixed schema — no fragile parsing.
 * The AI emits a normalized shape (correctOptions as string[]); we then map it
 * onto the app's embedded question shape (correctAnswer per type).
 */

// Types the generator supports (a schema-friendly subset — no media/match).
export const AI_QUESTION_TYPES = [
  'single_choice',
  'multiple_choice',
  'boolean',
  'numerical',
  'fill_blank',
  'essay',
];

// JSON schema the model must conform to. Structured outputs require every
// object to set additionalProperties:false and list all keys in `required`.
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string' },
          type: { type: 'string', enum: AI_QUESTION_TYPES },
          options: { type: 'array', items: { type: 'string' } },
          // correctOptions holds the answer key as strings, interpreted by type:
          //  single_choice -> [the correct option]
          //  multiple_choice -> [all correct options]
          //  boolean -> ["Yes"] or ["No"]
          //  numerical -> [the numeric answer as a string]
          //  fill_blank -> [acceptable answers]
          //  essay -> []
          correctOptions: { type: 'array', items: { type: 'string' } },
          points: { type: 'integer' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          explanation: { type: 'string' },
        },
        required: ['text', 'type', 'options', 'correctOptions', 'points', 'difficulty', 'explanation'],
      },
    },
  },
  required: ['questions'],
};

const SYSTEM_PROMPT = `You are an expert assessment author who writes high-quality, unambiguous exam questions.
Rules:
- Write clear, self-contained questions with exactly one intended interpretation.
- For single_choice: provide 3-4 plausible options; correctOptions has exactly one entry that is one of the options.
- For multiple_choice: provide 4-5 options; correctOptions lists every correct option (at least one).
- For boolean: options must be empty; correctOptions is exactly ["Yes"] or ["No"].
- For numerical: options empty; correctOptions is a single numeric string (e.g. ["144"]).
- For fill_blank: options empty; correctOptions lists all acceptable answers (include common synonyms/spellings).
- For essay: options empty; correctOptions empty; write a prompt that invites explanation.
- points: 1 for easy recall, 2-3 for harder/multi-part questions.
- explanation: one sentence justifying the correct answer.
Only produce questions of the requested types, difficulty, and count.`;

// Turn the AI's normalized item into the app's embedded question shape.
function mapToQuestion(item) {
  const q = {
    text: item.text,
    type: item.type,
    options: Array.isArray(item.options) ? item.options : [],
    ratingScale: 5,
    correctAnswer: null,
    points: Number(item.points) || 1,
    tolerance: 0,
    pairs: [],
    accept: '',
  };
  const co = Array.isArray(item.correctOptions) ? item.correctOptions : [];
  switch (item.type) {
    case 'single_choice':
      q.correctAnswer = co[0] ?? null;
      break;
    case 'multiple_choice':
      q.correctAnswer = co;
      break;
    case 'boolean':
      q.options = [];
      q.correctAnswer = co[0] ?? null; // "Yes" / "No"
      break;
    case 'numerical':
      q.options = [];
      q.correctAnswer = co.length ? Number(co[0]) : null;
      break;
    case 'fill_blank':
      q.options = [];
      q.correctAnswer = co;
      break;
    case 'essay':
    default:
      q.options = [];
      q.correctAnswer = null;
      break;
  }
  return q;
}

/**
 * Generate questions with Claude.
 * @param {object} opts
 * @param {string} opts.topic      - e.g. "React Hooks"
 * @param {number} opts.count      - how many questions (1-25)
 * @param {string[]} opts.types    - subset of AI_QUESTION_TYPES
 * @param {string} opts.difficulty - easy | medium | hard | mixed
 * @returns {Promise<Array>} questions in embedded shape
 */
export async function generateQuestions({ topic, count = 5, types, difficulty = 'mixed' }) {
  const anthropic = getClient();
  if (!anthropic) {
    const err = new Error('AI is not configured (missing ANTHROPIC_API_KEY)');
    err.statusCode = 503;
    throw err;
  }

  const wanted = (types && types.length ? types : AI_QUESTION_TYPES).filter((t) =>
    AI_QUESTION_TYPES.includes(t)
  );
  const n = Math.max(1, Math.min(25, Number(count) || 5));

  const userPrompt = [
    `Generate ${n} assessment questions about "${topic}".`,
    `Allowed question types: ${wanted.join(', ')}.`,
    difficulty === 'mixed'
      ? 'Mix easy, medium and hard difficulties.'
      : `All questions should be ${difficulty} difficulty.`,
    'Return them via the required JSON format.',
  ].join(' ');

  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
    output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
  });

  // With structured outputs, the JSON arrives as a text block.
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('AI returned no content');

  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error('AI returned malformed JSON');
  }

  const items = Array.isArray(parsed.questions) ? parsed.questions : [];
  return items.filter((i) => i.text && wanted.includes(i.type)).map(mapToQuestion);
}
