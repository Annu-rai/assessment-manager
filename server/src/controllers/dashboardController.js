import asyncHandler from 'express-async-handler';
import Assessment from '../models/Assessment.js';
import Response from '../models/Response.js';
import User from '../models/User.js';
import { orgFilter } from '../middleware/rbac.js';
import { ROLES } from '../config/roles.js';

/**
 * GET /api/dashboard — KPI snapshot for the caller's organization (Module 3).
 * Aggregates assessments, responses, pass rate, average score, candidate counts,
 * top categories and recent activity into one payload for the dashboard cards.
 */
export const getDashboard = asyncHandler(async (req, res) => {
  const scope = orgFilter(req);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [assessments, responses, candidateCount] = await Promise.all([
    Assessment.find(scope).select('title categories status assignedTo createdAt').sort('-createdAt'),
    Response.find(scope).select('percentage passed graded createdAt assessment').lean(),
    User.countDocuments({ ...scope, role: ROLES.CANDIDATE }),
  ]);

  const totalAssessments = assessments.length;
  const todaysAssessments = assessments.filter((a) => a.createdAt >= startOfToday).length;

  const completed = responses.length;
  const gradedResponses = responses.filter((r) => r.graded);
  const passedCount = gradedResponses.filter((r) => r.passed).length;
  const passRate = gradedResponses.length
    ? Math.round((passedCount / gradedResponses.length) * 100)
    : 0;
  const averageScore = gradedResponses.length
    ? Math.round(gradedResponses.reduce((s, r) => s + r.percentage, 0) / gradedResponses.length)
    : 0;

  // Pending = assignment slots on published assessments that have no submission yet.
  const totalAssignments = assessments
    .filter((a) => a.status === 'published')
    .reduce((s, a) => s + (a.assignedTo?.length || 0), 0);
  const pending = Math.max(0, totalAssignments - completed);

  // Top categories by how many questions reference them across all assessments.
  const categoryTally = new Map();
  for (const a of assessments) {
    for (const cat of a.categories || []) {
      const questions = (cat.factors || []).reduce((s, f) => s + (f.questions || []).length, 0);
      categoryTally.set(cat.name, (categoryTally.get(cat.name) || 0) + questions);
    }
  }
  const topCategories = [...categoryTally.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const recentAssessments = assessments.slice(0, 5).map((a) => ({
    _id: a._id,
    title: a.title,
    status: a.status,
    assigned: a.assignedTo?.length || 0,
    createdAt: a.createdAt,
  }));

  res.json({
    kpis: {
      totalAssessments,
      todaysAssessments,
      completed,
      pending,
      passRate,
      averageScore,
      candidates: candidateCount,
      certificates: passedCount, // foundation for Module 17
    },
    topCategories,
    recentAssessments,
  });
});
