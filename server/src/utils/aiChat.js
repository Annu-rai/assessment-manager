import { getClient, AI_MODEL } from '../config/anthropic.js';
import { generateQuestions } from './aiQuestionGenerator.js';
import Response from '../models/Response.js';
import Assessment from '../models/Assessment.js';
import User from '../models/User.js';
import { ROLES } from '../config/roles.js';

/**
 * AI Chat Assistant (Module 32).
 *
 * Runs a manual tool-use loop: Claude answers natural-language questions about
 * the org's data by calling read-only, org-scoped tools we execute here. All
 * queries are constrained to the caller's organization, so the assistant can
 * never read across tenants.
 */

const SYSTEM_PROMPT = `You are the assistant for staff of an assessment platform.
Answer questions about candidates, submissions, and assessments using the tools provided.
All tools are already scoped to the user's organization — you only ever see their data.
Be concise and specific; prefer concrete numbers and names. When asked to create/generate
questions, call generate_questions and present them in a short readable list.`;

// Tool definitions (JSON schema) exposed to Claude.
const TOOLS = [
  {
    name: 'get_stats',
    description: 'Get org-wide totals: submissions, pass rate, average score, candidate count, assessment count.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'query_submissions',
    description:
      'List candidate submissions, optionally filtered by score range, pass/fail, or assessment title. Returns candidate, assessment, percentage, passed.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        minPercentage: { type: 'number', description: 'Only submissions scoring at least this %' },
        maxPercentage: { type: 'number', description: 'Only submissions scoring at most this %' },
        passed: { type: 'boolean', description: 'Filter by pass (true) or fail (false)' },
        assessmentTitle: { type: 'string', description: 'Filter by assessment title (substring, case-insensitive)' },
        limit: { type: 'integer', description: 'Max rows to return (default 20)' },
      },
    },
  },
  {
    name: 'list_assessments',
    description: 'List the org\'s assessments with question count, status, and number of assigned candidates.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'generate_questions',
    description: 'Generate new assessment questions on a topic (not saved). Use for "create/generate a ... test".',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        topic: { type: 'string' },
        count: { type: 'integer' },
        types: { type: 'array', items: { type: 'string' } },
        difficulty: { type: 'string' },
      },
      required: ['topic'],
    },
  },
];

const questionCount = (a) =>
  (a.categories || []).reduce(
    (s, c) => s + (c.factors || []).reduce((s2, f) => s2 + (f.questions || []).length, 0),
    0
  );

// Execute one tool call against the DB, scoped to the caller's org.
async function executeTool(name, input, scope) {
  if (name === 'get_stats') {
    const [responses, assessments, candidates] = await Promise.all([
      Response.find(scope).select('graded passed percentage').lean(),
      Assessment.countDocuments(scope),
      User.countDocuments({ ...scope, role: ROLES.CANDIDATE }),
    ]);
    const graded = responses.filter((r) => r.graded);
    return {
      submissions: responses.length,
      gradedSubmissions: graded.length,
      passRate: graded.length ? Math.round((graded.filter((r) => r.passed).length / graded.length) * 100) : 0,
      averageScore: graded.length ? Math.round(graded.reduce((s, r) => s + r.percentage, 0) / graded.length) : 0,
      candidates,
      assessments,
    };
  }

  if (name === 'query_submissions') {
    const rows = await Response.find(scope)
      .populate('assessment', 'title')
      .populate('respondent', 'name email')
      .sort('-percentage')
      .lean();
    let out = rows.map((r) => ({
      candidate: r.respondent?.name || 'Unknown',
      email: r.respondent?.email || '',
      assessment: r.assessment?.title || 'Untitled',
      percentage: r.percentage,
      passed: r.passed,
      graded: r.graded,
    }));
    if (typeof input.minPercentage === 'number') out = out.filter((r) => r.percentage >= input.minPercentage);
    if (typeof input.maxPercentage === 'number') out = out.filter((r) => r.percentage <= input.maxPercentage);
    if (typeof input.passed === 'boolean') out = out.filter((r) => r.passed === input.passed);
    if (input.assessmentTitle) {
      const q = input.assessmentTitle.toLowerCase();
      out = out.filter((r) => r.assessment.toLowerCase().includes(q));
    }
    return { count: out.length, submissions: out.slice(0, Math.max(1, Math.min(50, input.limit || 20))) };
  }

  if (name === 'list_assessments') {
    const list = await Assessment.find(scope).select('title status assignedTo categories').lean();
    return {
      assessments: list.map((a) => ({
        title: a.title,
        status: a.status,
        questions: questionCount(a),
        assigned: a.assignedTo?.length || 0,
      })),
    };
  }

  if (name === 'generate_questions') {
    const questions = await generateQuestions({
      topic: input.topic,
      count: input.count || 5,
      types: input.types,
      difficulty: input.difficulty || 'mixed',
    });
    return { questions: questions.map((q) => ({ text: q.text, type: q.type, points: q.points })) };
  }

  return { error: `Unknown tool: ${name}` };
}

/**
 * Run the chat loop.
 * @param {Array<{role, content}>} messages - prior conversation (user/assistant text)
 * @param {object} scope - org filter ({} for super admin)
 * @returns {Promise<string>} assistant's final text reply
 */
export async function runChat(messages, scope) {
  const anthropic = getClient();
  if (!anthropic) {
    const err = new Error('AI is not configured (missing ANTHROPIC_API_KEY)');
    err.statusCode = 503;
    throw err;
  }

  // Normalize incoming messages to the API shape (text content).
  const convo = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .map((m) => ({ role: m.role, content: String(m.content) }));

  for (let i = 0; i < 6; i += 1) {
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: convo,
    });

    if (response.stop_reason !== 'tool_use') {
      const textBlock = response.content.find((b) => b.type === 'text');
      return textBlock ? textBlock.text : '(no response)';
    }

    // Execute every tool call, then feed results back and loop.
    convo.push({ role: 'assistant', content: response.content });
    const toolResults = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        let result;
        try {
          result = await executeTool(block.name, block.input || {}, scope);
        } catch (err) {
          result = { error: err.message };
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }
    convo.push({ role: 'user', content: toolResults });
  }

  return 'Sorry — I could not complete that request (too many steps).';
}
