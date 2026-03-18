const mongoose = require('mongoose');
const methodConfig = require('../config/method-config.json');

const RECOMMENDATION_VALUES = ['Proceed', 'Review manually', 'Reject'];
const ENGINE_VALUES = ['deterministic', 'llm', 'hybrid', 'embedding', 'keyword', 'manual', 'mock', 'unknown'];
const DEFAULT_METHOD_VERSION = String(methodConfig?.version || 'deterministic-v1');

// Один документ = один запуск оцінювання пари "кандидат-вакансія".
// Зберігаємо:
// - вхідний snapshot (analysisSnapshot),
// - результат методу (matchResult),
// - версії методу/моделі (method),
// - людську еталонну розмітку (groundTruth), якщо вона є.
const matchEvaluationSchema = new mongoose.Schema(
  {
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
    vacancyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vacancy', required: true, index: true },
    analysisSnapshot: { type: Object, required: true },
    matchResult: {
      matchPercentage: { type: Number, required: true, min: 0, max: 100 },
      strengths: { type: [String], default: [] },
      gaps: { type: [String], default: [] },
      recommendation: { type: String, enum: RECOMMENDATION_VALUES, required: true },
      matchedCriticalSkills: { type: [String], default: [] },
      missingCriticalSkills: { type: [String], default: [] },
      matchedCoreSkills: { type: [String], default: [] },
      missingCoreSkills: { type: [String], default: [] },
      matchedOptionalSkills: { type: [String], default: [] },
      optionalCoverage: { type: Number, min: 0, max: 1, default: 0 },
      skillMatchBreakdown: { type: [Object], default: [] },
    },
    method: {
      engine: { type: String, enum: ENGINE_VALUES, default: 'deterministic' },
      provider: { type: String, default: 'local' },
      modelVersion: { type: String, default: DEFAULT_METHOD_VERSION },
      promptVersion: { type: String, default: 'n/a' },
      pipelineVersion: { type: String, default: DEFAULT_METHOD_VERSION },
    },
    meta: {
      source: { type: String, default: 'api' },
      aiMock: { type: Boolean, default: false },
      aiFallbackOnQuota: { type: Boolean, default: false },
    },
    groundTruth: {
      recommendation: { type: String, enum: RECOMMENDATION_VALUES, default: null },
      score: { type: Number, min: 0, max: 100, default: null },
      reviewedAt: { type: Date, default: null },
      reviewerId: { type: String, default: '' },
      note: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

// Індекси для швидких вибірок:
// - розрахунок метрик по groundTruth,
// - порівняння версій методу в часі,
// - історія оцінок по конкретній парі кандидат-вакансія.
matchEvaluationSchema.index({ 'groundTruth.recommendation': 1, createdAt: -1 });
matchEvaluationSchema.index({ 'method.pipelineVersion': 1, createdAt: -1 });
matchEvaluationSchema.index({ 'method.modelVersion': 1, createdAt: -1 });
matchEvaluationSchema.index({ candidateId: 1, vacancyId: 1, createdAt: -1 });

module.exports = mongoose.model('MatchEvaluation', matchEvaluationSchema);
