const fs = require('fs');
const path = require('path');

// Р”РµС‚РµСЂРјС–РЅРѕРІР°РЅРёР№ СЃРµСЂРІС–СЃ СЃРєРѕСЂРёРЅРіСѓ:
// 1) С‡РёС‚Р°С” РєРѕРЅС„С–Рі РјРµС‚РѕРґСѓ Р· JSON,
// 2) СЂР°С…СѓС” overallScore РєР°РЅРґРёРґР°С‚Р°,
// 3) СЂР°С…СѓС” matchPercentage РґР»СЏ РїР°СЂРё "РєР°РЅРґРёРґР°С‚-РІР°РєР°РЅСЃС–СЏ".
const RECOMMENDATION_VALUES = ['Proceed', 'Review manually', 'Reject'];
const LEVEL_VALUES = ['Junior', 'Middle', 'Senior'];

const DEFAULT_METHOD_CONFIG = {
  version: 'deterministic-v3',
  profileWeights: {
    years: 0.4,
    hardSkills: 0.32,
    softSkills: 0.1,
    languages: 0.1,
    education: 0.08,
  },
  matchWeights: {
    criticalCoverage: 0.42,
    coreCoverage: 0.24,
    optionalCoverage: 0.06,
    experienceFit: 0.18,
    levelFit: 0.1,
  },
  matchPenalties: {
    criticalMissingPenaltyPerSkill: 0.12,
    maxCriticalPenalty: 0.36,
    criticalMissingProceedBlockThreshold: 1,
  },
  matchSkillTiers: {
    exact: 1,
    synonym: 0.85,
    related: 0.5,
    none: 0,
  },
  recommendationThresholds: {
    proceedMin: 70,
    reviewMin: 40,
  },
  hardSkillsScoring: {
    coreSkillLimit: 5,
    coreDecay: 0.8,
    supportingWeight: 0.25,
    supportingDecay: 0.65,
    scorePerUnit: 1.25,
    maxScore: 10,
    evidenceBonusCapPerSkill: 1.5,
    sourceBonuses: {
      technologies: 0.25,
      position: 0.8,
      summary: 0.35,
      experience: 0.55,
    },
    priorityBonuses: {
      topSkill: 0.18,
      topTechnology: 0.1,
      topWindow: 3,
    },
  },
  softSkillsScoring: {
    scorePerUnit: 1.1,
    decay: 0.55,
    maxScore: 4,
    hardProfileUnlockMinRatio: 0.35,
    hardProfileFullUnlockScore: 7,
  },
  experienceScoring: {
    profileYearsBlend: {
      generalYearsShare: 0.55,
      relevantYearsShare: 0.45,
      dampeningStartScore: 7,
      dampeningStrength: 0.45,
      minimumWeightMultiplier: 0.55,
    },
    relevantExperienceHeuristic: {
      minimumRelevantRatio: 0.25,
      roleRecencyDecay: 0.72,
      titleOverlapWeight: 0.45,
      skillOverlapWeight: 0.35,
      currentRoleBonus: 0.2,
    },
    matchExperience: {
      relevantYearsWeight: 0.75,
      generalYearsFallbackWeight: 0.25,
      noRequirementDefaultYears: 2,
    },
  },
  languageScoresByCount: {
    0: 2,
    1: 5,
    2: 7,
    3: 9,
    '4plus': 10,
  },
  educationScores: {
    empty: 3,
    other: 4,
    bachelor: 6,
    master: 8,
    phd: 9,
  },
  yearsScoreBands: [
    { maxYears: 0, score: 1 },
    { maxYears: 1, score: 3 },
    { maxYears: 2, score: 5 },
    { maxYears: 3, score: 6 },
    { maxYears: 4, score: 7 },
    { maxYears: 6, score: 8 },
    { maxYears: 8, score: 9 },
    { maxYears: 50, score: 10 },
  ],
};

// РЎР»СѓР¶Р±РѕРІС– СѓС‚РёР»С–С‚Рё РґР»СЏ Р±РµР·РїРµС‡РЅРѕС— РјР°С‚РµРјР°С‚РёРєРё/РЅРѕСЂРјР°Р»С–Р·Р°С†С–С—.
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function safeNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toText(value) {
  return String(value || '').trim();
}

function toLower(value) {
  return toText(value).toLowerCase();
}

function normalizeSkill(value) {
  return toLower(value).replace(/\s+/g, ' ').trim();
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((x) => toText(x)).filter(Boolean))];
}

function uniqueSkills(values = []) {
  return [...new Set(values.map((x) => normalizeSkill(x)).filter(Boolean))];
}

function textIncludesSkill(text, skill) {
  const haystack = toLower(text);
  const needle = normalizeSkill(skill);
  if (!haystack || !needle) return false;
  return haystack.includes(needle);
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

function extractExperienceEvidenceTexts(analysis = {}) {
  const candidates = [
    analysis.experienceDescriptions,
    analysis.experience,
    analysis.experienceSummary,
    analysis.workHistory,
    analysis.projects,
  ];
  return candidates
    .map((value) => extractTextFromUnknown(value))
    .map((value) => toText(value))
    .filter(Boolean);
}

const GENERIC_ROLE_TOKENS = new Set([
  'developer',
  'engineer',
  'specialist',
  'manager',
  'software',
  'team',
  'lead',
  'senior',
  'middle',
  'junior',
  'intern',
  'trainee',
]);

function textToRoleTokens(value) {
  return uniqueStrings(
    tokenizeSkill(value).filter((token) => token && !GENERIC_ROLE_TOKENS.has(token))
  ).map((token) => normalizeSkill(token));
}

function uniqueObjectsBy(values = [], getKey) {
  const map = new Map();
  values.forEach((item) => {
    const key = toText(getKey(item));
    if (!key || map.has(key)) return;
    map.set(key, item);
  });
  return [...map.values()];
}

function overlapRatio(left = [], right = []) {
  const leftSet = new Set(left.map((item) => normalizeSkill(item)).filter(Boolean));
  const rightSet = new Set(right.map((item) => normalizeSkill(item)).filter(Boolean));
  if (!leftSet.size || !rightSet.size) return 0;
  let matched = 0;
  leftSet.forEach((item) => {
    if (rightSet.has(item)) matched += 1;
  });
  return matched / Math.min(leftSet.size, rightSet.size);
}

function parseYearsFromText(value) {
  const text = toText(value);
  if (!text) return null;

  const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(years|year|yrs|yr)/i);
  if (rangeMatch) {
    return safeYears((Number(rangeMatch[1]) + Number(rangeMatch[2])) / 2);
  }

  const plainMatch = text.match(/(\d+(?:\.\d+)?)\+?\s*(years|year|yrs|yr)/i);
  if (plainMatch) {
    return safeYears(plainMatch[1]);
  }

  const monthsMatch = text.match(/(\d+(?:\.\d+)?)\s*(months|month|mos|mo)/i);
  if (monthsMatch) {
    return safeYears(Number(monthsMatch[1]) / 12);
  }

  return null;
}

function parseDateLike(value) {
  const text = toText(value);
  if (!text) return null;

  const yearOnly = text.match(/\b(19|20)\d{2}\b/);
  if (yearOnly && text.length <= 7) {
    return new Date(Number(yearOnly[0]), 0, 1);
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  return null;
}

function yearsBetweenDates(startDate, endDate) {
  if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) return null;
  const safeEndDate = endDate instanceof Date && !Number.isNaN(endDate.getTime()) ? endDate : new Date();
  const diffMs = safeEndDate.getTime() - startDate.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return null;
  return safeYears(diffMs / (1000 * 60 * 60 * 24 * 365.25));
}

function inferIsCurrentRole(record = {}) {
  const explicit = record.current ?? record.isCurrent ?? record.present ?? record.active;
  if (typeof explicit === 'boolean') return explicit;

  const endText = toLower(record.endDate || record.to || record.periodEnd);
  return (
    !endText ||
    endText.includes('present') ||
    endText.includes('current') ||
    endText.includes('now') ||
    endText.includes('ongoing')
  );
}

function inferRoleYears(record = {}, fallbackYears = 0) {
  const directYears = safeNumber(
    record.years ?? record.yearsOfExperience ?? record.durationYears ?? record.totalYears,
    NaN
  );
  if (Number.isFinite(directYears)) return safeYears(directYears);

  const durationText = [
    record.duration,
    record.period,
    record.dateRange,
    record.date,
    record.summary,
    record.description,
  ]
    .map((item) => toText(item))
    .find(Boolean);
  const parsedFromText = parseYearsFromText(durationText);
  if (Number.isFinite(parsedFromText)) return parsedFromText;

  const startDate = parseDateLike(record.startDate || record.from || record.periodStart);
  const endDate = parseDateLike(record.endDate || record.to || record.periodEnd);
  const parsedFromDates = yearsBetweenDates(startDate, inferIsCurrentRole(record) ? new Date() : endDate);
  if (Number.isFinite(parsedFromDates)) return parsedFromDates;

  return fallbackYears > 0 ? safeYears(fallbackYears) : 0;
}

function collectStructuredExperienceRecords(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStructuredExperienceRecords(item));
  }
  if (!value || typeof value !== 'object') return [];

  const candidate = safeObject(value);
  const roleLikeFields = [
    'title',
    'position',
    'role',
    'jobTitle',
    'description',
    'summary',
    'startDate',
    'endDate',
    'duration',
    'years',
    'company',
    'responsibilities',
  ];
  if (roleLikeFields.some((field) => field in candidate)) {
    return [candidate];
  }

  return Object.values(candidate).flatMap((item) => collectStructuredExperienceRecords(item));
}

function buildRoleText(record = {}) {
  return [
    record.title,
    record.position,
    record.role,
    record.jobTitle,
    record.summary,
    record.description,
    record.responsibilities,
    record.achievements,
    extractTextFromUnknown(record.projects),
    extractTextFromUnknown(record.stack),
    extractTextFromUnknown(record.skills),
    extractTextFromUnknown(record.technologies),
  ]
    .map((item) => extractTextFromUnknown(item))
    .map((item) => toText(item))
    .filter(Boolean)
    .join(' ');
}

function extractRoleEntries(analysis = {}, generalYears = 0) {
  const structured = uniqueObjectsBy(
    [
      ...collectStructuredExperienceRecords(analysis.workHistory),
      ...collectStructuredExperienceRecords(analysis.experience),
      ...collectStructuredExperienceRecords(analysis.projects),
    ],
    (item) =>
      `${toText(item.title || item.position || item.role || item.jobTitle)}|${toText(item.startDate || item.from)}|${toText(item.endDate || item.to)}`
  );

  const fallbackPosition = toText(analysis.position);
  const fallbackSummary = toText(analysis.summary);
  const roleEntries = structured
    .map((record, index) => {
      const title = toText(record.title || record.position || record.role || record.jobTitle);
      const description = buildRoleText(record);
      if (!title && !description) return null;
      return {
        title: title || fallbackPosition,
        description,
        years: inferRoleYears(record),
        isCurrent: inferIsCurrentRole(record),
        index,
      };
    })
    .filter(Boolean);

  if (!roleEntries.length && (fallbackPosition || fallbackSummary)) {
    roleEntries.push({
      title: fallbackPosition,
      description: fallbackSummary,
      years: generalYears,
      isCurrent: true,
      index: 0,
    });
  }

  return roleEntries.map((entry, index) => ({
    ...entry,
    years: entry.years > 0 ? entry.years : index === 0 ? generalYears : 0,
    index,
  }));
}

function buildExperienceTargetContext(job = null, analysis = {}, skillBuckets = null) {
  if (job && typeof job === 'object') {
    const aggregatedSkills = uniqueStrings([
      ...((skillBuckets && skillBuckets.criticalSkills) || []),
      ...((skillBuckets && skillBuckets.coreSkills) || []),
      ...((skillBuckets && skillBuckets.optionalSkills) || []),
      ...((Array.isArray(job.stack) && job.stack) || []),
      ...((Array.isArray(job.requirements) && job.requirements) || []),
    ]);
    return {
      source: 'vacancy',
      title: toText(job.title),
      titleTokens: textToRoleTokens(job.title),
      targetSkills: aggregatedSkills,
      targetSkillSet: uniqueSkills(aggregatedSkills),
    };
  }

  const candidateTargetSkills = uniqueStrings([
    ...(Array.isArray(analysis.skills) ? analysis.skills.slice(0, 8) : []),
    ...(Array.isArray(analysis.technologies) ? analysis.technologies.slice(0, 8) : []),
  ]);

  return {
    source: 'profile',
    title: toText(analysis.position),
    titleTokens: textToRoleTokens(analysis.position),
    targetSkills: candidateTargetSkills,
    targetSkillSet: uniqueSkills(candidateTargetSkills),
  };
}

function buildExperienceSignals(normalizedAnalysis, rawAnalysis = normalizedAnalysis, targetContext = null) {
  const generalYears = safeYears(
    normalizedAnalysis.generalYearsExperience ?? normalizedAnalysis.yearsOfExperience
  );
  const explicitRelevantValue =
    rawAnalysis.relevantYearsExperience !== null &&
    rawAnalysis.relevantYearsExperience !== undefined &&
    rawAnalysis.relevantYearsExperience !== ''
      ? rawAnalysis.relevantYearsExperience
      : normalizedAnalysis.relevantYearsExperience !== null &&
          normalizedAnalysis.relevantYearsExperience !== undefined &&
          normalizedAnalysis.relevantYearsExperience !== ''
        ? normalizedAnalysis.relevantYearsExperience
        : NaN;
  const explicitRelevantYears = safeNumber(explicitRelevantValue, NaN);
  const maxRelevantYears = generalYears > 0 ? generalYears : 50;

  if (Number.isFinite(explicitRelevantYears)) {
    return {
      generalYears,
      relevantYears: clamp(explicitRelevantYears, 0, maxRelevantYears),
      source: 'explicit',
      experienceEvidence: [
        {
          title: 'Explicit relevantYearsExperience',
          years: round(clamp(explicitRelevantYears, 0, maxRelevantYears)),
          relevanceScore: 1,
          recencyWeight: 1,
          weightedYears: round(clamp(explicitRelevantYears, 0, maxRelevantYears)),
          matchedTargetSkills: [],
          titleOverlap: 1,
          skillOverlap: 1,
          isCurrent: true,
        },
      ],
    };
  }

  const heuristic = METHOD_CONFIG.experienceScoring.relevantExperienceHeuristic;
  const resolvedTargetContext = targetContext || buildExperienceTargetContext(null, normalizedAnalysis);
  const roleEntries = extractRoleEntries(rawAnalysis, generalYears);
  const evidence = roleEntries.map((roleEntry, index) => {
    const recencyWeight = Math.pow(heuristic.roleRecencyDecay, index);
    const titleOverlap = overlapRatio(textToRoleTokens(roleEntry.title), resolvedTargetContext.titleTokens);
    const roleText = `${toText(roleEntry.title)} ${toText(roleEntry.description)}`;
    const matchedTargetSkills = resolvedTargetContext.targetSkills.filter((skill) => textIncludesSkill(roleText, skill));
    const skillOverlap = resolvedTargetContext.targetSkillSet.length
      ? clamp(
          matchedTargetSkills.length / Math.min(resolvedTargetContext.targetSkillSet.length, 5),
          0,
          1
        )
      : 0;

    let relevanceScore =
      titleOverlap * heuristic.titleOverlapWeight + skillOverlap * heuristic.skillOverlapWeight;
    if (roleEntry.isCurrent) {
      relevanceScore += heuristic.currentRoleBonus;
    }
    if (relevanceScore > 0) {
      relevanceScore = Math.max(relevanceScore, heuristic.minimumRelevantRatio);
    }
    relevanceScore = clamp(relevanceScore, 0, 1);

    const weightedYears = roleEntry.years * relevanceScore * recencyWeight;
    return {
      title: roleEntry.title || 'Unspecified role',
      years: round(roleEntry.years),
      relevanceScore: round(relevanceScore),
      recencyWeight: round(recencyWeight),
      weightedYears: round(weightedYears),
      matchedTargetSkills: matchedTargetSkills.slice(0, 5),
      titleOverlap: round(titleOverlap),
      skillOverlap: round(skillOverlap),
      isCurrent: roleEntry.isCurrent,
    };
  });

  const relevantYears = clamp(
    evidence.reduce((sum, item) => sum + item.weightedYears, 0),
    0,
    maxRelevantYears
  );

  return {
    generalYears,
    relevantYears: round(relevantYears),
    source: 'heuristic',
    experienceEvidence: evidence.slice(0, 6),
  };
}

// РќРѕСЂРјР°Р»С–Р·СѓС” РІР°РіРё С‚Р°Рє, С‰РѕР± СЃСѓРјР° Р·Р°РІР¶РґРё РґРѕСЂС–РІРЅСЋРІР°Р»Р° 1.
function normalizeWeights(rawWeights, defaults, keys) {
  const merged = {};
  let sum = 0;
  for (const key of keys) {
    const n = safeNumber(rawWeights[key], defaults[key]);
    merged[key] = n > 0 ? n : defaults[key];
    sum += merged[key];
  }
  if (sum <= 0) {
    return { ...defaults };
  }
  const normalized = {};
  for (const key of keys) {
    normalized[key] = merged[key] / sum;
  }
  return normalized;
}

// Р’Р°Р»С–РґР°С†С–СЏ "СЃС…РѕРґРёРЅРѕРє" years -> score (1..10).
function normalizeYearsBands(rawBands, defaultBands) {
  const fallback = defaultBands.map((x) => ({ ...x }));
  if (!Array.isArray(rawBands) || rawBands.length === 0) return fallback;

  const normalized = rawBands
    .map((item) => ({
      maxYears: safeNumber(item?.maxYears, NaN),
      score: safeNumber(item?.score, NaN),
    }))
    .filter((item) => Number.isFinite(item.maxYears) && Number.isFinite(item.score))
    .map((item) => ({
      maxYears: clamp(item.maxYears, 0, 50),
      score: clamp(item.score, 1, 10),
    }))
    .sort((a, b) => a.maxYears - b.maxYears);

  if (!normalized.length) return fallback;
  return normalized;
}

// Р—Р°РІР°РЅС‚Р°Р¶СѓС” method-config.json С– РїСЂРёРІРѕРґРёС‚СЊ РІСЃС– РїР°СЂР°РјРµС‚СЂРё РґРѕ Р±РµР·РїРµС‡РЅРѕРіРѕ С„РѕСЂРјР°С‚Сѓ.
// РЇРєС‰Рѕ С„Р°Р№Р» РїРѕС€РєРѕРґР¶РµРЅРёР№/РЅРµРїРѕРІРЅРёР№, Р·Р°СЃС‚РѕСЃРѕРІСѓС” РґРµС„РѕР»С‚РЅС– Р·РЅР°С‡РµРЅРЅСЏ.
function loadMethodConfig() {
  const filePath = path.join(__dirname, '..', 'config', 'method-config.json');
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    raw = {};
  }

  const rawProfileWeights = safeObject(raw.profileWeights);
  const rawMatchWeights = safeObject(raw.matchWeights);
  const rawMatchPenalties = safeObject(raw.matchPenalties);
  const rawMatchSkillTiers = safeObject(raw.matchSkillTiers);
  const rawThresholds = safeObject(raw.recommendationThresholds);
  const rawLanguageScores = safeObject(raw.languageScoresByCount);
  const rawEducationScores = safeObject(raw.educationScores);
  const rawHardSkillsScoring = safeObject(raw.hardSkillsScoring);
  const rawSoftSkillsScoring = safeObject(raw.softSkillsScoring);
  const rawExperienceScoring = safeObject(raw.experienceScoring);
  const rawProfileYearsBlend = safeObject(rawExperienceScoring.profileYearsBlend);
  const rawRelevantExperienceHeuristic = safeObject(rawExperienceScoring.relevantExperienceHeuristic);
  const rawMatchExperience = safeObject(rawExperienceScoring.matchExperience);
  const rawHardSkillSourceBonuses = safeObject(rawHardSkillsScoring.sourceBonuses);
  const rawHardSkillPriorityBonuses = safeObject(rawHardSkillsScoring.priorityBonuses);

  const profileWeights = normalizeWeights(
    rawProfileWeights,
    DEFAULT_METHOD_CONFIG.profileWeights,
    ['years', 'hardSkills', 'softSkills', 'languages', 'education']
  );
  const matchWeights = normalizeWeights(
    rawMatchWeights,
    DEFAULT_METHOD_CONFIG.matchWeights,
    ['criticalCoverage', 'coreCoverage', 'optionalCoverage', 'experienceFit', 'levelFit']
  );
  const profileYearsBlend = normalizeWeights(
    {
      generalYearsShare: rawProfileYearsBlend.generalYearsShare,
      relevantYearsShare: rawProfileYearsBlend.relevantYearsShare,
    },
    DEFAULT_METHOD_CONFIG.experienceScoring.profileYearsBlend,
    ['generalYearsShare', 'relevantYearsShare']
  );
  const matchExperienceWeights = normalizeWeights(
    {
      relevantYearsWeight: rawMatchExperience.relevantYearsWeight,
      generalYearsFallbackWeight: rawMatchExperience.generalYearsFallbackWeight,
    },
    DEFAULT_METHOD_CONFIG.experienceScoring.matchExperience,
    ['relevantYearsWeight', 'generalYearsFallbackWeight']
  );

  const proceedMin = clamp(
    safeNumber(rawThresholds.proceedMin, DEFAULT_METHOD_CONFIG.recommendationThresholds.proceedMin),
    0,
    100
  );
  const reviewMin = clamp(
    safeNumber(rawThresholds.reviewMin, DEFAULT_METHOD_CONFIG.recommendationThresholds.reviewMin),
    0,
    proceedMin
  );

  return {
    version: toText(raw.version) || DEFAULT_METHOD_CONFIG.version,
    profileWeights,
    matchWeights,
    matchPenalties: {
      criticalMissingPenaltyPerSkill: clamp(
        safeNumber(
          rawMatchPenalties.criticalMissingPenaltyPerSkill,
          DEFAULT_METHOD_CONFIG.matchPenalties.criticalMissingPenaltyPerSkill
        ),
        0,
        1
      ),
      maxCriticalPenalty: clamp(
        safeNumber(rawMatchPenalties.maxCriticalPenalty, DEFAULT_METHOD_CONFIG.matchPenalties.maxCriticalPenalty),
        0,
        1
      ),
      criticalMissingProceedBlockThreshold: clamp(
        safeNumber(
          rawMatchPenalties.criticalMissingProceedBlockThreshold,
          DEFAULT_METHOD_CONFIG.matchPenalties.criticalMissingProceedBlockThreshold
        ),
        0,
        20
      ),
    },
    matchSkillTiers: {
      exact: clamp(
        safeNumber(rawMatchSkillTiers.exact, DEFAULT_METHOD_CONFIG.matchSkillTiers.exact),
        0,
        1
      ),
      synonym: clamp(
        safeNumber(rawMatchSkillTiers.synonym, DEFAULT_METHOD_CONFIG.matchSkillTiers.synonym),
        0,
        1
      ),
      related: clamp(
        safeNumber(rawMatchSkillTiers.related, DEFAULT_METHOD_CONFIG.matchSkillTiers.related),
        0,
        1
      ),
      none: clamp(
        safeNumber(rawMatchSkillTiers.none, DEFAULT_METHOD_CONFIG.matchSkillTiers.none),
        0,
        1
      ),
    },
    recommendationThresholds: {
      proceedMin,
      reviewMin,
    },
    hardSkillsScoring: {
      coreSkillLimit: clamp(
        safeNumber(
          rawHardSkillsScoring.coreSkillLimit,
          DEFAULT_METHOD_CONFIG.hardSkillsScoring.coreSkillLimit
        ),
        1,
        20
      ),
      coreDecay: clamp(
        safeNumber(rawHardSkillsScoring.coreDecay, DEFAULT_METHOD_CONFIG.hardSkillsScoring.coreDecay),
        0.3,
        1
      ),
      supportingWeight: clamp(
        safeNumber(
          rawHardSkillsScoring.supportingWeight,
          DEFAULT_METHOD_CONFIG.hardSkillsScoring.supportingWeight
        ),
        0,
        1
      ),
      supportingDecay: clamp(
        safeNumber(
          rawHardSkillsScoring.supportingDecay,
          DEFAULT_METHOD_CONFIG.hardSkillsScoring.supportingDecay
        ),
        0.2,
        1
      ),
      scorePerUnit: clamp(
        safeNumber(rawHardSkillsScoring.scorePerUnit, DEFAULT_METHOD_CONFIG.hardSkillsScoring.scorePerUnit),
        0.1,
        5
      ),
      maxScore: clamp(
        safeNumber(rawHardSkillsScoring.maxScore, DEFAULT_METHOD_CONFIG.hardSkillsScoring.maxScore),
        1,
        10
      ),
      evidenceBonusCapPerSkill: clamp(
        safeNumber(
          rawHardSkillsScoring.evidenceBonusCapPerSkill,
          DEFAULT_METHOD_CONFIG.hardSkillsScoring.evidenceBonusCapPerSkill
        ),
        0,
        5
      ),
      sourceBonuses: {
        technologies: clamp(
          safeNumber(
            rawHardSkillSourceBonuses.technologies,
            DEFAULT_METHOD_CONFIG.hardSkillsScoring.sourceBonuses.technologies
          ),
          0,
          2
        ),
        position: clamp(
          safeNumber(
            rawHardSkillSourceBonuses.position,
            DEFAULT_METHOD_CONFIG.hardSkillsScoring.sourceBonuses.position
          ),
          0,
          2
        ),
        summary: clamp(
          safeNumber(
            rawHardSkillSourceBonuses.summary,
            DEFAULT_METHOD_CONFIG.hardSkillsScoring.sourceBonuses.summary
          ),
          0,
          2
        ),
        experience: clamp(
          safeNumber(
            rawHardSkillSourceBonuses.experience,
            DEFAULT_METHOD_CONFIG.hardSkillsScoring.sourceBonuses.experience
          ),
          0,
          2
        ),
      },
      priorityBonuses: {
        topSkill: clamp(
          safeNumber(
            rawHardSkillPriorityBonuses.topSkill,
            DEFAULT_METHOD_CONFIG.hardSkillsScoring.priorityBonuses.topSkill
          ),
          0,
          1
        ),
        topTechnology: clamp(
          safeNumber(
            rawHardSkillPriorityBonuses.topTechnology,
            DEFAULT_METHOD_CONFIG.hardSkillsScoring.priorityBonuses.topTechnology
          ),
          0,
          1
        ),
        topWindow: clamp(
          safeNumber(
            rawHardSkillPriorityBonuses.topWindow,
            DEFAULT_METHOD_CONFIG.hardSkillsScoring.priorityBonuses.topWindow
          ),
          1,
          10
        ),
      },
    },
    softSkillsScoring: {
      scorePerUnit: clamp(
        safeNumber(rawSoftSkillsScoring.scorePerUnit, DEFAULT_METHOD_CONFIG.softSkillsScoring.scorePerUnit),
        0.1,
        5
      ),
      decay: clamp(
        safeNumber(rawSoftSkillsScoring.decay, DEFAULT_METHOD_CONFIG.softSkillsScoring.decay),
        0.2,
        1
      ),
      maxScore: clamp(
        safeNumber(rawSoftSkillsScoring.maxScore, DEFAULT_METHOD_CONFIG.softSkillsScoring.maxScore),
        0,
        10
      ),
      hardProfileUnlockMinRatio: clamp(
        safeNumber(
          rawSoftSkillsScoring.hardProfileUnlockMinRatio,
          DEFAULT_METHOD_CONFIG.softSkillsScoring.hardProfileUnlockMinRatio
        ),
        0,
        1
      ),
      hardProfileFullUnlockScore: clamp(
        safeNumber(
          rawSoftSkillsScoring.hardProfileFullUnlockScore,
          DEFAULT_METHOD_CONFIG.softSkillsScoring.hardProfileFullUnlockScore
        ),
        1,
        10
      ),
    },
    experienceScoring: {
      profileYearsBlend: {
        ...profileYearsBlend,
        dampeningStartScore: clamp(
          safeNumber(
            rawProfileYearsBlend.dampeningStartScore,
            DEFAULT_METHOD_CONFIG.experienceScoring.profileYearsBlend.dampeningStartScore
          ),
          1,
          10
        ),
        dampeningStrength: clamp(
          safeNumber(
            rawProfileYearsBlend.dampeningStrength,
            DEFAULT_METHOD_CONFIG.experienceScoring.profileYearsBlend.dampeningStrength
          ),
          0,
          1
        ),
        minimumWeightMultiplier: clamp(
          safeNumber(
            rawProfileYearsBlend.minimumWeightMultiplier,
            DEFAULT_METHOD_CONFIG.experienceScoring.profileYearsBlend.minimumWeightMultiplier
          ),
          0.1,
          1
        ),
      },
      relevantExperienceHeuristic: {
        minimumRelevantRatio: clamp(
          safeNumber(
            rawRelevantExperienceHeuristic.minimumRelevantRatio,
            DEFAULT_METHOD_CONFIG.experienceScoring.relevantExperienceHeuristic.minimumRelevantRatio
          ),
          0,
          1
        ),
        roleRecencyDecay: clamp(
          safeNumber(
            rawRelevantExperienceHeuristic.roleRecencyDecay,
            DEFAULT_METHOD_CONFIG.experienceScoring.relevantExperienceHeuristic.roleRecencyDecay
          ),
          0.2,
          1
        ),
        titleOverlapWeight: clamp(
          safeNumber(
            rawRelevantExperienceHeuristic.titleOverlapWeight,
            DEFAULT_METHOD_CONFIG.experienceScoring.relevantExperienceHeuristic.titleOverlapWeight
          ),
          0,
          1
        ),
        skillOverlapWeight: clamp(
          safeNumber(
            rawRelevantExperienceHeuristic.skillOverlapWeight,
            DEFAULT_METHOD_CONFIG.experienceScoring.relevantExperienceHeuristic.skillOverlapWeight
          ),
          0,
          1
        ),
        currentRoleBonus: clamp(
          safeNumber(
            rawRelevantExperienceHeuristic.currentRoleBonus,
            DEFAULT_METHOD_CONFIG.experienceScoring.relevantExperienceHeuristic.currentRoleBonus
          ),
          0,
          1
        ),
      },
      matchExperience: {
        ...matchExperienceWeights,
        noRequirementDefaultYears: clamp(
          safeNumber(
            rawMatchExperience.noRequirementDefaultYears,
            DEFAULT_METHOD_CONFIG.experienceScoring.matchExperience.noRequirementDefaultYears
          ),
          0.5,
          10
        ),
      },
    },
    languageScoresByCount: {
      0: safeNumber(rawLanguageScores[0], DEFAULT_METHOD_CONFIG.languageScoresByCount[0]),
      1: safeNumber(rawLanguageScores[1], DEFAULT_METHOD_CONFIG.languageScoresByCount[1]),
      2: safeNumber(rawLanguageScores[2], DEFAULT_METHOD_CONFIG.languageScoresByCount[2]),
      3: safeNumber(rawLanguageScores[3], DEFAULT_METHOD_CONFIG.languageScoresByCount[3]),
      '4plus': safeNumber(
        rawLanguageScores['4plus'],
        DEFAULT_METHOD_CONFIG.languageScoresByCount['4plus']
      ),
    },
    educationScores: {
      empty: safeNumber(rawEducationScores.empty, DEFAULT_METHOD_CONFIG.educationScores.empty),
      other: safeNumber(rawEducationScores.other, DEFAULT_METHOD_CONFIG.educationScores.other),
      bachelor: safeNumber(rawEducationScores.bachelor, DEFAULT_METHOD_CONFIG.educationScores.bachelor),
      master: safeNumber(rawEducationScores.master, DEFAULT_METHOD_CONFIG.educationScores.master),
      phd: safeNumber(rawEducationScores.phd, DEFAULT_METHOD_CONFIG.educationScores.phd),
    },
    yearsScoreBands: normalizeYearsBands(raw.yearsScoreBands, DEFAULT_METHOD_CONFIG.yearsScoreBands),
  };
}

const METHOD_CONFIG = loadMethodConfig();

// --- РќРѕСЂРјР°Р»С–Р·Р°С†С–СЏ РїСЂРѕС„С–Р»СЋ РєР°РЅРґРёРґР°С‚Р° ---
function safeYears(rawYears) {
  const years = Number(rawYears);
  if (!Number.isFinite(years)) return 0;
  return clamp(years, 0, 50);
}

function normalizeLevel(rawLevel) {
  const level = toText(rawLevel);
  if (LEVEL_VALUES.includes(level)) return level;
  return 'Junior';
}

// Р‘Р°Р·РѕРІР° Р»РѕРіС–РєР° СЂС–РІРЅСЏ Р·Р° СЂРѕРєР°РјРё РґРѕСЃРІС–РґСѓ.
function inferLevelFromYears(years) {
  if (years >= 5) return 'Senior';
  if (years >= 2) return 'Middle';
  return 'Junior';
}

// РџРµСЂРµС‚РІРѕСЂРµРЅРЅСЏ СЂРѕРєС–РІ РґРѕСЃРІС–РґСѓ Сѓ С€РєР°Р»Сѓ 1..10 РїРѕ С‚Р°Р±Р»РёС†С– bands Р· РєРѕРЅС„С–РіР°.
function yearsToTenPointScore(years) {
  for (const band of METHOD_CONFIG.yearsScoreBands) {
    if (years <= band.maxYears) {
      return band.score;
    }
  }
  return 10;
}

// РћС†С–РЅРєР° РѕСЃРІС–С‚Рё Р·Р° РєР»СЋС‡РѕРІРёРјРё СЃР»РѕРІР°РјРё.
function educationToScore(educationRaw) {
  const education = toLower(educationRaw);
  if (!education) return METHOD_CONFIG.educationScores.empty;
  if (education.includes('phd') || education.includes('doctor')) return METHOD_CONFIG.educationScores.phd;
  if (education.includes('master')) return METHOD_CONFIG.educationScores.master;
  if (education.includes('bachelor')) return METHOD_CONFIG.educationScores.bachelor;
  return METHOD_CONFIG.educationScores.other;
}

// РћС†С–РЅРєР° РјРѕРІ: С‡РёРј Р±С–Р»СЊС€Рµ СѓРЅС–РєР°Р»СЊРЅРёС… РјРѕРІ, С‚РёРј РІРёС‰РёР№ Р±Р°Р».
function languagesToScore(languages = []) {
  const count = uniqueStrings(languages).length;
  if (count <= 0) return METHOD_CONFIG.languageScoresByCount[0];
  if (count === 1) return METHOD_CONFIG.languageScoresByCount[1];
  if (count === 2) return METHOD_CONFIG.languageScoresByCount[2];
  if (count === 3) return METHOD_CONFIG.languageScoresByCount[3];
  return METHOD_CONFIG.languageScoresByCount['4plus'];
}

function buildHardSkillEntries(analysis = {}) {
  const positionText = toText(analysis.position);
  const summaryText = toText(analysis.summary);
  const experienceText = extractExperienceEvidenceTexts(analysis).join(' ');
  const entries = new Map();

  const addSkillSource = (value, source, index) => {
    const key = normalizeSkill(value);
    if (!key) return;
    if (!entries.has(key)) {
      entries.set(key, {
        key,
        label: toText(value),
        inSkills: false,
        inTechnologies: false,
        skillIndex: Number.POSITIVE_INFINITY,
        technologyIndex: Number.POSITIVE_INFINITY,
      });
    }

    const entry = entries.get(key);
    if (source === 'skills') {
      entry.inSkills = true;
      entry.skillIndex = Math.min(entry.skillIndex, index);
    }
    if (source === 'technologies') {
      entry.inTechnologies = true;
      entry.technologyIndex = Math.min(entry.technologyIndex, index);
    }
  };

  (analysis.skills || []).forEach((skill, index) => addSkillSource(skill, 'skills', index));
  (analysis.technologies || []).forEach((skill, index) => addSkillSource(skill, 'technologies', index));

  const topWindow = METHOD_CONFIG.hardSkillsScoring.priorityBonuses.topWindow;

  return [...entries.values()].map((entry) => {
    const inPosition = textIncludesSkill(positionText, entry.key);
    const inSummary = textIncludesSkill(summaryText, entry.key);
    const inExperience = textIncludesSkill(experienceText, entry.key);

    const sourceCount = [
      entry.inSkills,
      entry.inTechnologies,
      inPosition,
      inSummary,
      inExperience,
    ].filter(Boolean).length;

    let evidenceBonus = 0;
    if (entry.inSkills && entry.inTechnologies) {
      evidenceBonus += METHOD_CONFIG.hardSkillsScoring.sourceBonuses.technologies;
    }
    if (inPosition) {
      evidenceBonus += METHOD_CONFIG.hardSkillsScoring.sourceBonuses.position;
    }
    if (inSummary) {
      evidenceBonus += METHOD_CONFIG.hardSkillsScoring.sourceBonuses.summary;
    }
    if (inExperience) {
      evidenceBonus += METHOD_CONFIG.hardSkillsScoring.sourceBonuses.experience;
    }

    let priorityBonus = 0;
    if (Number.isFinite(entry.skillIndex) && entry.skillIndex < topWindow) {
      priorityBonus +=
        METHOD_CONFIG.hardSkillsScoring.priorityBonuses.topSkill *
        ((topWindow - entry.skillIndex) / topWindow);
    }
    if (Number.isFinite(entry.technologyIndex) && entry.technologyIndex < topWindow) {
      priorityBonus +=
        METHOD_CONFIG.hardSkillsScoring.priorityBonuses.topTechnology *
        ((topWindow - entry.technologyIndex) / topWindow);
    }

    const cappedEvidenceBonus = clamp(
      evidenceBonus + priorityBonus,
      0,
      METHOD_CONFIG.hardSkillsScoring.evidenceBonusCapPerSkill
    );

    return {
      ...entry,
      inPosition,
      inSummary,
      inExperience,
      sortIndex: Math.min(entry.skillIndex, entry.technologyIndex),
      sourceCount,
      evidenceBonus: round(cappedEvidenceBonus),
      rankingScore: round(1 + cappedEvidenceBonus + sourceCount * 0.2),
    };
  });
}

function hardSkillsToScore(analysis = {}) {
  const entries = buildHardSkillEntries(analysis).sort((a, b) => {
    if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
    if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
    return a.label.localeCompare(b.label);
  });

  const coreSkillLimit = METHOD_CONFIG.hardSkillsScoring.coreSkillLimit;
  let effectiveHardSkillCount = 0;
  let evidenceBonusTotal = 0;

  const rankedSkills = entries.map((entry, index) => {
    const isCore = index < coreSkillLimit;
    const rankIndex = isCore ? index : index - coreSkillLimit;
    const decay = isCore
      ? Math.pow(METHOD_CONFIG.hardSkillsScoring.coreDecay, rankIndex)
      : METHOD_CONFIG.hardSkillsScoring.supportingWeight *
        Math.pow(METHOD_CONFIG.hardSkillsScoring.supportingDecay, rankIndex);
    const contribution = (1 + entry.evidenceBonus) * decay;
    effectiveHardSkillCount += contribution;
    evidenceBonusTotal += entry.evidenceBonus;

    return {
      name: entry.label,
      bucket: isCore ? 'core' : 'supporting',
      sourceCount: entry.sourceCount,
      evidenceBonus: entry.evidenceBonus,
      contribution: round(contribution),
      evidence: {
        skills: entry.inSkills,
        technologies: entry.inTechnologies,
        position: entry.inPosition,
        summary: entry.inSummary,
        experience: entry.inExperience,
      },
    };
  });

  const rawHardSkillCount = entries.length;
  const rawScore = effectiveHardSkillCount * METHOD_CONFIG.hardSkillsScoring.scorePerUnit;
  const cappedScore = clamp(rawScore, 0, METHOD_CONFIG.hardSkillsScoring.maxScore);

  return {
    score: cappedScore,
    meta: {
      rawHardSkillCount,
      effectiveHardSkillCount: round(effectiveHardSkillCount),
      evidenceBonus: round(evidenceBonusTotal),
      rawScore: round(rawScore),
      cappedScore: round(cappedScore),
      coreSkillCount: Math.min(rawHardSkillCount, coreSkillLimit),
      supportingSkillCount: Math.max(rawHardSkillCount - coreSkillLimit, 0),
      rankedSkills: rankedSkills.slice(0, 10),
    },
  };
}

function softSkillsToScore(softSkills = [], hardSkillsScore = 0) {
  const normalizedSoftSkills = uniqueSkills(softSkills);
  let effectiveSoftSkillCount = 0;

  normalizedSoftSkills.forEach((_skill, index) => {
    effectiveSoftSkillCount += Math.pow(METHOD_CONFIG.softSkillsScoring.decay, index);
  });

  const rawScore = effectiveSoftSkillCount * METHOD_CONFIG.softSkillsScoring.scorePerUnit;
  const hardProfileUnlockRatio = clamp(
    hardSkillsScore / METHOD_CONFIG.softSkillsScoring.hardProfileFullUnlockScore,
    0,
    1
  );
  const capRatio =
    METHOD_CONFIG.softSkillsScoring.hardProfileUnlockMinRatio +
    hardProfileUnlockRatio * (1 - METHOD_CONFIG.softSkillsScoring.hardProfileUnlockMinRatio);
  const effectiveCap = METHOD_CONFIG.softSkillsScoring.maxScore * capRatio;
  const cappedScore = clamp(rawScore, 0, effectiveCap);

  return {
    score: cappedScore,
    meta: {
      rawSoftSkillCount: normalizedSoftSkills.length,
      effectiveSoftSkillCount: round(effectiveSoftSkillCount),
      rawScore: round(rawScore),
      cappedScore: round(cappedScore),
      softSkillCap: round(effectiveCap),
      hardProfileUnlockRatio: round(hardProfileUnlockRatio),
      capRatio: round(capRatio),
      capApplied: rawScore > effectiveCap,
    },
  };
}

function normalizeAnalysisForScoring(analysis = {}) {
  const generalYears = safeYears(
    analysis.generalYearsExperience ?? analysis.yearsOfExperience
  );
  const hasRelevantYears =
    analysis.relevantYearsExperience !== null &&
    analysis.relevantYearsExperience !== undefined &&
    analysis.relevantYearsExperience !== '';
  const relevantYearsRaw = hasRelevantYears ? safeNumber(analysis.relevantYearsExperience, NaN) : NaN;
  const relevantYears = Number.isFinite(relevantYearsRaw)
    ? clamp(relevantYearsRaw, 0, generalYears > 0 ? generalYears : 50)
    : null;
  const inferredLevel = inferLevelFromYears(generalYears);
  const level = LEVEL_VALUES.includes(analysis.level) ? analysis.level : inferredLevel;

  return {
    firstName: toText(analysis.firstName),
    lastName: toText(analysis.lastName),
    email: toText(analysis.email),
    phone: toText(analysis.phone),
    position: toText(analysis.position),
    linkedin: toText(analysis.linkedin),
    skills: uniqueStrings(Array.isArray(analysis.skills) ? analysis.skills : []),
    level,
    yearsOfExperience: generalYears,
    generalYearsExperience: generalYears,
    relevantYearsExperience: relevantYears,
    technologies: uniqueStrings(Array.isArray(analysis.technologies) ? analysis.technologies : []),
    softSkills: uniqueStrings(Array.isArray(analysis.softSkills) ? analysis.softSkills : []),
    overallScore: Number.isFinite(Number(analysis.overallScore)) ? Number(analysis.overallScore) : 0,
    summary: toText(analysis.summary),
    education: toText(analysis.education),
    languages: uniqueStrings(Array.isArray(analysis.languages) ? analysis.languages : []),
  };
}

// РћСЃРЅРѕРІРЅР° С„РѕСЂРјСѓР»Р° РїСЂРѕС„С–Р»СЊРЅРѕРіРѕ Р±Р°Р»Сѓ:
// overallScore = years*w1 + hardSkills*w2 + softSkills*w3 + languages*w4 + education*w5
function computeProfileScoringBreakdown(normalizedAnalysis, rawAnalysis = normalizedAnalysis) {
  const hardSkills = hardSkillsToScore({ ...rawAnalysis, ...normalizedAnalysis });
  const softSkills = softSkillsToScore(normalizedAnalysis.softSkills, hardSkills.score);
  const hardSkillsScore = hardSkills.score;
  const softSkillsScore = softSkills.score;
  const languageScore = languagesToScore(normalizedAnalysis.languages);
  const educationScore = educationToScore(normalizedAnalysis.education);
  const experience = buildExperienceSignals(normalizedAnalysis, rawAnalysis);
  const profileYearsBlend = METHOD_CONFIG.experienceScoring.profileYearsBlend;
  const blendedYears =
    experience.generalYears * profileYearsBlend.generalYearsShare +
    experience.relevantYears * profileYearsBlend.relevantYearsShare;
  const yearsScore = yearsToTenPointScore(blendedYears);
  const nonYearsSignal =
    (
      hardSkillsScore * METHOD_CONFIG.profileWeights.hardSkills +
      softSkillsScore * METHOD_CONFIG.profileWeights.softSkills +
      languageScore * METHOD_CONFIG.profileWeights.languages +
      educationScore * METHOD_CONFIG.profileWeights.education
    ) /
    Math.max(1 - METHOD_CONFIG.profileWeights.years, 0.0001);

  let yearsWeightMultiplier = 1;
  if (nonYearsSignal > profileYearsBlend.dampeningStartScore) {
    const normalizedExcess =
      (nonYearsSignal - profileYearsBlend.dampeningStartScore) /
      Math.max(10 - profileYearsBlend.dampeningStartScore, 0.0001);
    yearsWeightMultiplier = clamp(
      1 - normalizedExcess * profileYearsBlend.dampeningStrength,
      profileYearsBlend.minimumWeightMultiplier,
      1
    );
  }

  const effectiveWeights = normalizeWeights(
    {
      years: METHOD_CONFIG.profileWeights.years * yearsWeightMultiplier,
      hardSkills: METHOD_CONFIG.profileWeights.hardSkills,
      softSkills: METHOD_CONFIG.profileWeights.softSkills,
      languages: METHOD_CONFIG.profileWeights.languages,
      education: METHOD_CONFIG.profileWeights.education,
    },
    METHOD_CONFIG.profileWeights,
    ['years', 'hardSkills', 'softSkills', 'languages', 'education']
  );

  const weighted =
    yearsScore * effectiveWeights.years +
    hardSkillsScore * effectiveWeights.hardSkills +
    softSkillsScore * effectiveWeights.softSkills +
    languageScore * effectiveWeights.languages +
    educationScore * effectiveWeights.education;

  const overallScore = clamp(Math.round(weighted), 1, 10);
  const level = inferLevelFromYears(normalizedAnalysis.generalYearsExperience);

  return {
    overallScore,
    level,
    components: {
      yearsScore: round(yearsScore),
      hardSkillsScore: round(hardSkillsScore),
      softSkillsScore: round(softSkillsScore),
      languageScore: round(languageScore),
      educationScore: round(educationScore),
    },
    experience: {
      generalYears: round(experience.generalYears),
      relevantYears: round(experience.relevantYears),
      blendedYears: round(blendedYears),
      source: experience.source,
      yearsWeightMultiplier: round(yearsWeightMultiplier),
      nonYearsSignal: round(nonYearsSignal),
      experienceEvidence: experience.experienceEvidence,
    },
    skillDetails: {
      hardSkills: hardSkills.meta,
      softSkills: softSkills.meta,
    },
    weights: effectiveWeights,
    configuredWeights: METHOD_CONFIG.profileWeights,
  };
}

// РџСѓР±Р»С–С‡РЅР° С„СѓРЅРєС†С–СЏ: РїРѕРІРµСЂС‚Р°С” РїСЂРѕС„С–Р»СЊ РєР°РЅРґРёРґР°С‚Р° Р· РїРµСЂРµСЂР°С…РѕРІР°РЅРёРј overallScore С‚Р° breakdown.
function applyDeterministicProfileScoring(analysis = {}) {
  const normalized = normalizeAnalysisForScoring(analysis);
  const breakdown = computeProfileScoringBreakdown(normalized, analysis);
  return {
    ...normalized,
    overallScore: breakdown.overallScore,
    level: breakdown.level,
    yearsOfExperience: breakdown.experience.generalYears,
    generalYearsExperience: breakdown.experience.generalYears,
    relevantYearsExperience: breakdown.experience.relevantYears,
    scoringMeta: {
      method: `${METHOD_CONFIG.version}-profile`,
      breakdown,
    },
  };
}

// --- РќРѕСЂРјР°Р»С–Р·Р°С†С–СЏ РІР°РєР°РЅСЃС–С— / fit-РєРѕРјРїРѕРЅРµРЅС‚Рё ---
function levelToRank(levelRaw) {
  const level = normalizeLevel(levelRaw);
  if (level === 'Senior') return 3;
  if (level === 'Middle') return 2;
  return 1;
}

// Р•РІСЂРёСЃС‚РёС‡РЅРѕ РІРёР·РЅР°С‡Р°С” РѕС‡С–РєСѓРІР°РЅРёР№ СЂС–РІРµРЅСЊ РІР°РєР°РЅСЃС–С— Р· title/description/requirements.
function inferExpectedLevel(job = {}) {
  const haystack = toLower(
    `${toText(job.title)} ${toText(job.description)} ${(job.requirements || []).join(' ')}`
  );
  if (haystack.includes('senior') || haystack.includes('lead') || haystack.includes('architect')) return 'Senior';
  if (haystack.includes('middle') || haystack.includes('mid-level') || haystack.includes('mid level')) return 'Middle';
  if (haystack.includes('junior') || haystack.includes('trainee') || haystack.includes('intern')) return 'Junior';
  return null;
}

// РџСЂРѕР±СѓС” РІРёС‚СЏРіРЅСѓС‚Рё required years Р· С‚РµРєСЃС‚Сѓ РІР°РєР°РЅСЃС–С—.
function extractRequiredYears(job = {}) {
  const haystack = `${toText(job.title)} ${toText(job.description)} ${(job.requirements || []).join(' ')}`;
  const match = haystack.match(/(\d{1,2})\+?\s*(years|year|yrs|yr)/i);
  if (!match) return null;
  return safeYears(match[1]);
}

const CRITICAL_REQUIREMENT_MARKERS = ['must have', 'must-have', 'required', 'mandatory', 'essential'];
const OPTIONAL_REQUIREMENT_MARKERS = ['nice to have', 'nice-to-have', 'preferred', 'plus', 'bonus'];

const SKILL_SYNONYM_GROUPS = [
  ['javascript', 'js'],
  ['typescript', 'ts'],
  ['node.js', 'node', 'nodejs'],
  ['react', 'react.js', 'reactjs'],
  ['vue', 'vue.js', 'vuejs'],
  ['angular', 'angular.js', 'angularjs'],
  ['next.js', 'nextjs'],
  ['nestjs', 'nest.js'],
  ['postgresql', 'postgres'],
  ['mongodb', 'mongo'],
  ['kubernetes', 'k8s'],
  ['aws', 'amazon web services'],
  ['gcp', 'google cloud platform'],
  ['rest api', 'rest', 'restful api'],
  ['ci/cd', 'cicd', 'continuous integration', 'continuous delivery'],
  ['qa', 'quality assurance'],
];

const RELATED_SKILL_GROUPS = [
  ['javascript', 'typescript', 'node.js', 'react', 'vue', 'angular', 'next.js'],
  ['node.js', 'express', 'nestjs', 'rest api', 'graphql', 'microservices'],
  ['sql', 'postgresql', 'mysql', 'mongodb', 'redis'],
  ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ci/cd'],
  ['qa', 'testing', 'playwright', 'cypress', 'selenium', 'jest'],
  ['python', 'django', 'flask', 'fastapi', 'pandas'],
  ['php', 'laravel', 'symfony'],
];

function canonicalSkill(value) {
  return normalizeSkill(value)
    .replace(/\bc\+\+\b/g, 'cpp')
    .replace(/\bc#\b/g, 'csharp')
    .replace(/\.js\b/g, 'js')
    .replace(/[^a-z0-9]+/g, '');
}

function buildAliasLookup(groups = []) {
  const map = new Map();
  for (const group of groups) {
    const canonicalGroupKey = canonicalSkill(group[0]);
    for (const item of group) {
      map.set(canonicalSkill(item), canonicalGroupKey);
    }
  }
  return map;
}

const SKILL_ALIAS_LOOKUP = buildAliasLookup(SKILL_SYNONYM_GROUPS);

function buildRelatedLookup(groups = []) {
  const map = new Map();
  groups.forEach((group, index) => {
    group.forEach((item) => {
      const aliasKey = SKILL_ALIAS_LOOKUP.get(canonicalSkill(item)) || canonicalSkill(item);
      map.set(aliasKey, `group-${index}`);
    });
  });
  return map;
}

const RELATED_SKILL_LOOKUP = buildRelatedLookup(RELATED_SKILL_GROUPS);

function tokenizeSkill(value) {
  return uniqueSkills(
    normalizeSkill(value)
      .replace(/[^a-z0-9+#.]+/g, ' ')
      .split(/\s+/)
      .filter((token) => token && !['developer', 'engineer', 'experience', 'knowledge'].includes(token))
  );
}

function cleanSkillFragment(fragment = '') {
  const cleaned = toText(fragment)
    .replace(
      /\b(must have|must-have|required|mandatory|essential|nice to have|nice-to-have|preferred|plus|bonus)\b[:\s-]*/ig,
      ''
    )
    .replace(
      /\b(experience with|hands-on experience with|strong knowledge of|knowledge of|proficiency in|proficient in|familiarity with|understanding of|expertise in|working knowledge of)\b/ig,
      ''
    )
    .replace(/\(\s*(preferred|plus|optional)\s*\)/ig, '')
    .replace(/\b\d{1,2}\+?\s*(years|year|yrs|yr)\b/ig, '')
    .replace(/\bexperience\b/ig, '')
    .replace(/\bof experience\b/ig, '')
    .replace(/^[\s:,\-/|]+|[\s:,\-/|]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const normalized = normalizeSkill(cleaned);
  if (!normalized) return '';
  if (
    ['experience', 'knowledge', 'required', 'mandatory', 'preferred', 'bonus', 'backend', 'frontend', 'fullstack', 'full stack'].includes(normalized)
  ) return '';
  return cleaned;
}

function splitSkillFragments(text = '') {
  const normalizedText = toText(text)
    .replace(/\r?\n/g, ', ')
    .replace(/\s+(and|&)\s+/gi, ', ')
    .replace(/\s+\/\s+/g, ', ');

  return uniqueStrings(
    normalizedText
      .split(/[;,|]+/)
      .map((fragment) => cleanSkillFragment(fragment))
      .filter(Boolean)
  );
}

function detectRequirementBucket(text = '') {
  const normalized = toLower(text);
  if (OPTIONAL_REQUIREMENT_MARKERS.some((marker) => normalized.includes(marker))) return 'optional';
  if (CRITICAL_REQUIREMENT_MARKERS.some((marker) => normalized.includes(marker))) return 'critical';
  return 'core';
}

function buildVacancySkillBuckets(job = {}) {
  const critical = new Map();
  const core = new Map();
  const optional = new Map();

  const addSkill = (bucket, skill) => {
    const normalized = normalizeSkill(skill);
    if (!normalized) return;
    if (critical.has(normalized) || core.has(normalized) || optional.has(normalized)) return;
    bucket.set(normalized, toText(skill));
  };

  const explicitCritical = Array.isArray(job.criticalSkills) ? job.criticalSkills : [];
  const explicitCore = Array.isArray(job.coreSkills) ? job.coreSkills : [];
  const explicitOptional = Array.isArray(job.optionalSkills) ? job.optionalSkills : [];
  const hasExplicitBuckets = explicitCritical.length > 0 || explicitCore.length > 0 || explicitOptional.length > 0;

  explicitCritical.forEach((skill) => addSkill(critical, skill));
  explicitCore.forEach((skill) => addSkill(core, skill));
  explicitOptional.forEach((skill) => addSkill(optional, skill));

  const requirements = Array.isArray(job.requirements) ? job.requirements : [];
  requirements.forEach((item) => {
    const bucketName = detectRequirementBucket(item);
    const fragments = splitSkillFragments(item);
    const targetBucket = bucketName === 'critical' ? critical : bucketName === 'optional' ? optional : core;
    if (!fragments.length) return;
    fragments.forEach((fragment) => addSkill(targetBucket, fragment));
  });

  const stack = Array.isArray(job.stack) ? job.stack : [];
  stack.forEach((item) => addSkill(core, item));

  return {
    criticalSkills: [...critical.values()],
    coreSkills: [...core.values()],
    optionalSkills: [...optional.values()],
  };
}

function buildCandidateSkillEntries(analysis = {}) {
  return uniqueStrings([
    ...(Array.isArray(analysis.skills) ? analysis.skills : []),
    ...(Array.isArray(analysis.technologies) ? analysis.technologies : []),
  ]).map((skill) => {
    const canonical = canonicalSkill(skill);
    const aliasKey = SKILL_ALIAS_LOOKUP.get(canonical) || canonical;
    return {
      label: skill,
      normalized: normalizeSkill(skill),
      canonical,
      aliasKey,
      relatedGroup: RELATED_SKILL_LOOKUP.get(aliasKey) || null,
      tokens: tokenizeSkill(skill),
    };
  });
}

function isRelatedSkill(requiredEntry, candidateEntry) {
  if (requiredEntry.relatedGroup && requiredEntry.relatedGroup === candidateEntry.relatedGroup) return true;

  const requiredTokens = requiredEntry.tokens || [];
  const candidateTokens = candidateEntry.tokens || [];
  if (!requiredTokens.length || !candidateTokens.length) return false;

  const overlap = requiredTokens.filter((token) => candidateTokens.includes(token)).length;
  const minTokenCount = Math.min(requiredTokens.length, candidateTokens.length);
  return minTokenCount > 0 ? overlap / minTokenCount >= 0.5 : false;
}

function getTierLabel(score) {
  if (score >= METHOD_CONFIG.matchSkillTiers.exact) return 'exact';
  if (score >= METHOD_CONFIG.matchSkillTiers.synonym) return 'synonym';
  if (score >= METHOD_CONFIG.matchSkillTiers.related) return 'related';
  return 'none';
}

function findBestSkillMatch(requiredSkill, candidateEntries = []) {
  const requiredCanonical = canonicalSkill(requiredSkill);
  const requiredAliasKey = SKILL_ALIAS_LOOKUP.get(requiredCanonical) || requiredCanonical;
  const requiredEntry = {
    label: requiredSkill,
    normalized: normalizeSkill(requiredSkill),
    canonical: requiredCanonical,
    aliasKey: requiredAliasKey,
    relatedGroup: RELATED_SKILL_LOOKUP.get(requiredAliasKey) || null,
    tokens: tokenizeSkill(requiredSkill),
  };

  let best = {
    requiredSkill,
    matchedSkill: null,
    tier: 'none',
    score: METHOD_CONFIG.matchSkillTiers.none,
  };

  for (const candidateEntry of candidateEntries) {
    let score = METHOD_CONFIG.matchSkillTiers.none;
    if (candidateEntry.normalized === requiredEntry.normalized) {
      score = METHOD_CONFIG.matchSkillTiers.exact;
    } else if (candidateEntry.aliasKey === requiredEntry.aliasKey) {
      score = METHOD_CONFIG.matchSkillTiers.synonym;
    } else if (isRelatedSkill(requiredEntry, candidateEntry)) {
      score = METHOD_CONFIG.matchSkillTiers.related;
    }

    if (score > best.score) {
      best = {
        requiredSkill,
        matchedSkill: candidateEntry.label,
        tier: getTierLabel(score),
        score,
      };
    }
  }

  return best;
}

function computeBucketMatch(skills = [], candidateEntries = [], category = 'core') {
  const breakdown = skills.map((requiredSkill) => ({
    category,
    ...findBestSkillMatch(requiredSkill, candidateEntries),
  }));

  const matched = breakdown.filter((item) => item.score > 0).map((item) => item.requiredSkill);
  const missing = breakdown.filter((item) => item.score <= 0).map((item) => item.requiredSkill);
  const coverage = breakdown.length
    ? breakdown.reduce((sum, item) => sum + item.score, 0) / breakdown.length
    : null;

  return {
    coverage,
    matched,
    missing,
    breakdown,
  };
}

function normalizeActiveMatchWeights(values = {}) {
  const activeEntries = Object.entries(values).filter(([, value]) => Number.isFinite(value));
  const sum = activeEntries.reduce((acc, [key]) => acc + METHOD_CONFIG.matchWeights[key], 0);
  if (sum <= 0) return {};

  return activeEntries.reduce((acc, [key]) => {
    acc[key] = METHOD_CONFIG.matchWeights[key] / sum;
    return acc;
  }, {});
}

// experienceFit = [0..1], де пріоритет віддається релевантному досвіду,
// а загальний досвід працює як fallback-сигнал.
function computeExperienceFit(experienceSignals, requiredYears) {
  const generalYears = safeYears(experienceSignals?.generalYears);
  const relevantYears = safeYears(experienceSignals?.relevantYears);
  const weights = METHOD_CONFIG.experienceScoring.matchExperience;
  const effectiveYears =
    relevantYears * weights.relevantYearsWeight +
    generalYears * weights.generalYearsFallbackWeight;

  if (!Number.isFinite(requiredYears) || requiredYears <= 0) {
    const defaultYears = weights.noRequirementDefaultYears;
    const fit = clamp(effectiveYears / defaultYears, 0, 1);
    return {
      fit,
      effectiveYears: round(effectiveYears),
      reason:
        relevantYears > 0
          ? `No explicit years requirement. Used blended experience (${round(relevantYears)} relevant, ${round(generalYears)} general) against default ${defaultYears} years.`
          : `No explicit years requirement. Fell back to general experience (${round(generalYears)} years) against default ${defaultYears} years.`,
    };
  }

  const fit = clamp(effectiveYears / requiredYears, 0, 1);
  let reason = `Required ${requiredYears}+ years. Effective experience = ${round(effectiveYears)} (${round(relevantYears)} relevant, ${round(generalYears)} general).`;
  if (relevantYears < requiredYears && generalYears >= requiredYears) {
    reason += ' General years help, but relevant experience remains the primary limiter.';
  } else if (relevantYears >= requiredYears) {
    reason += ' Relevant experience alone is sufficient.';
  }

  return {
    fit,
    effectiveYears: round(effectiveYears),
    reason,
  };
}

// levelFit = [0..1], С€С‚СЂР°С„СѓС” Р·Р° РЅРµРґРѕСЂС–РІРµРЅСЊ/РїРµСЂРµСЂС–РІРµРЅСЊ РІС–РґРЅРѕСЃРЅРѕ РѕС‡С–РєСѓРІР°РЅРѕРіРѕ.
function computeLevelFit(candidateLevel, expectedLevel) {
  if (!expectedLevel) return 0.8;
  const candidateRank = levelToRank(candidateLevel);
  const expectedRank = levelToRank(expectedLevel);
  if (candidateRank === expectedRank) return 1;
  if (candidateRank > expectedRank) return 0.85;
  return candidateRank + 1 === expectedRank ? 0.6 : 0.25;
}

// РџРѕСЂРѕРіРѕРІР° СЂРµРєРѕРјРµРЅРґР°С†С–СЏ Р· РєРѕРЅС„С–РіР°.
function recommendationFromScore(score100) {
  if (score100 >= METHOD_CONFIG.recommendationThresholds.proceedMin) return 'Proceed';
  if (score100 >= METHOD_CONFIG.recommendationThresholds.reviewMin) return 'Review manually';
  return 'Reject';
}

// Р¤РѕСЂРјСѓС” РєРѕСЂРѕС‚РєС– "РїР»СЋСЃРё" РґР»СЏ РїРѕСЏСЃРЅРµРЅРЅСЏ СЂРµР·СѓР»СЊС‚Р°С‚Сѓ.
function buildStrengths(matchDetails, analysis, expectedLevel, requiredYears, experienceContext) {
  const strengths = [];

  if (matchDetails.criticalTotal > 0) {
    strengths.push(`Matched ${matchDetails.matchedCriticalSkills.length} of ${matchDetails.criticalTotal} critical skills`);
  }
  if (matchDetails.coreTotal > 0) {
    strengths.push(`Matched ${matchDetails.matchedCoreSkills.length} of ${matchDetails.coreTotal} core skills`);
  }
  for (const skill of matchDetails.matchedCriticalSkills.slice(0, 2)) {
    strengths.push(`Has critical skill: ${skill}`);
  }
  for (const skill of matchDetails.matchedOptionalSkills.slice(0, 2)) {
    strengths.push(`Has optional bonus skill: ${skill}`);
  }

  if (experienceContext.relevantYears >= 1) {
    strengths.push(`Relevant experience: ${round(experienceContext.relevantYears)} year(s)`);
  } else if (experienceContext.generalYears >= 2) {
    strengths.push(`General experience: ${round(experienceContext.generalYears)} year(s)`);
  }
  if (expectedLevel && normalizeLevel(analysis.level) === expectedLevel) {
    strengths.push(`Level aligns with role: ${analysis.level}`);
  }
  if (requiredYears && experienceContext.fit >= 1) {
    strengths.push(`Meets required experience threshold (${requiredYears}+ years)`);
  }

  return uniqueStrings(strengths).slice(0, 5);
}

// Р¤РѕСЂРјСѓС” РєРѕСЂРѕС‚РєС– "РіРµРїРё" РґР»СЏ РїРѕСЏСЃРЅРµРЅРЅСЏ СЂРµР·СѓР»СЊС‚Р°С‚Сѓ.
function buildGaps(matchDetails, analysis, expectedLevel, requiredYears, experienceContext) {
  const gaps = [];
  for (const skill of matchDetails.missingCriticalSkills.slice(0, 3)) {
    gaps.push(`Missing critical skill: ${skill}`);
  }
  for (const skill of matchDetails.missingCoreSkills.slice(0, 2)) {
    gaps.push(`Missing core skill: ${skill}`);
  }
  if (
    matchDetails.missingCriticalSkills.length >=
    METHOD_CONFIG.matchPenalties.criticalMissingProceedBlockThreshold
  ) {
    gaps.push('Critical-skill threshold blocks automatic Proceed');
  }

  if (requiredYears && experienceContext.fit < 1) {
    gaps.push(
      `Experience below requirement (${round(experienceContext.relevantYears)} relevant / ${round(experienceContext.generalYears)} general vs ${requiredYears} years required)`
    );
  }

  if (expectedLevel && levelToRank(analysis.level) < levelToRank(expectedLevel)) {
    gaps.push(`Current level (${analysis.level}) is below expected (${expectedLevel})`);
  }

  return uniqueStrings(gaps).slice(0, 5);
}

// РћСЃРЅРѕРІРЅР° С„РѕСЂРјСѓР»Р° РІС–РґРїРѕРІС–РґРЅРѕСЃС‚С–:
// match = criticalCoverage*w1 + coreCoverage*w2 + optionalCoverage*w3 + experienceFit*w4 + levelFit*w5 - penalty
// matchPercentage = round(match * 100)
function computeDeterministicMatch(analysisRaw = {}, job = {}) {
  const analysis = normalizeAnalysisForScoring(analysisRaw);
  const candidateEntries = buildCandidateSkillEntries(analysis);
  const skillBuckets = buildVacancySkillBuckets(job);
  const criticalMatch = computeBucketMatch(skillBuckets.criticalSkills, candidateEntries, 'critical');
  const coreMatch = computeBucketMatch(skillBuckets.coreSkills, candidateEntries, 'core');
  const optionalMatch = computeBucketMatch(skillBuckets.optionalSkills, candidateEntries, 'optional');
  const requiredYears = extractRequiredYears(job);
  const expectedLevel = inferExpectedLevel(job);
  const experienceSignals = buildExperienceSignals(
    analysis,
    analysisRaw,
    buildExperienceTargetContext(job, analysis, skillBuckets)
  );
  const experienceContext = computeExperienceFit(experienceSignals, requiredYears);
  const experienceFit = experienceContext.fit;
  const levelFit = computeLevelFit(analysis.level, expectedLevel);
  const weightedComponents = {
    criticalCoverage: criticalMatch.coverage,
    coreCoverage: coreMatch.coverage,
    optionalCoverage: optionalMatch.coverage,
    experienceFit,
    levelFit,
  };
  const activeWeights = normalizeActiveMatchWeights(weightedComponents);

  let scoreBeforePenalty = 0;
  for (const [key, weight] of Object.entries(activeWeights)) {
    scoreBeforePenalty += weightedComponents[key] * weight;
  }

  const criticalPenalty = Math.min(
    criticalMatch.missing.length * METHOD_CONFIG.matchPenalties.criticalMissingPenaltyPerSkill,
    METHOD_CONFIG.matchPenalties.maxCriticalPenalty
  );
  const scoreAfterPenalty = clamp(scoreBeforePenalty - criticalPenalty, 0, 1);
  const matchPercentage = clamp(Math.round(scoreAfterPenalty * 100), 0, 100);
  let recommendation = recommendationFromScore(matchPercentage);
  if (
    criticalMatch.missing.length >= METHOD_CONFIG.matchPenalties.criticalMissingProceedBlockThreshold &&
    recommendation === 'Proceed'
  ) {
    recommendation = 'Review manually';
  }

  const matchDetails = {
    criticalTotal: skillBuckets.criticalSkills.length,
    coreTotal: skillBuckets.coreSkills.length,
    optionalTotal: skillBuckets.optionalSkills.length,
    matchedCriticalSkills: criticalMatch.matched,
    missingCriticalSkills: criticalMatch.missing,
    matchedCoreSkills: coreMatch.matched,
    missingCoreSkills: coreMatch.missing,
    matchedOptionalSkills: optionalMatch.matched,
  };

  const skillMatchBreakdown = [
    ...criticalMatch.breakdown,
    ...coreMatch.breakdown,
    ...optionalMatch.breakdown,
  ].map((item) => ({
    ...item,
    score: round(item.score),
  }));

  return {
    matchPercentage,
    strengths: buildStrengths(matchDetails, analysis, expectedLevel, requiredYears, {
      ...experienceSignals,
      ...experienceContext,
    }),
    gaps: buildGaps(matchDetails, analysis, expectedLevel, requiredYears, {
      ...experienceSignals,
      ...experienceContext,
    }),
    recommendation,
    matchedCriticalSkills: criticalMatch.matched,
    missingCriticalSkills: criticalMatch.missing,
    matchedCoreSkills: coreMatch.matched,
    missingCoreSkills: coreMatch.missing,
    matchedOptionalSkills: optionalMatch.matched,
    optionalCoverage: round(optionalMatch.coverage || 0),
    skillMatchBreakdown,
    scoringMeta: {
      method: `${METHOD_CONFIG.version}-match`,
      breakdown: {
        criticalCoverage: round(criticalMatch.coverage || 0),
        coreCoverage: round(coreMatch.coverage || 0),
        optionalCoverage: round(optionalMatch.coverage || 0),
        experienceFit: round(experienceFit),
        generalYears: round(experienceSignals.generalYears),
        relevantYears: round(experienceSignals.relevantYears),
        effectiveYears: round(experienceContext.effectiveYears),
        experienceFitReason: experienceContext.reason,
        experienceEvidence: experienceSignals.experienceEvidence,
        levelFit: round(levelFit),
        scoreBeforePenalty: round(scoreBeforePenalty),
        criticalPenalty: round(criticalPenalty),
        scoreAfterPenalty: round(scoreAfterPenalty),
      },
      weights: activeWeights,
      configuredWeights: METHOD_CONFIG.matchWeights,
      penalties: METHOD_CONFIG.matchPenalties,
      matchTiers: METHOD_CONFIG.matchSkillTiers,
      thresholds: METHOD_CONFIG.recommendationThresholds,
      expectedLevel: expectedLevel || null,
      requiredYears: Number.isFinite(requiredYears) ? requiredYears : null,
      skillBuckets: {
        criticalSkills: skillBuckets.criticalSkills,
        coreSkills: skillBuckets.coreSkills,
        optionalSkills: skillBuckets.optionalSkills,
      },
      matchedCounts: {
        critical: criticalMatch.matched.length,
        core: coreMatch.matched.length,
        optional: optionalMatch.matched.length,
      },
      missingCriticalCount: criticalMatch.missing.length,
    },
  };
}

// Р”Р°С” Р·РјРѕРіСѓ API РїРѕРІРµСЂРЅСѓС‚Рё Р°РєС‚РёРІРЅРёР№ РєРѕРЅС„С–Рі РјРµС‚РѕРґСѓ Р±РµР· С‡РёС‚Р°РЅРЅСЏ С„Р°Р№Р»Сѓ РЅР°РїСЂСЏРјСѓ.
function getMethodConfig() {
  return METHOD_CONFIG;
}

module.exports = {
  RECOMMENDATION_VALUES,
  applyDeterministicProfileScoring,
  computeDeterministicMatch,
  getMethodConfig,
};

