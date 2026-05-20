const { computeDeterministicMatch, getMethodConfig } = require('./deterministicScoringService');
const { embedTexts, similarity01, tokenize, getProviderSettings } = require('./embeddingService');
const { debugMethodLog } = require('./methodDebugService');

const METHOD_CONFIG = getMethodConfig();
const NEURAL_CONFIG = METHOD_CONFIG.neuralMatching || {};
const SEMANTIC_CONFIG = NEURAL_CONFIG.semanticTextBuilding || {};
const NEURAL_WEIGHTS = NEURAL_CONFIG.neuralWeights || { overall: 0.5, skills: 0.3, experience: 0.2 };
const RULE_ADJUSTMENTS = NEURAL_CONFIG.ruleAdjustments || {};
const FINAL_RECOMMENDATION_THRESHOLDS =
  NEURAL_CONFIG.finalScore?.recommendationThresholds || METHOD_CONFIG.recommendationThresholds || { proceedMin: 70, reviewMin: 40 };

function toText(value) {
  return String(value || '').trim();
}

function normalize(text = '') {
  return toText(text).toLowerCase().replace(/\s+/g, ' ').trim();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function levelToRank(level) {
  const normalized = normalize(level);
  if (normalized === 'junior') return 0;
  if (normalized === 'middle') return 1;
  if (normalized === 'senior') return 2;
  return -1;
}

function uniqueStrings(values = []) {
  const seen = new Set();
  const output = [];
  values.forEach((value) => {
    const text = toText(value);
    const key = normalize(text);
    if (!text || !key || seen.has(key)) return;
    seen.add(key);
    output.push(text.replace(/\s+/g, ' ').trim());
  });
  return output;
}

function extractTextFromUnknown(value) {
  if (Array.isArray(value)) {
    return value.map((item) => extractTextFromUnknown(item)).filter(Boolean).join(' ');
  }
  if (value && typeof value === 'object') {
    return Object.values(value).map((item) => extractTextFromUnknown(item)).filter(Boolean).join(' ');
  }
  return toText(value);
}

function collectStructuredRecords(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStructuredRecords(item));
  }
  if (!value || typeof value !== 'object') return [];

  const candidate = value;
  const roleLikeFields = ['title', 'position', 'role', 'jobTitle', 'description', 'summary', 'company', 'responsibilities'];
  if (roleLikeFields.some((field) => field in candidate)) {
    return [candidate];
  }

  return Object.values(candidate).flatMap((item) => collectStructuredRecords(item));
}

function limitItems(values, maxItems, maxItemChars) {
  const list = uniqueStrings(values)
    .map((value) => (value.length > maxItemChars ? `${value.slice(0, Math.max(0, maxItemChars - 1)).trim()}…` : value))
    .slice(0, maxItems);
  return list;
}

function formatSection(label, values, options = {}) {
  const items = limitItems(
    Array.isArray(values) ? values : [values],
    options.maxItems || 6,
    options.maxItemChars || 180
  );
  if (!items.length) return '';
  let content = `${label}: ${items.join(' | ')}`;
  if (options.maxSectionChars && content.length > options.maxSectionChars) {
    content = `${content.slice(0, Math.max(0, options.maxSectionChars - 1)).trim()}…`;
  }
  return content;
}

function buildStableSemanticText(sectionSpecs = [], maxOverallChars = 3600) {
  const sections = sectionSpecs
    .map((spec) => formatSection(spec.label, spec.values, spec))
    .filter(Boolean);

  const lines = [];
  let total = 0;
  for (const section of sections) {
    const nextLength = total + section.length + (lines.length ? 1 : 0);
    if (nextLength > maxOverallChars) {
      const remaining = maxOverallChars - total - (lines.length ? 1 : 0);
      if (remaining > 12) {
        lines.push(`${section.slice(0, remaining - 1).trim()}…`);
      }
      break;
    }
    lines.push(section);
    total = nextLength;
  }
  return lines.join('\n');
}

function extractHistoryTitles(rawAnalysis = {}) {
  return collectStructuredRecords(rawAnalysis.workHistory || rawAnalysis.experience)
    .map((item) => toText(item.title || item.position || item.role || item.jobTitle))
    .filter(Boolean);
}

function extractHistoryDescriptions(rawAnalysis = {}) {
  return collectStructuredRecords(rawAnalysis.workHistory || rawAnalysis.experience)
    .map((item) => [item.summary, item.description, item.responsibilities, item.achievements].map((v) => extractTextFromUnknown(v)).filter(Boolean).join(' '))
    .filter(Boolean);
}

function extractProjects(rawAnalysis = {}) {
  const records = collectStructuredRecords(rawAnalysis.projects);
  if (records.length) {
    return records
      .map((item) => [item.title, item.description, item.summary, extractTextFromUnknown(item.stack), extractTextFromUnknown(item.technologies)].map((v) => toText(v)).filter(Boolean).join(' '))
      .filter(Boolean);
  }
  const flat = extractTextFromUnknown(rawAnalysis.projects);
  return flat ? [flat] : [];
}

function buildCandidateSemanticText(analysis = {}, rawAnalysis = analysis) {
  const historyTitles = extractHistoryTitles(rawAnalysis);
  const historyDescriptions = extractHistoryDescriptions(rawAnalysis);
  const projects = extractProjects(rawAnalysis);
  return buildStableSemanticText(
    [
      { label: 'POSITION', values: analysis.position, maxItems: 1, maxItemChars: 140, maxSectionChars: 180 },
      { label: 'SUMMARY', values: analysis.summary, maxItems: 1, maxItemChars: 420, maxSectionChars: 460 },
      { label: 'SKILLS', values: analysis.skills || [], maxItems: SEMANTIC_CONFIG.maxSkillsItems || 16, maxItemChars: SEMANTIC_CONFIG.maxItemChars || 180, maxSectionChars: 700 },
      { label: 'TECHNOLOGIES', values: analysis.technologies || [], maxItems: SEMANTIC_CONFIG.maxTechnologiesItems || 12, maxItemChars: SEMANTIC_CONFIG.maxItemChars || 180, maxSectionChars: 620 },
      { label: 'WORK_HISTORY_TITLES', values: historyTitles, maxItems: SEMANTIC_CONFIG.maxHistoryTitleItems || 6, maxItemChars: 120, maxSectionChars: 500 },
      { label: 'WORK_HISTORY_DETAILS', values: historyDescriptions, maxItems: SEMANTIC_CONFIG.maxHistoryDetailItems || 6, maxItemChars: 220, maxSectionChars: 900 },
      { label: 'PROJECTS', values: projects, maxItems: SEMANTIC_CONFIG.maxProjectItems || 4, maxItemChars: 220, maxSectionChars: 700 },
      { label: 'EDUCATION', values: analysis.education, maxItems: 1, maxItemChars: 220, maxSectionChars: 240 },
      { label: 'LANGUAGES', values: analysis.languages || [], maxItems: SEMANTIC_CONFIG.maxLanguageItems || 5, maxItemChars: 60, maxSectionChars: 180 },
    ],
    SEMANTIC_CONFIG.maxOverallChars || 3600
  );
}

function buildVacancySemanticText(job = {}, skillBuckets = null) {
  const buckets = skillBuckets || {
    criticalSkills: Array.isArray(job.criticalSkills) ? job.criticalSkills : [],
    coreSkills: Array.isArray(job.coreSkills) ? job.coreSkills : [],
    optionalSkills: Array.isArray(job.optionalSkills) ? job.optionalSkills : [],
  };
  return buildStableSemanticText(
    [
      { label: 'TITLE', values: job.title, maxItems: 1, maxItemChars: 180, maxSectionChars: 220 },
      { label: 'DESCRIPTION', values: job.description, maxItems: 1, maxItemChars: 500, maxSectionChars: 560 },
      { label: 'CRITICAL_SKILLS', values: buckets.criticalSkills || [], maxItems: SEMANTIC_CONFIG.maxSkillsItems || 16, maxItemChars: 120, maxSectionChars: 520 },
      { label: 'CORE_SKILLS', values: buckets.coreSkills || [], maxItems: SEMANTIC_CONFIG.maxSkillsItems || 16, maxItemChars: 120, maxSectionChars: 520 },
      { label: 'OPTIONAL_SKILLS', values: buckets.optionalSkills || [], maxItems: SEMANTIC_CONFIG.maxSkillsItems || 16, maxItemChars: 120, maxSectionChars: 520 },
      { label: 'REQUIREMENTS', values: job.requirements || [], maxItems: SEMANTIC_CONFIG.maxRequirementItems || 12, maxItemChars: 200, maxSectionChars: 900 },
      { label: 'STACK', values: job.stack || [], maxItems: SEMANTIC_CONFIG.maxStackItems || 10, maxItemChars: 120, maxSectionChars: 360 },
    ],
    SEMANTIC_CONFIG.maxOverallChars || 3600
  );
}

function buildCandidateSkillsSemanticText(analysis = {}, rawAnalysis = analysis) {
  const projects = extractProjects(rawAnalysis);
  return buildStableSemanticText(
    [
      { label: 'POSITION', values: analysis.position, maxItems: 1, maxItemChars: 140, maxSectionChars: 180 },
      { label: 'SKILLS', values: analysis.skills || [], maxItems: SEMANTIC_CONFIG.maxSkillsItems || 16, maxItemChars: 120, maxSectionChars: 620 },
      { label: 'TECHNOLOGIES', values: analysis.technologies || [], maxItems: SEMANTIC_CONFIG.maxTechnologiesItems || 12, maxItemChars: 120, maxSectionChars: 520 },
      { label: 'PROJECTS', values: projects, maxItems: 3, maxItemChars: 160, maxSectionChars: 500 },
    ],
    Math.min(SEMANTIC_CONFIG.maxOverallChars || 3600, 2200)
  );
}

function buildVacancySkillsSemanticText(job = {}, skillBuckets = null) {
  const buckets = skillBuckets || {
    criticalSkills: Array.isArray(job.criticalSkills) ? job.criticalSkills : [],
    coreSkills: Array.isArray(job.coreSkills) ? job.coreSkills : [],
    optionalSkills: Array.isArray(job.optionalSkills) ? job.optionalSkills : [],
  };
  return buildStableSemanticText(
    [
      { label: 'TITLE', values: job.title, maxItems: 1, maxItemChars: 160, maxSectionChars: 200 },
      { label: 'CRITICAL_SKILLS', values: buckets.criticalSkills || [], maxItems: 12, maxItemChars: 120, maxSectionChars: 420 },
      { label: 'CORE_SKILLS', values: buckets.coreSkills || [], maxItems: 12, maxItemChars: 120, maxSectionChars: 420 },
      { label: 'OPTIONAL_SKILLS', values: buckets.optionalSkills || [], maxItems: 10, maxItemChars: 120, maxSectionChars: 360 },
      { label: 'STACK', values: job.stack || [], maxItems: SEMANTIC_CONFIG.maxStackItems || 10, maxItemChars: 120, maxSectionChars: 320 },
      { label: 'REQUIREMENTS', values: job.requirements || [], maxItems: 8, maxItemChars: 160, maxSectionChars: 520 },
    ],
    2200
  );
}

function buildCandidateExperienceSemanticText(analysis = {}, rawAnalysis = analysis) {
  const historyTitles = extractHistoryTitles(rawAnalysis);
  const historyDescriptions = extractHistoryDescriptions(rawAnalysis);
  const projects = extractProjects(rawAnalysis);
  return buildStableSemanticText(
    [
      { label: 'POSITION', values: analysis.position, maxItems: 1, maxItemChars: 140, maxSectionChars: 180 },
      { label: 'SUMMARY', values: analysis.summary, maxItems: 1, maxItemChars: 300, maxSectionChars: 340 },
      { label: 'WORK_HISTORY_TITLES', values: historyTitles, maxItems: 6, maxItemChars: 120, maxSectionChars: 420 },
      { label: 'WORK_HISTORY_DETAILS', values: historyDescriptions, maxItems: 6, maxItemChars: 180, maxSectionChars: 760 },
      { label: 'PROJECTS', values: projects, maxItems: 4, maxItemChars: 160, maxSectionChars: 500 },
      { label: 'EDUCATION', values: analysis.education, maxItems: 1, maxItemChars: 180, maxSectionChars: 200 },
    ],
    2400
  );
}

function buildVacancyExperienceSemanticText(job = {}) {
  return buildStableSemanticText(
    [
      { label: 'TITLE', values: job.title, maxItems: 1, maxItemChars: 180, maxSectionChars: 220 },
      { label: 'DESCRIPTION', values: job.description, maxItems: 1, maxItemChars: 420, maxSectionChars: 460 },
      { label: 'REQUIREMENTS', values: job.requirements || [], maxItems: 10, maxItemChars: 180, maxSectionChars: 760 },
    ],
    2000
  );
}

function sharedConcepts(leftText = '', rightText = '', limit = 8) {
  const leftTokens = new Set(tokenize(leftText));
  return tokenize(rightText).filter((token) => leftTokens.has(token)).slice(0, limit);
}

function recommendationFromScore(score100) {
  if (score100 >= FINAL_RECOMMENDATION_THRESHOLDS.proceedMin) return 'Proceed';
  if (score100 >= FINAL_RECOMMENDATION_THRESHOLDS.reviewMin) return 'Review manually';
  return 'Reject';
}

function buildRuleAdjustments(ruleBasedResult = {}, analysis = {}) {
  const missingCriticalCount = Number(ruleBasedResult?.scoringMeta?.missingCriticalCount || 0);
  const confidence = Number(ruleBasedResult?.scoringMeta?.confidence?.matchConfidenceScore || 0);
  const confidenceFlags = Array.isArray(ruleBasedResult?.scoringMeta?.confidence?.flags)
    ? ruleBasedResult.scoringMeta.confidence.flags
    : [];
  const roleContextEffect = Number(ruleBasedResult?.scoringMeta?.roleContext?.effectiveAdjustment || 0) * 100;
  const roleContext = ruleBasedResult?.scoringMeta?.roleContext || {};
  const breakdown = ruleBasedResult?.scoringMeta?.breakdown || {};
  const skillMatchBreakdown = Array.isArray(ruleBasedResult?.skillMatchBreakdown)
    ? ruleBasedResult.skillMatchBreakdown
    : [];
  const ruleBasedScore = Number(ruleBasedResult?.matchPercentage || 0);
  const expectedLevel = String(ruleBasedResult?.scoringMeta?.expectedLevel || '');
  const candidateLevel = String(analysis.level || '');
  const criticalCoverage = Number(breakdown.criticalCoverage || 0);
  const coreCoverage = Number(breakdown.coreCoverage || 0);
  const jobRoleFamily = String(roleContext.jobRoleFamily || 'unknown');
  const candidateRoleFamily = String(roleContext.candidateRoleFamily || 'unknown');
  const alignmentBand = String(roleContext.alignmentBand || 'neutral');

  const criticalPenaltyAdjustment = -Math.min(
    missingCriticalCount * (RULE_ADJUSTMENTS.criticalPenaltyPerMissing || 6),
    RULE_ADJUSTMENTS.maxCriticalPenalty || 18
  );

  let confidenceAdjustment = 0;
  const lowConfidenceThreshold = RULE_ADJUSTMENTS.lowConfidencePenaltyThreshold || 0.58;
  if (confidence < lowConfidenceThreshold) {
    const deficit = (lowConfidenceThreshold - confidence) / Math.max(lowConfidenceThreshold, 0.0001);
    confidenceAdjustment = -round(deficit * (RULE_ADJUSTMENTS.maxConfidencePenalty || 8), 2);
  }

  let levelMismatchAdjustment = 0;
  const candidateRank = levelToRank(candidateLevel);
  const expectedRank = levelToRank(expectedLevel);
  if (candidateRank >= 0 && expectedRank >= 0 && candidateRank < expectedRank) {
    const gap = expectedRank - candidateRank;
    levelMismatchAdjustment = -Math.min(
      gap * (RULE_ADJUSTMENTS.levelMismatchPenaltyPerLevel || 0),
      30
    );
  }

  const weakCriticalMatchCount = skillMatchBreakdown.filter(
    (item) => item?.category === 'critical' && ['related', 'token-overlap'].includes(String(item?.tier || ''))
  ).length;
  const lowCriticalCoveragePenaltyMax = RULE_ADJUSTMENTS.lowCriticalCoveragePenaltyMax || 0;
  let lowCriticalCoverageAdjustment = 0;
  if (weakCriticalMatchCount > 0 && lowCriticalCoveragePenaltyMax > 0) {
    lowCriticalCoverageAdjustment = -round(lowCriticalCoveragePenaltyMax);
  }

  let sparseVacancyAdjustment = 0;
  if (confidenceFlags.includes('sparseVacancyData')) {
    sparseVacancyAdjustment = -round(RULE_ADJUSTMENTS.sparseVacancyPenaltyMax || 0);
  }

  let roleContextAdjustment = 0;
  if (roleContextEffect > 0) {
    roleContextAdjustment = Math.min(roleContextEffect, RULE_ADJUSTMENTS.roleContextPositiveMax || 6);
  } else if (roleContextEffect < 0) {
    roleContextAdjustment = Math.max(roleContextEffect, -(RULE_ADJUSTMENTS.roleContextNegativeMax || 8));
  }

  if ((missingCriticalCount > 0 || weakCriticalMatchCount > 0 || sparseVacancyAdjustment < 0) && roleContextAdjustment > 0) {
    roleContextAdjustment = 0;
  }

  const weakCoreCoverageThreshold = RULE_ADJUSTMENTS.weakCoreCoverageThreshold || 0.35;
  const weakTechnicalOverlap =
    criticalCoverage <= 0 &&
    coreCoverage < weakCoreCoverageThreshold;
  const hasSpecificJobFamily = !['generic', 'unknown'].includes(jobRoleFamily);
  const hasSpecificCandidateFamily = !['generic', 'unknown'].includes(candidateRoleFamily);

  let domainMismatchAdjustment = 0;
  if (weakTechnicalOverlap) {
    if (
      alignmentBand === 'weak' &&
      hasSpecificJobFamily &&
      hasSpecificCandidateFamily &&
      jobRoleFamily !== candidateRoleFamily
    ) {
      domainMismatchAdjustment = -Math.abs(RULE_ADJUSTMENTS.crossDomainMismatchPenalty || 14);
    } else if (
      hasSpecificJobFamily &&
      ['generic', 'unknown'].includes(candidateRoleFamily)
    ) {
      domainMismatchAdjustment = -Math.abs(RULE_ADJUSTMENTS.unknownDomainMismatchPenalty || 10);
    }
  }

  let weakOverlapAdjustment = 0;
  if (
    criticalCoverage <= 0 &&
    coreCoverage <= 0 &&
    ruleBasedScore <= (RULE_ADJUSTMENTS.veryLowRuleBasedThreshold || 15)
  ) {
    weakOverlapAdjustment = -Math.abs(RULE_ADJUSTMENTS.weakOverlapPenalty || 12);
  }

  const severeSemanticMismatchPenalty = RULE_ADJUSTMENTS.severeSemanticMismatchPenalty || 10;
  return {
    missingCriticalCount,
    criticalPenaltyAdjustment: round(criticalPenaltyAdjustment),
    confidenceAdjustment: round(confidenceAdjustment),
    levelMismatchAdjustment: round(levelMismatchAdjustment),
    lowCriticalCoverageAdjustment: round(lowCriticalCoverageAdjustment),
    sparseVacancyAdjustment: round(sparseVacancyAdjustment),
    roleContextAdjustment: round(roleContextAdjustment),
    domainMismatchAdjustment: round(domainMismatchAdjustment),
    weakOverlapAdjustment: round(weakOverlapAdjustment),
    severeSemanticMismatchPenalty,
  };
}

async function computeNeuralMatchScore(analysis = {}, rawAnalysis = analysis, job = {}, ruleBasedResult = null) {
  const stableRuleBasedResult = ruleBasedResult || computeDeterministicMatch(analysis, job);
  const skillBuckets = stableRuleBasedResult?.scoringMeta?.skillBuckets || {
    criticalSkills: Array.isArray(job.criticalSkills) ? job.criticalSkills : [],
    coreSkills: Array.isArray(job.coreSkills) ? job.coreSkills : [],
    optionalSkills: Array.isArray(job.optionalSkills) ? job.optionalSkills : [],
  };

  const semanticTextsUsed = {
    candidateOverall: buildCandidateSemanticText(analysis, rawAnalysis),
    vacancyOverall: buildVacancySemanticText(job, skillBuckets),
    candidateSkills: buildCandidateSkillsSemanticText(analysis, rawAnalysis),
    vacancySkills: buildVacancySkillsSemanticText(job, skillBuckets),
    candidateExperience: buildCandidateExperienceSemanticText(analysis, rawAnalysis),
    vacancyExperience: buildVacancyExperienceSemanticText(job),
  };

  const embeddingConfig = getProviderSettings();
  const neuralWeights = {
    overall: NEURAL_WEIGHTS.overall ?? 0.5,
    skills: NEURAL_WEIGHTS.skills ?? 0.3,
    experience: NEURAL_WEIGHTS.experience ?? 0.2,
  };

  const ruleAdjustments = buildRuleAdjustments(stableRuleBasedResult, analysis);
  const providerMetadata = {
    provider: embeddingConfig.provider,
    model: embeddingConfig.model,
    status: 'ready',
    fallbackApplied: false,
    flags: [],
    reasons: [],
  };

  try {
    const { embeddings, provider, model } = await embedTexts([
      semanticTextsUsed.candidateOverall,
      semanticTextsUsed.vacancyOverall,
      semanticTextsUsed.candidateSkills,
      semanticTextsUsed.vacancySkills,
      semanticTextsUsed.candidateExperience,
      semanticTextsUsed.vacancyExperience,
    ]);

    providerMetadata.provider = provider;
    providerMetadata.model = model;

    const neuralOverallAlignment = similarity01(embeddings[0], embeddings[1]);
    const neuralSkillsAlignment = similarity01(embeddings[2], embeddings[3]);
    const neuralExperienceAlignment = similarity01(embeddings[4], embeddings[5]);

    const neuralMatchScore = round(
      100 * (
        neuralWeights.overall * neuralOverallAlignment +
        neuralWeights.skills * neuralSkillsAlignment +
        neuralWeights.experience * neuralExperienceAlignment
      )
    );

    let finalScore =
      neuralMatchScore +
      ruleAdjustments.criticalPenaltyAdjustment +
      ruleAdjustments.confidenceAdjustment +
      ruleAdjustments.levelMismatchAdjustment +
      ruleAdjustments.lowCriticalCoverageAdjustment +
      ruleAdjustments.sparseVacancyAdjustment +
      ruleAdjustments.roleContextAdjustment +
      ruleAdjustments.domainMismatchAdjustment +
      ruleAdjustments.weakOverlapAdjustment;
    let severeMismatchApplied = 0;
    if (neuralOverallAlignment < (RULE_ADJUSTMENTS.severeSemanticMismatchThreshold || 0.3)) {
      severeMismatchApplied = -Math.abs(ruleAdjustments.severeSemanticMismatchPenalty || 10);
      finalScore += severeMismatchApplied;
    }
    finalScore = clamp(round(finalScore), 0, 100);

    let recommendation = recommendationFromScore(finalScore);
    if (ruleAdjustments.missingCriticalCount >= (METHOD_CONFIG.matchPenalties?.criticalMissingProceedBlockThreshold || 1) && recommendation === 'Proceed') {
      recommendation = 'Review manually';
    }
    if ((ruleAdjustments.lowCriticalCoverageAdjustment || 0) < 0 && recommendation === 'Proceed') {
      recommendation = 'Review manually';
    }
    if (
      (stableRuleBasedResult?.scoringMeta?.confidence?.matchConfidenceScore || 0) <
        (METHOD_CONFIG.confidenceThresholds?.proceedDowngradeThreshold || 0.58) &&
      recommendation === 'Proceed'
    ) {
      recommendation = 'Review manually';
    }
    if ((ruleAdjustments.domainMismatchAdjustment || 0) < 0 && recommendation === 'Proceed') {
      recommendation = 'Review manually';
    }
    if (neuralOverallAlignment < (RULE_ADJUSTMENTS.severeSemanticMismatchThreshold || 0.3) && recommendation === 'Proceed') {
      recommendation = 'Review manually';
    }

    const semanticSharedConcepts = sharedConcepts(semanticTextsUsed.candidateOverall, semanticTextsUsed.vacancyOverall);
    const strengths = uniqueStrings([
      `Нейромережева змістова відповідність: ${finalScore}/100`,
      semanticSharedConcepts.length ? `Спільні змістові акценти: ${semanticSharedConcepts.join(', ')}` : '',
      ...(stableRuleBasedResult.strengths || []),
    ]).slice(0, 6);

    const penaltiesApplied = {
      ...ruleAdjustments,
      severeSemanticMismatchAdjustment: severeMismatchApplied,
      total: round(
        ruleAdjustments.criticalPenaltyAdjustment +
        ruleAdjustments.confidenceAdjustment +
        ruleAdjustments.levelMismatchAdjustment +
        ruleAdjustments.lowCriticalCoverageAdjustment +
        ruleAdjustments.sparseVacancyAdjustment +
        ruleAdjustments.roleContextAdjustment +
        ruleAdjustments.domainMismatchAdjustment +
        ruleAdjustments.weakOverlapAdjustment +
        severeMismatchApplied
      ),
    };

    const gaps = uniqueStrings([
      ...(stableRuleBasedResult.gaps || []),
      ...(providerMetadata.flags.length ? providerMetadata.reasons : []),
      ...(severeMismatchApplied < 0 ? ['Змістова схожість слабка, навіть якщо окремі формулювання виглядають подібними.'] : []),
    ]).slice(0, 8);

    debugMethodLog('match.neural-result', {
      ruleBasedMatchScore: stableRuleBasedResult.matchPercentage,
      neuralMatchScore,
      finalMatchScore: finalScore,
      providerStatus: providerMetadata.status,
      providerFlags: providerMetadata.flags,
    });

    return {
      ...stableRuleBasedResult,
      matchPercentage: finalScore,
      neuralMatchScore,
      ruleBasedMatchScore: stableRuleBasedResult.matchPercentage,
      finalMatchScore: finalScore,
      neuralBreakdown: {
        semanticTextsUsed,
        neuralSimilarityComponents: {
          neuralOverallAlignment: round(neuralOverallAlignment),
          neuralSkillsAlignment: round(neuralSkillsAlignment),
          neuralExperienceAlignment: round(neuralExperienceAlignment),
        },
        neuralWeights,
        semanticSharedConcepts,
        providerStatus: providerMetadata.status,
        providerFlags: providerMetadata.flags,
        providerReasons: providerMetadata.reasons,
      },
      confidence: stableRuleBasedResult?.scoringMeta?.confidence || null,
      roleContext: stableRuleBasedResult?.scoringMeta?.roleContext || null,
      strengths,
      gaps,
      recommendation,
      penaltiesApplied,
      scoringMeta: {
        ...(stableRuleBasedResult.scoringMeta || {}),
        method: `${METHOD_CONFIG.version}-neural-first-match`,
        embeddingModel: providerMetadata.model,
        provider: providerMetadata.provider,
        neuralBreakdown: {
          semanticTextsUsed,
          neuralSimilarityComponents: {
            neuralOverallAlignment: round(neuralOverallAlignment),
            neuralSkillsAlignment: round(neuralSkillsAlignment),
            neuralExperienceAlignment: round(neuralExperienceAlignment),
          },
          neuralWeights,
          semanticSharedConcepts,
          providerStatus: providerMetadata.status,
          providerFlags: providerMetadata.flags,
          providerReasons: providerMetadata.reasons,
        },
        penaltiesApplied,
        ruleAdjustments: penaltiesApplied,
        finalScoreComposition: {
          neuralMatchScore,
          ruleBasedMatchScore: stableRuleBasedResult.matchPercentage,
          finalMatchScore: finalScore,
          dominantSource: 'neural',
        },
      },
    };
  } catch (error) {
    providerMetadata.status = 'fallback-rule-based';
    providerMetadata.fallbackApplied = true;
    providerMetadata.flags.push('embeddingProviderUnavailable');
    providerMetadata.reasons.push(`Нейромережеві embeddings недоступні: ${toText(error.message) || 'невідома помилка'}`);

    const fallbackScore = stableRuleBasedResult.matchPercentage;
    const fallbackStrengths = uniqueStrings([
      ...(stableRuleBasedResult.strengths || []),
      'Резервний режим: підсумкова оцінка базується на rule-based зіставленні, бо embeddings недоступні',
    ]).slice(0, 6);

    debugMethodLog('match.fallback-result', {
      ruleBasedMatchScore: fallbackScore,
      neuralMatchScore: null,
      finalMatchScore: fallbackScore,
      providerStatus: providerMetadata.status,
      providerFlags: providerMetadata.flags,
    });

    return {
      ...stableRuleBasedResult,
      matchPercentage: fallbackScore,
      neuralMatchScore: null,
      ruleBasedMatchScore: fallbackScore,
      finalMatchScore: fallbackScore,
      neuralBreakdown: {
        semanticTextsUsed,
        neuralSimilarityComponents: null,
        neuralWeights,
        semanticSharedConcepts: [],
        providerStatus: providerMetadata.status,
        providerFlags: providerMetadata.flags,
        providerReasons: providerMetadata.reasons,
      },
      confidence: stableRuleBasedResult?.scoringMeta?.confidence || null,
      roleContext: stableRuleBasedResult?.scoringMeta?.roleContext || null,
      strengths: fallbackStrengths,
      recommendation: stableRuleBasedResult.recommendation,
      penaltiesApplied: {
        criticalPenaltyAdjustment: 0,
        confidenceAdjustment: 0,
        roleContextAdjustment: 0,
        domainMismatchAdjustment: 0,
        weakOverlapAdjustment: 0,
        severeSemanticMismatchAdjustment: 0,
        total: 0,
      },
      scoringMeta: {
        ...(stableRuleBasedResult.scoringMeta || {}),
        method: `${METHOD_CONFIG.version}-neural-first-match`,
        embeddingModel: providerMetadata.model,
        provider: providerMetadata.provider,
        neuralBreakdown: {
          semanticTextsUsed,
          neuralSimilarityComponents: null,
          neuralWeights,
          semanticSharedConcepts: [],
          providerStatus: providerMetadata.status,
          providerFlags: providerMetadata.flags,
          providerReasons: providerMetadata.reasons,
        },
        penaltiesApplied: {
          criticalPenaltyAdjustment: 0,
          confidenceAdjustment: 0,
          levelMismatchAdjustment: 0,
          lowCriticalCoverageAdjustment: 0,
          sparseVacancyAdjustment: 0,
          roleContextAdjustment: 0,
          domainMismatchAdjustment: 0,
          weakOverlapAdjustment: 0,
          severeSemanticMismatchAdjustment: 0,
          total: 0,
        },
        ruleAdjustments: {
          criticalPenaltyAdjustment: 0,
          confidenceAdjustment: 0,
          levelMismatchAdjustment: 0,
          lowCriticalCoverageAdjustment: 0,
          sparseVacancyAdjustment: 0,
          roleContextAdjustment: 0,
          domainMismatchAdjustment: 0,
          weakOverlapAdjustment: 0,
          severeSemanticMismatchAdjustment: 0,
          total: 0,
        },
        finalScoreComposition: {
          neuralMatchScore: null,
          ruleBasedMatchScore: fallbackScore,
          finalMatchScore: fallbackScore,
          dominantSource: 'rule-based-fallback',
        },
      },
    };
  }
}

module.exports = {
  buildCandidateSemanticText,
  buildVacancySemanticText,
  buildCandidateSkillsSemanticText,
  buildVacancySkillsSemanticText,
  buildCandidateExperienceSemanticText,
  buildVacancyExperienceSemanticText,
  computeNeuralMatchScore,
};

