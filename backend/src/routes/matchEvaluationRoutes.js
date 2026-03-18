const express = require('express');
const mongoose = require('mongoose');
const Candidate = require('../models/Candidate');
const Vacancy = require('../models/Vacancy');
const MatchEvaluation = require('../models/MatchEvaluation');
const { matchResumeToJob } = require('../services/aiService');
const { getMethodConfig } = require('../services/deterministicScoringService');
const {
  RECOMMENDATION_VALUES,
  computeRecommendationMetrics,
} = require('../services/evaluationMetricsService');

const router = express.Router();
const ENGINE_VALUES = ['deterministic', 'llm', 'hybrid', 'embedding', 'keyword', 'manual', 'mock', 'unknown'];
const METHOD_CONFIG = getMethodConfig();

// Нормалізатори вхідних значень API.
function sanitizeText(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function sanitizeBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
}

function sanitizeLimit(value, fallback = 50, max = 200) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(n)));
}

function normalizeRecommendation(value, fallbackByScore = 0) {
  const safe = sanitizeText(value);
  if (RECOMMENDATION_VALUES.includes(safe)) return safe;
  if (fallbackByScore >= 70) return 'Proceed';
  if (fallbackByScore >= 40) return 'Review manually';
  return 'Reject';
}

function ensureRecommendation(value, fieldName = 'recommendation') {
  const safe = sanitizeText(value);
  if (RECOMMENDATION_VALUES.includes(safe)) return safe;
  const error = new Error(`${fieldName} must be one of: ${RECOMMENDATION_VALUES.join(', ')}`);
  error.statusCode = 400;
  throw error;
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Формує метадані методу для збереження в MatchEvaluation.
// Якщо клієнт не передав версії, беремо активну версію з method-config.
function normalizeMethod(method = {}) {
  const rawEngine = sanitizeText(method.engine).toLowerCase();
  const fallbackEngine = process.env.AI_MOCK === 'true' ? 'mock' : 'deterministic';
  const engine = ENGINE_VALUES.includes(rawEngine) ? rawEngine : fallbackEngine;
  const providerDefault = engine === 'deterministic' ? 'local' : 'google';
  const modelDefault = engine === 'deterministic' ? METHOD_CONFIG.version : 'gemini-2.5-flash';
  const promptDefault = engine === 'deterministic' ? 'n/a' : 'v1';

  return {
    engine,
    provider: sanitizeText(method.provider, providerDefault),
    modelVersion: sanitizeText(method.modelVersion, modelDefault),
    promptVersion: sanitizeText(method.promptVersion, promptDefault),
    pipelineVersion: sanitizeText(method.pipelineVersion, METHOD_CONFIG.version),
  };
}

// Гарантує, що результат match має коректні типи й межі.
function normalizeMatchResult(matchResult = {}) {
  const rawScore = Number(matchResult.matchPercentage);
  const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, rawScore)) : 0;
  const optionalCoverage = Number(matchResult.optionalCoverage);
  return {
    matchPercentage: score,
    strengths: Array.isArray(matchResult.strengths) ? matchResult.strengths.map((x) => String(x)) : [],
    gaps: Array.isArray(matchResult.gaps) ? matchResult.gaps.map((x) => String(x)) : [],
    recommendation: normalizeRecommendation(matchResult.recommendation, score),
    matchedCriticalSkills: Array.isArray(matchResult.matchedCriticalSkills)
      ? matchResult.matchedCriticalSkills.map((x) => String(x))
      : [],
    missingCriticalSkills: Array.isArray(matchResult.missingCriticalSkills)
      ? matchResult.missingCriticalSkills.map((x) => String(x))
      : [],
    matchedCoreSkills: Array.isArray(matchResult.matchedCoreSkills)
      ? matchResult.matchedCoreSkills.map((x) => String(x))
      : [],
    missingCoreSkills: Array.isArray(matchResult.missingCoreSkills)
      ? matchResult.missingCoreSkills.map((x) => String(x))
      : [],
    matchedOptionalSkills: Array.isArray(matchResult.matchedOptionalSkills)
      ? matchResult.matchedOptionalSkills.map((x) => String(x))
      : [],
    optionalCoverage: Number.isFinite(optionalCoverage) ? Math.max(0, Math.min(1, optionalCoverage)) : 0,
    skillMatchBreakdown: Array.isArray(matchResult.skillMatchBreakdown)
      ? matchResult.skillMatchBreakdown.map((item) => ({
          category: String(item?.category || ''),
          requiredSkill: String(item?.requiredSkill || ''),
          matchedSkill: item?.matchedSkill == null ? null : String(item.matchedSkill),
          tier: String(item?.tier || 'none'),
          score: Number.isFinite(Number(item?.score)) ? Math.max(0, Math.min(1, Number(item.score))) : 0,
        }))
      : [],
  };
}

// Єдиний формат відповіді API для запису MatchEvaluation.
function toApiEvaluation(evaluationDoc) {
  return {
    id: evaluationDoc._id.toString(),
    candidateId: evaluationDoc.candidateId ? String(evaluationDoc.candidateId) : null,
    vacancyId: evaluationDoc.vacancyId ? String(evaluationDoc.vacancyId) : null,
    analysisSnapshot: evaluationDoc.analysisSnapshot || null,
    matchResult: evaluationDoc.matchResult || null,
    method: evaluationDoc.method || null,
    meta: evaluationDoc.meta || null,
    groundTruth: evaluationDoc.groundTruth || null,
    createdAt: evaluationDoc.createdAt,
    updatedAt: evaluationDoc.updatedAt,
  };
}

// Базові фільтри для GET-ендпоінтів (список і метрики).
function buildBaseFilter(query = {}) {
  const filter = {};

  const candidateId = sanitizeText(query.candidateId);
  if (candidateId) {
    if (!mongoose.Types.ObjectId.isValid(candidateId)) {
      const error = new Error('candidateId must be a valid ObjectId');
      error.statusCode = 400;
      throw error;
    }
    filter.candidateId = candidateId;
  }

  const vacancyId = sanitizeText(query.vacancyId);
  if (vacancyId) {
    if (!mongoose.Types.ObjectId.isValid(vacancyId)) {
      const error = new Error('vacancyId must be a valid ObjectId');
      error.statusCode = 400;
      throw error;
    }
    filter.vacancyId = vacancyId;
  }

  const recommendation = sanitizeText(query.recommendation);
  if (recommendation) {
    filter['matchResult.recommendation'] = ensureRecommendation(recommendation, 'recommendation');
  }

  const groundTruthRecommendation = sanitizeText(query.groundTruthRecommendation);
  if (groundTruthRecommendation) {
    filter['groundTruth.recommendation'] = ensureRecommendation(
      groundTruthRecommendation,
      'groundTruthRecommendation'
    );
  }

  const engine = sanitizeText(query.engine).toLowerCase();
  if (engine) {
    filter['method.engine'] = engine;
  }

  const modelVersion = sanitizeText(query.modelVersion);
  if (modelVersion) {
    filter['method.modelVersion'] = modelVersion;
  }

  const pipelineVersion = sanitizeText(query.pipelineVersion);
  if (pipelineVersion) {
    filter['method.pipelineVersion'] = pipelineVersion;
  }

  const from = parseDate(query.from);
  const to = parseDate(query.to);
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }

  return filter;
}

// Перевіряє існування кандидата/вакансії перед запуском оцінювання.
async function resolveCandidateAndVacancy(candidateId, vacancyId) {
  if (!mongoose.Types.ObjectId.isValid(candidateId)) {
    const error = new Error('candidateId must be a valid ObjectId');
    error.statusCode = 400;
    throw error;
  }
  if (!mongoose.Types.ObjectId.isValid(vacancyId)) {
    const error = new Error('vacancyId must be a valid ObjectId');
    error.statusCode = 400;
    throw error;
  }

  const [candidate, vacancy] = await Promise.all([
    Candidate.findById(candidateId),
    Vacancy.findById(vacancyId),
  ]);

  if (!candidate) {
    const error = new Error('Candidate not found');
    error.statusCode = 404;
    throw error;
  }

  if (!vacancy) {
    const error = new Error('Vacancy not found');
    error.statusCode = 404;
    throw error;
  }

  return { candidate, vacancy };
}

// POST /api/match-evaluations
// Запускає оцінювання пари кандидат-вакансія і (опційно) зберігає результат.
router.post('/', async (req, res) => {
  try {
    const candidateId = sanitizeText(req.body?.candidateId);
    const vacancyId = sanitizeText(req.body?.vacancyId);
    if (!candidateId || !vacancyId) {
      return res.status(400).json({ message: 'candidateId and vacancyId are required' });
    }

    const { candidate, vacancy } = await resolveCandidateAndVacancy(candidateId, vacancyId);

    const analysis = req.body?.analysis && typeof req.body.analysis === 'object'
      ? req.body.analysis
      : candidate.resumeAnalysis;

    if (!analysis || typeof analysis !== 'object') {
      return res.status(400).json({
        message: 'Resume analysis is required. Provide body.analysis or save candidate.resumeAnalysis first.',
      });
    }

    const rawMatch = await matchResumeToJob(analysis, {
      title: vacancy.title,
      department: vacancy.department,
      description: vacancy.description,
      requirements: vacancy.requirements,
      stack: vacancy.stack,
      criticalSkills: vacancy.criticalSkills,
      coreSkills: vacancy.coreSkills,
      optionalSkills: vacancy.optionalSkills,
    });
    const matchResult = normalizeMatchResult(rawMatch);

    const method = normalizeMethod(req.body?.method || {});
    const saveRecord = sanitizeBoolean(req.body?.saveRecord, true);

    const basePayload = {
      candidateId: candidate._id,
      vacancyId: vacancy._id,
      analysisSnapshot: analysis,
      matchResult,
      method,
      meta: {
        source: sanitizeText(req.body?.source, 'api'),
        aiMock: process.env.AI_MOCK === 'true',
        aiFallbackOnQuota: process.env.AI_FALLBACK_ON_QUOTA !== 'false',
      },
    };

    const groundTruthRecommendation = sanitizeText(
      req.body?.groundTruth?.recommendation ?? req.body?.groundTruthRecommendation
    );
    if (groundTruthRecommendation) {
      const rawScore = req.body?.groundTruth?.score ?? req.body?.groundTruthScore;
      const numericScore = rawScore === undefined || rawScore === null || rawScore === ''
        ? null
        : Number(rawScore);
      if (numericScore !== null && (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100)) {
        return res.status(400).json({ message: 'groundTruthScore must be a number between 0 and 100' });
      }

      basePayload.groundTruth = {
        recommendation: ensureRecommendation(groundTruthRecommendation, 'groundTruthRecommendation'),
        score: numericScore,
        reviewedAt: new Date(),
        reviewerId: sanitizeText(req.body?.groundTruth?.reviewerId ?? req.body?.reviewerId),
        note: sanitizeText(req.body?.groundTruth?.note ?? req.body?.reviewNote),
      };
    }

    if (!saveRecord) {
      return res.json({
        saved: false,
        candidateId: candidate._id.toString(),
        vacancyId: vacancy._id.toString(),
        matchResult,
        method,
      });
    }

    const created = await MatchEvaluation.create(basePayload);
    return res.status(201).json({ saved: true, evaluation: toApiEvaluation(created) });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message || 'Failed to run match evaluation' });
  }
});

// GET /api/match-evaluations
// Повертає збережені оцінювання з фільтрами.
router.get('/', async (req, res) => {
  try {
    const filter = buildBaseFilter(req.query || {});
    const limit = sanitizeLimit(req.query?.limit, 50, 200);
    const evaluations = await MatchEvaluation.find(filter).sort({ createdAt: -1 }).limit(limit);
    return res.json({ items: evaluations.map(toApiEvaluation), count: evaluations.length });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message || 'Failed to fetch evaluations' });
  }
});

// GET /api/match-evaluations/method-config
// Повертає активний конфіг методу, який зараз використовує backend.
router.get('/method-config', (_req, res) => {
  return res.json({ methodConfig: METHOD_CONFIG });
});

// GET /api/match-evaluations/metrics
// Рахує метрики якості на записах, де вже є ground truth.
router.get('/metrics', async (req, res) => {
  try {
    const filter = buildBaseFilter(req.query || {});
    filter['groundTruth.recommendation'] = filter['groundTruth.recommendation'] || { $in: RECOMMENDATION_VALUES };

    const docs = await MatchEvaluation.find(filter).select({
      matchResult: 1,
      groundTruth: 1,
      method: 1,
      createdAt: 1,
    });

    const metrics = computeRecommendationMetrics(docs);

    const grouped = {};
    for (const doc of docs) {
      const modelVersion = sanitizeText(doc?.method?.modelVersion, 'unknown-model');
      const pipelineVersion = sanitizeText(doc?.method?.pipelineVersion, 'unknown-pipeline');
      const key = `${modelVersion} | ${pipelineVersion}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(doc);
    }

    const byMethodVersion = Object.entries(grouped).map(([version, rows]) => ({
      version,
      metrics: computeRecommendationMetrics(rows),
    }));

    return res.json({
      total: docs.length,
      metrics,
      byMethodVersion,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message || 'Failed to compute metrics' });
  }
});

// PATCH /api/match-evaluations/:id/ground-truth
// Додає або оновлює еталонну (експертну) мітку для конкретного оцінювання.
router.patch('/:id/ground-truth', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid evaluation ID' });
    }

    const evaluation = await MatchEvaluation.findById(id);
    if (!evaluation) {
      return res.status(404).json({ message: 'Evaluation not found' });
    }

    const recommendation = sanitizeText(
      req.body?.recommendation ?? req.body?.groundTruthRecommendation
    );
    if (!recommendation) {
      return res.status(400).json({ message: 'ground truth recommendation is required' });
    }

    const normalizedRecommendation = ensureRecommendation(recommendation, 'groundTruthRecommendation');
    const rawScore = req.body?.score ?? req.body?.groundTruthScore;
    const numericScore = rawScore === undefined || rawScore === null || rawScore === ''
      ? null
      : Number(rawScore);

    if (numericScore !== null && (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100)) {
      return res.status(400).json({ message: 'ground truth score must be a number between 0 and 100' });
    }

    evaluation.groundTruth = {
      recommendation: normalizedRecommendation,
      score: numericScore,
      reviewedAt: new Date(),
      reviewerId: sanitizeText(req.body?.reviewerId),
      note: sanitizeText(req.body?.note ?? req.body?.reviewNote),
    };

    await evaluation.save();
    return res.json({ evaluation: toApiEvaluation(evaluation) });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message || 'Failed to update ground truth' });
  }
});

module.exports = router;
