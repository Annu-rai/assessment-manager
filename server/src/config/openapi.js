/**
 * OpenAPI 3 spec for the Assessment Platform API (Module 31).
 * Served via Swagger UI at /api/docs. Representative of the main endpoints;
 * all authenticated routes use a Bearer JWT.
 */

// Shorthand builders to keep the path list compact.
const bearer = [{ bearerAuth: [] }];
const op = (tag, summary, { auth = true, body = null, params = [] } = {}) => {
  const o = { tags: [tag], summary, responses: { 200: { description: 'OK' } } };
  if (auth) o.security = bearer;
  if (params.length) o.parameters = params;
  if (body) o.requestBody = { content: { 'application/json': { schema: { type: 'object' } } } };
  return o;
};
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Assessment Platform API',
    version: '1.0.0',
    description:
      'Multi-tenant SaaS assessment platform. Organizations, RBAC, scoring, question bank, ' +
      'public links, certificates, exports, audit logs, and AI features (generation, evaluation, ' +
      'insights, chat, recommendation). All authenticated endpoints require a Bearer JWT.',
  },
  servers: [{ url: '/', description: 'Same origin' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  tags: [
    { name: 'Auth' },
    { name: 'Organizations' },
    { name: 'Users' },
    { name: 'Assessments' },
    { name: 'Responses' },
    { name: 'Question Bank' },
    { name: 'Certificates' },
    { name: 'Export' },
    { name: 'Audit' },
    { name: 'Search' },
    { name: 'Dashboard' },
    { name: 'AI' },
    { name: 'Public' },
  ],
  paths: {
    '/api/health': { get: op('Auth', 'Health check', { auth: false }) },

    '/api/auth/register': { post: op('Auth', 'Register (creates an org + org admin)', { auth: false, body: true }) },
    '/api/auth/login': { post: op('Auth', 'Login → JWT', { auth: false, body: true }) },
    '/api/auth/me': { get: op('Auth', 'Current user + organization') },

    '/api/organizations/me': {
      get: op('Organizations', 'Get my organization'),
      put: op('Organizations', 'Update branding (name/logo/color) — admin', { body: true }),
    },
    '/api/organizations': { get: op('Organizations', 'List all orgs — super admin') },

    '/api/users': {
      get: op('Users', 'List org members — admin'),
      post: op('Users', 'Add a member — admin', { body: true }),
    },
    '/api/users/{id}': {
      put: op('Users', 'Update role/status — admin', { body: true, params: [idParam] }),
      delete: op('Users', 'Deactivate member — admin', { params: [idParam] }),
    },

    '/api/assessments': {
      get: op('Assessments', 'List assessments (candidates: assigned only)'),
      post: op('Assessments', 'Create assessment — staff', { body: true }),
    },
    '/api/assessments/{id}': {
      get: op('Assessments', 'Get assessment (answer key hidden from candidates)', { params: [idParam] }),
      put: op('Assessments', 'Update assessment — staff', { body: true, params: [idParam] }),
      delete: op('Assessments', 'Delete assessment — staff', { params: [idParam] }),
    },
    '/api/assessments/{id}/public-link': { post: op('Assessments', 'Enable/disable public link — staff', { body: true, params: [idParam] }) },
    '/api/assessments/{id}/invite': { post: op('Assessments', 'Email candidates an invite — staff', { body: true, params: [idParam] }) },

    '/api/responses': {
      get: op('Responses', 'List submissions (candidates: own only)'),
      post: op('Responses', 'Submit answers (auto-graded)', { body: true }),
    },
    '/api/responses/{id}': { get: op('Responses', 'Get a submission', { params: [idParam] }) },

    '/api/questions': {
      get: op('Question Bank', 'List bank questions (filterable) — staff'),
      post: op('Question Bank', 'Add a question — staff', { body: true }),
    },
    '/api/questions/random': { get: op('Question Bank', 'Random selection — staff') },
    '/api/questions/{id}': {
      put: op('Question Bank', 'Update a question — staff', { body: true, params: [idParam] }),
      delete: op('Question Bank', 'Delete a question — staff', { params: [idParam] }),
    },

    '/api/certificates': { get: op('Certificates', 'List my/org certificates') },
    '/api/certificates/{certificateId}/download': {
      get: op('Certificates', 'Download certificate PDF', {
        params: [{ name: 'certificateId', in: 'path', required: true, schema: { type: 'string' } }],
      }),
    },

    '/api/export/responses': { get: op('Export', 'Export responses (?format=csv|xlsx|pdf) — staff') },
    '/api/export/candidates': { get: op('Export', 'Export members (?format=csv|xlsx|pdf) — staff') },

    '/api/audit': { get: op('Audit', 'List audit log — admin') },

    '/api/search': {
      get: op('Search', 'Global search — staff', {
        params: [{ name: 'q', in: 'query', schema: { type: 'string' } }],
      }),
    },

    '/api/dashboard': { get: op('Dashboard', 'KPI snapshot — staff') },

    '/api/ai/status': { get: op('AI', 'Is AI configured?') },
    '/api/ai/generate-questions': { post: op('AI', 'Generate questions with Claude — staff', { body: true }) },
    '/api/ai/evaluate-response/{id}': { post: op('AI', 'AI-grade essay answers — staff', { params: [idParam] }) },
    '/api/ai/insights': { get: op('AI', 'AI analytics insights — staff') },
    '/api/ai/chat': { post: op('AI', 'AI assistant (tool-use) — staff', { body: true }) },
    '/api/ai/recommendation/{candidateId}': {
      get: op('AI', 'Role-fit recommendation — staff', {
        params: [{ name: 'candidateId', in: 'path', required: true, schema: { type: 'string' } }],
      }),
    },

    '/api/public/assessments/{publicId}': {
      get: op('Public', 'Get a public assessment (no auth)', {
        auth: false,
        params: [{ name: 'publicId', in: 'path', required: true, schema: { type: 'string' } }],
      }),
    },
    '/api/public/assessments/{publicId}/submit': {
      post: op('Public', 'Submit a public assessment (guest, no auth)', {
        auth: false,
        body: true,
        params: [{ name: 'publicId', in: 'path', required: true, schema: { type: 'string' } }],
      }),
    },
    '/api/public/verify/{certificateId}': {
      get: op('Public', 'Verify a certificate (no auth)', {
        auth: false,
        params: [{ name: 'certificateId', in: 'path', required: true, schema: { type: 'string' } }],
      }),
    },
  },
};
