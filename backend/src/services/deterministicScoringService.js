const fs = require('fs');
const path = require('path');

// Р”РµС‚РµСЂРјС–РЅРѕРІР°РЅРёР№ СЃРµСЂРІС–СЃ СЃРєРѕСЂРёРЅРіСѓ:
// 1) С‡РёС‚Р°С” РєРѕРЅС„С–Рі РјРµС‚РѕРґСѓ Р· JSON,
// 2) СЂР°С…СѓС” overallScore РєР°РЅРґРёРґР°С‚Р°,
// 3) СЂР°С…СѓС” matchPercentage РґР»СЏ РїР°СЂРё "РєР°РЅРґРёРґР°С‚-РІР°РєР°РЅСЃС–СЏ".
const RECOMMENDATION_VALUES = ['Proceed', 'Review manually', 'Reject'];
const LEVEL_VALUES = ['Junior', 'Middle', 'Senior'];
const DEFAULT_CRITICAL_REQUIREMENT_MARKERS = ['must have', 'must-have', 'required', 'mandatory', 'essential'];
const DEFAULT_OPTIONAL_REQUIREMENT_MARKERS = ['nice to have', 'nice-to-have', 'preferred', 'plus', 'bonus'];
const DEFAULT_SKILL_SYNONYM_GROUPS = [
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
const DEFAULT_RELATED_SKILL_GROUPS = [
  ['javascript', 'typescript', 'node.js', 'react', 'vue', 'angular', 'next.js'],
  ['node.js', 'express', 'nestjs', 'rest api', 'graphql', 'microservices'],
  ['sql', 'postgresql', 'mysql', 'mongodb', 'redis'],
  ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ci/cd'],
  ['qa', 'testing', 'playwright', 'cypress', 'selenium', 'jest'],
  ['python', 'django', 'flask', 'fastapi', 'pandas'],
  ['php', 'laravel', 'symfony'],
];
const DEFAULT_GENERIC_ROLE_TOKENS = [
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
];
const ROLE_FAMILY_VALUES = ['backend', 'frontend', 'qa', 'devops', 'data', 'mobile', 'fullstack', 'recruiting', 'generic', 'unknown'];

const DEFAULT_METHOD_CONFIG = {
  version: 'deterministic-v3',
  levelInference: {
    middleMinYears: 3,
    seniorMinYears: 5,
  },
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
    relatedTokenOverlap: 0.35,
    none: 0,
  },
  skillMatching: {
    synonymGroups: DEFAULT_SKILL_SYNONYM_GROUPS,
    relatedGroups: DEFAULT_RELATED_SKILL_GROUPS,
    criticalMarkers: DEFAULT_CRITICAL_REQUIREMENT_MARKERS,
    optionalMarkers: DEFAULT_OPTIONAL_REQUIREMENT_MARKERS,
    genericRoleTokens: DEFAULT_GENERIC_ROLE_TOKENS,
    tokenOverlapRelatedThreshold: 0.5,
  },
  bucketBuilding: {
    explicitPrecedenceMode: 'primary',
    useHeuristicsWhenExplicitPartial: true,
    stackDefaultBucket: 'core',
    deduplicateAcrossBuckets: true,
  },
  roleContextMatching: {
    enabled: true,
    families: {
      backend: {
        markers: ['backend', 'api', 'microservices', 'server-side', 'node.js', 'nestjs', 'express'],
        prioritySkills: ['node.js', 'typescript', 'postgresql', 'rest api', 'docker', 'aws'],
      },
      frontend: {
        markers: ['frontend', 'ui', 'client-side', 'react', 'vue', 'angular', 'next.js'],
        prioritySkills: ['react', 'next.js', 'javascript', 'typescript', 'css', 'html'],
      },
      qa: {
        markers: ['qa', 'quality assurance', 'testing', 'automation', 'test engineer'],
        prioritySkills: ['playwright', 'cypress', 'selenium', 'qa', 'testing', 'jest'],
      },
      recruiting: {
        markers: ['recruiter', 'recruitment', 'talent acquisition', 'sourcing', 'candidate search', 'interview scheduling', 'hiring'],
        prioritySkills: ['candidate search', 'sourcing', 'interview scheduling', 'linkedin', 'ats', 'google sheets', 'communication'],
      },
      devops: {
        markers: ['devops', 'sre', 'platform', 'infrastructure', 'cloud', 'kubernetes', 'terraform'],
        prioritySkills: ['docker', 'kubernetes', 'terraform', 'aws', 'gcp', 'ci/cd'],
      },
      data: {
        markers: ['data', 'etl', 'warehouse', 'analytics', 'ml', 'machine learning'],
        prioritySkills: ['python', 'sql', 'spark', 'airflow', 'pandas', 'dbt'],
      },
      mobile: {
        markers: ['mobile', 'android', 'ios', 'react native', 'flutter'],
        prioritySkills: ['react native', 'flutter', 'swift', 'kotlin', 'ios', 'android'],
      },
      fullstack: {
        markers: ['fullstack', 'full-stack', 'frontend', 'backend'],
        prioritySkills: ['javascript', 'typescript', 'react', 'node.js', 'next.js'],
      },
      generic: {
        markers: ['developer', 'engineer', 'specialist', 'software'],
        prioritySkills: [],
      },
    },
    adjacency: {
      'backend:fullstack': 0.82,
      'frontend:fullstack': 0.82,
      'backend:devops': 0.68,
      'backend:data': 0.45,
      'frontend:mobile': 0.55,
      'qa:backend': 0.35,
      'qa:frontend': 0.35,
    },
    weights: {
      job: {
        title: 0.35,
        requirements: 0.2,
        stack: 0.2,
        explicitBuckets: 0.25,
      },
      candidate: {
        position: 0.24,
        summary: 0.1,
        skills: 0.18,
        technologies: 0.14,
        historyTitles: 0.16,
        historyDescriptions: 0.1,
        projects: 0.08,
      },
    },
    scoring: {
      sameFamilyScore: 1,
      genericFamilyScore: 0.54,
      unknownFamilyScore: 0.5,
      adjacentFamilyFloor: 0.62,
      crossFamilyScore: 0.24,
      matchBonusMax: 0.08,
      mismatchPenaltyMax: 0.1,
      nearNeutralMax: 0.015,
    },
    thresholds: {
      strongAlignmentMin: 0.75,
      weakAlignmentMax: 0.4,
      minimumFamilyConfidence: 0.25,
    },
  },
  neuralMatching: {
    enabled: true,
    provider: {
      provider: 'google',
      model: 'gemini-embedding-001',
      allowFallbackToRuleBased: true,
    },
    semanticTextBuilding: {
      maxOverallChars: 3600,
      maxItemChars: 180,
      maxSkillsItems: 16,
      maxTechnologiesItems: 12,
      maxHistoryTitleItems: 6,
      maxHistoryDetailItems: 6,
      maxProjectItems: 4,
      maxRequirementItems: 12,
      maxStackItems: 10,
      maxLanguageItems: 5,
    },
    neuralWeights: {
      overall: 0.5,
      skills: 0.3,
      experience: 0.2,
    },
    ruleAdjustments: {
      criticalPenaltyPerMissing: 12,
      maxCriticalPenalty: 18,
      lowConfidencePenaltyThreshold: 0.58,
      maxConfidencePenalty: 18,
      levelMismatchPenaltyPerLevel: 26,
      lowCriticalCoveragePenaltyMax: 12,
      sparseVacancyPenaltyMax: 14,
      roleContextPositiveMax: 6,
      roleContextNegativeMax: 8,
      crossDomainMismatchPenalty: 14,
      unknownDomainMismatchPenalty: 10,
      weakCoreCoverageThreshold: 0.35,
      weakOverlapPenalty: 12,
      veryLowRuleBasedThreshold: 15,
      severeSemanticMismatchThreshold: 0.3,
      severeSemanticMismatchPenalty: 10,
    },
    finalScore: {
      recommendationThresholds: {
        proceedMin: 70,
        reviewMin: 40,
      },
    },
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
      dateRecencyHalfLife: 2.5,
      indexFallbackDecay: 0.72,
      titleOverlapWeight: 0.45,
      skillOverlapWeight: 0.35,
      currentRoleBonus: 0.2,
      requireDateForStrongRecencyBonus: true,
      maxRoleDateGapPenalty: 0.3,
    },
    matchExperience: {
      relevantYearsWeight: 0.75,
      generalYearsFallbackWeight: 0.25,
      noRequirementDefaultYears: 2,
    },
  },
  confidenceScoring: {
    profile: {
      skillsPresence: 0.12,
      technologiesPresence: 0.12,
      educationPresence: 0.07,
      languagesPresence: 0.06,
      workHistoryPresence: 0.18,
      summaryPresence: 0.08,
      explicitYears: 0.1,
      hardSkillEvidence: 0.17,
      relevantYearsExplicit: 0.1,
    },
    match: {
      titlePresence: 0.11,
      requirementsPresence: 0.16,
      stackPresence: 0.1,
      explicitBuckets: 0.13,
      requiredYearsClarity: 0.1,
      expectedLevelClarity: 0.08,
      bucketQuality: 0.16,
      candidateEvidence: 0.08,
      heuristicAssumptions: 0.08,
    },
  },
  confidenceThresholds: {
    lowProfile: 0.45,
    lowMatch: 0.5,
    proceedDowngradeThreshold: 0.58,
  },
  flagThresholds: {
    minCandidateSkills: 3,
    minCandidateTechnologies: 2,
    minLanguages: 1,
    minRequirementItems: 2,
    minStackItems: 1,
    minSkillBucketsTotal: 2,
    weakRequirementsTextMinChars: 40,
    weakSkillEvidenceMinSourceCount: 1.6,
    weakSkillEvidenceMinEvidenceBonus: 0.35,
    sparseProfileScoreThreshold: 0.45,
    sparseMatchScoreThreshold: 0.5,
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

function safeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
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

function escapeRegExp(value) {
  return toText(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((x) => toText(x)).filter(Boolean))];
}

function uniqueSkills(values = []) {
  return [...new Set(values.map((x) => normalizeSkill(x)).filter(Boolean))];
}

function normalizeStringArray(values, fallback = []) {
  const normalized = uniqueStrings(Array.isArray(values) ? values : []);
  return normalized.length ? normalized : uniqueStrings(fallback);
}

function normalizeSkillGroups(values, fallback = []) {
  const groups = Array.isArray(values) ? values : [];
  const normalized = groups
    .map((group) => uniqueStrings(Array.isArray(group) ? group : []))
    .filter((group) => group.length >= 2);

  if (normalized.length) return normalized;
  return fallback.map((group) => uniqueStrings(group)).filter((group) => group.length >= 2);
}

function normalizeFamilyDefinition(rawFamily, fallbackFamily = {}) {
  const source = safeObject(rawFamily);
  const fallback = safeObject(fallbackFamily);
  return {
    markers: normalizeStringArray(source.markers, fallback.markers).map((item) => normalizeSkill(item)),
    prioritySkills: normalizeStringArray(source.prioritySkills, fallback.prioritySkills).map((item) =>
      normalizeSkill(item)
    ),
  };
}

function normalizeFamilyMap(rawFamilies, fallbackFamilies = {}) {
  const normalized = {};
  ROLE_FAMILY_VALUES.filter((family) => family !== 'unknown').forEach((family) => {
    normalized[family] = normalizeFamilyDefinition(rawFamilies?.[family], fallbackFamilies?.[family]);
  });
  return normalized;
}

function normalizeAdjacencyMap(rawAdjacency, fallbackAdjacency = {}) {
  const source = safeObject(rawAdjacency);
  const fallback = safeObject(fallbackAdjacency);
  const normalized = {};
  Object.entries({ ...fallback, ...source }).forEach(([key, value]) => {
    const normalizedKey = toText(key).toLowerCase();
    if (!normalizedKey.includes(':')) return;
    normalized[normalizedKey] = clamp(safeNumber(value, fallback[normalizedKey] ?? 0), 0, 1);
  });
  return normalized;
}

function textIncludesSkill(text, skill) {
  const haystack = toLower(text);
  const needle = normalizeSkill(skill);
  if (!haystack || !needle) return false;
  const escaped = needle
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^a-z0-9+#]+');
  if (!escaped) return false;
  const pattern = new RegExp(`(^|[^a-z0-9+#])${escaped}($|[^a-z0-9+#])`, 'i');
  return pattern.test(haystack);
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

function textToRoleTokens(value) {
  return uniqueStrings(
    tokenizeSkill(value).filter((token) => token && !ACTIVE_GENERIC_ROLE_TOKENS.has(token))
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

function isPresentText(value = '') {
  const text = toLower(value);
  if (!text) return false;
  return (
    text.includes('present') ||
    text.includes('current') ||
    text.includes('now') ||
    text.includes('ongoing') ||
    text.includes('today')
  );
}

function parseSingleDateLike(value) {
  const text = toText(value);
  if (!text) return null;

  if (isPresentText(text)) {
    return new Date();
  }

  const normalized = text
    .replace(/[–—]/g, '-')
    .replace(/\bto\b/gi, '-')
    .replace(/\s+/g, ' ')
    .trim();

  const yearMonth = normalized.match(/^(\d{1,2})[./-](\d{4})$/);
  if (yearMonth) {
    const month = clamp(Number(yearMonth[1]), 1, 12);
    const year = Number(yearMonth[2]);
    return new Date(year, month - 1, 1);
  }

  const monthYear = normalized.match(
    /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})$/i
  );
  if (monthYear) {
    const parsed = new Date(`${monthYear[1]} 1, ${monthYear[2]}`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const yearOnly = normalized.match(/^(19|20)\d{2}$/);
  if (yearOnly) {
    return new Date(Number(yearOnly[0]), 0, 1);
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const embeddedYear = normalized.match(/\b(19|20)\d{2}\b/);
  if (embeddedYear) {
    return new Date(Number(embeddedYear[0]), 0, 1);
  }

  return null;
}

function parseDateLike(value) {
  const text = toText(value);
  if (!text) return null;

  const normalized = text.replace(/[–—]/g, '-').trim();
  const looksLikeRange =
    /\bto\b/i.test(normalized) ||
    /\s-\s/.test(normalized) ||
    /^\d{4}\s*-\s*\d{4}$/.test(normalized) ||
    /^\d{1,2}[./-]\d{4}\s*-\s*\d{1,2}[./-]\d{4}$/.test(normalized) ||
    /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\s*-\s*(january|february|march|april|may|june|july|august|september|october|november|december|\bpresent\b|\bcurrent\b|\bnow\b)/i.test(normalized);

  if (looksLikeRange) {
    const range = parseDateRange(normalized);
    return range.endDate || range.startDate;
  }

  return parseSingleDateLike(text);
}

function parseDateRange(value) {
  const text = toText(value);
  if (!text) return { startDate: null, endDate: null, isRange: false };

  const normalized = text.replace(/[–—]/g, '-').replace(/\bto\b/gi, ' - ');
  const parts = normalized
    .split(/\s+-\s+/)
    .map((part) => toText(part))
    .filter(Boolean);

  if (parts.length < 2 && /^\d{4}\s*-\s*\d{4}$/.test(normalized)) {
    const compactParts = normalized.split(/\s*-\s*/).map((part) => toText(part)).filter(Boolean);
    if (compactParts.length >= 2) {
      return {
        startDate: parseSingleDateLike(compactParts[0]),
        endDate: parseSingleDateLike(compactParts.slice(1).join(' - ')),
        isRange: true,
      };
    }
  }

  if (parts.length < 2 && /^\d{1,2}[./-]\d{4}\s*-\s*\d{1,2}[./-]\d{4}$/.test(normalized)) {
    const compactParts = normalized.split(/\s*-\s*/).map((part) => toText(part)).filter(Boolean);
    if (compactParts.length >= 2) {
      return {
        startDate: parseSingleDateLike(compactParts[0]),
        endDate: parseSingleDateLike(compactParts.slice(1).join(' - ')),
        isRange: true,
      };
    }
  }

  if (parts.length < 2) {
    return {
      startDate: null,
      endDate: null,
      isRange: false,
    };
  }

  const startDate = parseSingleDateLike(parts[0]);
  const endDate = parseSingleDateLike(parts.slice(1).join(' - '));
  return {
    startDate,
    endDate,
    isRange: Boolean(startDate || endDate),
  };
}

function toIsoDateString(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return value.toISOString();
}

function getRoleSortDate(roleEntry = {}) {
  if (roleEntry.endDateParsed) return roleEntry.endDateParsed;
  if (roleEntry.hasDateEvidence && roleEntry.isCurrent) return new Date();
  if (roleEntry.startDateParsed) return roleEntry.startDateParsed;
  return null;
}

function buildRecencyFromDates(roleEntry, heuristic) {
  const sortDate = getRoleSortDate(roleEntry);
  if (!(sortDate instanceof Date) || Number.isNaN(sortDate.getTime())) {
    return null;
  }

  const yearsSinceSortDate = Math.max(0, yearsBetweenDates(sortDate, new Date()) || 0);
  let recencyWeight = Math.pow(0.5, yearsSinceSortDate / Math.max(heuristic.dateRecencyHalfLife, 0.0001));
  const hasStrongDateSupport =
    roleEntry.startDateParsed instanceof Date &&
    !Number.isNaN(roleEntry.startDateParsed.getTime()) &&
    (roleEntry.endDateParsed instanceof Date ||
      roleEntry.isCurrent ||
      !heuristic.requireDateForStrongRecencyBonus);
  const chronologyConfidence = hasStrongDateSupport ? 1 : 1 - heuristic.maxRoleDateGapPenalty;
  recencyWeight *= chronologyConfidence;

  return {
    recencyWeight: clamp(recencyWeight, 0, 1),
    recencySource: 'date-based',
    chronologyConfidence: clamp(chronologyConfidence, 0, 1),
    usedIndexFallback: false,
  };
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
  return !endText || isPresentText(endText);
}

function hasExplicitCurrentMarker(record = {}) {
  const explicit = record.current ?? record.isCurrent ?? record.present ?? record.active;
  if (typeof explicit === 'boolean') return explicit;

  return [
    record.endDate,
    record.to,
    record.periodEnd,
    record.period,
    record.dateRange,
    record.date,
  ]
    .map((item) => toText(item))
    .filter(Boolean)
    .some((item) => isPresentText(item));
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
  const dateRangeText = [
    record.period,
    record.dateRange,
    record.date,
  ]
    .map((item) => toText(item))
    .find(Boolean);
  const parsedRange = parseDateRange(dateRangeText);
  const effectiveStartDate = startDate || parsedRange.startDate;
  const effectiveEndDate = endDate || parsedRange.endDate;
  const parsedFromDates = yearsBetweenDates(
    effectiveStartDate,
    inferIsCurrentRole(record) ? new Date() : effectiveEndDate
  );
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
      const rangeText = [
        record.period,
        record.dateRange,
        record.date,
      ]
        .map((item) => toText(item))
        .find(Boolean);
      const parsedRange = parseDateRange(rangeText);
      const startDateParsed = parseDateLike(record.startDate || record.from || record.periodStart) || parsedRange.startDate;
      const endDateParsed = parseDateLike(record.endDate || record.to || record.periodEnd) || parsedRange.endDate;
      const isCurrent = inferIsCurrentRole(record);
      const explicitCurrentMarker = hasExplicitCurrentMarker(record);
      const hasDateEvidence = Boolean(
        (startDateParsed instanceof Date && !Number.isNaN(startDateParsed.getTime())) ||
          (endDateParsed instanceof Date && !Number.isNaN(endDateParsed.getTime())) ||
          explicitCurrentMarker
      );
      if (!title && !description) return null;
      return {
        title: title || fallbackPosition,
        description,
        years: inferRoleYears(record),
        isCurrent,
        startDateParsed,
        endDateParsed,
        hasDateEvidence,
        hasReliableDates: Boolean(
          startDateParsed instanceof Date &&
            !Number.isNaN(startDateParsed.getTime()) &&
            ((endDateParsed instanceof Date && !Number.isNaN(endDateParsed.getTime())) || isCurrent)
        ),
        explicitCurrentMarker,
        originalIndex: index,
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
      startDateParsed: null,
      endDateParsed: null,
      hasDateEvidence: false,
      hasReliableDates: false,
      explicitCurrentMarker: false,
      originalIndex: 0,
      index: 0,
    });
  }

  const datedEntries = roleEntries.filter((entry) => getRoleSortDate(entry));
  const useChronologyAwareSorting = datedEntries.length >= 2;
  const sortedEntries = useChronologyAwareSorting
    ? [...roleEntries].sort((left, right) => {
        const leftSort = getRoleSortDate(left);
        const rightSort = getRoleSortDate(right);
        const leftTime = leftSort instanceof Date && !Number.isNaN(leftSort.getTime()) ? leftSort.getTime() : -Infinity;
        const rightTime = rightSort instanceof Date && !Number.isNaN(rightSort.getTime()) ? rightSort.getTime() : -Infinity;
        if (rightTime !== leftTime) return rightTime - leftTime;
        return left.originalIndex - right.originalIndex;
      })
    : roleEntries;

  return sortedEntries.map((entry, index) => ({
    ...entry,
    years: entry.years > 0 ? entry.years : index === 0 ? generalYears : 0,
    usedIndexFallback: !useChronologyAwareSorting || !entry.hasReliableDates,
    chronologyConfidence: entry.hasReliableDates ? 1 : 0,
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
      relevantYearsSource: 'explicit',
      hasReliableRoleDates: true,
      roleDateCoverage: 1,
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
          startDateParsed: null,
          endDateParsed: null,
          usedIndexFallback: false,
          recencySource: 'explicit',
          chronologyConfidence: 1,
        },
      ],
    };
  }

  const heuristic = METHOD_CONFIG.experienceScoring.relevantExperienceHeuristic;
  const resolvedTargetContext = targetContext || buildExperienceTargetContext(null, normalizedAnalysis);
  const roleEntries = extractRoleEntries(rawAnalysis, generalYears);
  const datedRoleCount = roleEntries.filter((entry) => entry.hasDateEvidence).length;
  const reliableRoleCount = roleEntries.filter((entry) => entry.hasReliableDates).length;
  const hasReliableRoleDates = reliableRoleCount > 0;
  const roleDateCoverage = roleEntries.length ? datedRoleCount / roleEntries.length : 0;
  const heuristicSource = datedRoleCount > 0 ? 'heuristic-date-based' : 'heuristic-index-based';
  const evidence = roleEntries.map((roleEntry, index) => {
    const dateRecency = getRoleSortDate(roleEntry) ? buildRecencyFromDates(roleEntry, heuristic) : null;
    const recencyMeta = dateRecency || {
      recencyWeight: Math.pow(heuristic.indexFallbackDecay, index),
      recencySource: 'index-based',
      chronologyConfidence: 0,
      usedIndexFallback: true,
    };
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

    const weightedYears = roleEntry.years * relevanceScore * recencyMeta.recencyWeight;
    return {
      title: roleEntry.title || 'Unspecified role',
      years: round(roleEntry.years),
      relevanceScore: round(relevanceScore),
      recencyWeight: round(recencyMeta.recencyWeight),
      weightedYears: round(weightedYears),
      matchedTargetSkills: matchedTargetSkills.slice(0, 5),
      titleOverlap: round(titleOverlap),
      skillOverlap: round(skillOverlap),
      isCurrent: roleEntry.isCurrent,
      startDateParsed: toIsoDateString(roleEntry.startDateParsed),
      endDateParsed: toIsoDateString(roleEntry.endDateParsed),
      usedIndexFallback: recencyMeta.usedIndexFallback,
      recencySource: recencyMeta.recencySource,
      chronologyConfidence: round(recencyMeta.chronologyConfidence),
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
    source: heuristicSource,
    relevantYearsSource: heuristicSource,
    hasReliableRoleDates,
    roleDateCoverage: round(roleDateCoverage),
    experienceEvidence: evidence.slice(0, 6),
  };
}

function average(values = []) {
  const numeric = values.filter((value) => Number.isFinite(value));
  if (!numeric.length) return 0;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function hasExplicitYearsInput(rawAnalysis = {}) {
  const candidate = rawAnalysis.generalYearsExperience ?? rawAnalysis.yearsOfExperience;
  return candidate !== null && candidate !== undefined && candidate !== '';
}

function buildConfidenceResult(score, flags = [], reasons = []) {
  return {
    score: round(clamp(score, 0, 1)),
    flags: uniqueStrings(flags),
    reasons: uniqueStrings(reasons).slice(0, 6),
  };
}

function computeProfileConfidence(normalizedAnalysis, rawAnalysis, breakdown) {
  const thresholds = METHOD_CONFIG.flagThresholds;
  const weights = METHOD_CONFIG.confidenceScoring.profile;
  const lowProfileThreshold = Math.max(
    thresholds.sparseProfileScoreThreshold,
    METHOD_CONFIG.confidenceThresholds.lowProfile
  );
  const hardSkillMeta = breakdown?.skillDetails?.hardSkills || {};
  const experience = breakdown?.experience || {};
  const roleEntries = extractRoleEntries(rawAnalysis, experience.generalYears || 0);
  const hasStructuredHistory = roleEntries.some(
    (entry) => entry.title || toText(entry.description)
  );
  const avgHardSkillSourceCount = average(
    Array.isArray(hardSkillMeta.rankedSkills)
      ? hardSkillMeta.rankedSkills.map((item) => Number(item?.sourceCount) || 0)
      : []
  );
  const avgHardSkillEvidenceBonus = average(
    Array.isArray(hardSkillMeta.rankedSkills)
      ? hardSkillMeta.rankedSkills.map((item) => Number(item?.evidenceBonus) || 0)
      : []
  );
  const relevantYearsExplicit = experience.source === 'explicit' ? 1 : 0.35;
  const componentScores = {
    skillsPresence: normalizedAnalysis.skills.length >= thresholds.minCandidateSkills
      ? 1
      : normalizedAnalysis.skills.length > 0
        ? round(normalizedAnalysis.skills.length / thresholds.minCandidateSkills)
        : 0,
    technologiesPresence: normalizedAnalysis.technologies.length >= thresholds.minCandidateTechnologies
      ? 1
      : normalizedAnalysis.technologies.length > 0
        ? round(normalizedAnalysis.technologies.length / thresholds.minCandidateTechnologies)
        : 0,
    educationPresence: normalizedAnalysis.education ? 1 : 0,
    languagesPresence: normalizedAnalysis.languages.length >= thresholds.minLanguages
      ? 1
      : thresholds.minLanguages === 0
        ? 1
        : normalizedAnalysis.languages.length > 0
          ? round(normalizedAnalysis.languages.length / thresholds.minLanguages)
          : 0,
    workHistoryPresence: hasStructuredHistory ? 1 : 0,
    summaryPresence: normalizedAnalysis.summary ? 1 : 0,
    explicitYears: hasExplicitYearsInput(rawAnalysis) ? 1 : 0,
    hardSkillEvidence: clamp(
      average([
        avgHardSkillSourceCount / Math.max(thresholds.weakSkillEvidenceMinSourceCount, 0.0001),
        avgHardSkillEvidenceBonus / Math.max(thresholds.weakSkillEvidenceMinEvidenceBonus, 0.0001),
      ]),
      0,
      1
    ),
    relevantYearsExplicit,
  };

  const score = Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + (componentScores[key] || 0) * weight,
    0
  );

  const flags = [];
  const reasons = [];

  if (score <= lowProfileThreshold) {
    flags.push('sparseCandidateData');
    reasons.push('У профілі кандидата замало структурованих даних для впевненої оцінки.');
  }
  if (!hasStructuredHistory) {
    flags.push('missingWorkHistory');
    reasons.push('Досвід роботи, блоки з проєктами або опис кар’єрного шляху відсутні чи занадто стислі.');
  }
  if (
    avgHardSkillSourceCount < thresholds.weakSkillEvidenceMinSourceCount ||
    avgHardSkillEvidenceBonus < thresholds.weakSkillEvidenceMinEvidenceBonus
  ) {
    flags.push('weakSkillEvidence');
    reasons.push('Професійні навички слабо підтверджені технологіями, описом профілю, посадою або текстом про досвід.');
  }
  if (experience.source !== 'explicit') {
    flags.push('heuristicRelevantYears');
    reasons.push('Релевантний досвід оцінено евристично, а не взято з явно вказаних років.');
  }

  return buildConfidenceResult(score, flags, reasons);
}

function extractRequiredYearsMeta(job = {}) {
  const sources = [
    { source: 'title', text: toText(job.title) },
    { source: 'description', text: toText(job.description) },
    { source: 'requirements', text: (Array.isArray(job.requirements) ? job.requirements : []).join(' ') },
  ];
  const matches = sources
    .map((item) => {
      const match = item.text.match(/(\d{1,2})\+?\s*(years|year|yrs|yr)/i);
      if (!match) return null;
      return {
        source: item.source,
        years: safeYears(match[1]),
      };
    })
    .filter(Boolean);

  if (!matches.length) {
    return {
      requiredYears: null,
      confidence: 0,
      source: 'none',
      ambiguous: true,
    };
  }

  const distinctYears = uniqueStrings(matches.map((item) => String(item.years)));
  const preferred = matches.find((item) => item.source === 'requirements') || matches[0];
  const sourceConfidence =
    preferred.source === 'requirements' ? 1 : preferred.source === 'title' ? 0.85 : 0.7;

  return {
    requiredYears: preferred.years,
    confidence: distinctYears.length > 1 ? Math.max(0.45, sourceConfidence - 0.25) : sourceConfidence,
    source: preferred.source,
    ambiguous: distinctYears.length > 1,
  };
}

function inferExpectedLevelMeta(job = {}) {
  const levelChecks = [
    { source: 'title', text: toLower(job.title) },
    { source: 'description', text: toLower(job.description) },
    { source: 'requirements', text: toLower((Array.isArray(job.requirements) ? job.requirements : []).join(' ')) },
  ];

  const inferFromText = (text) => {
    if (text.includes('senior') || text.includes('lead') || text.includes('architect')) return 'Senior';
    if (text.includes('middle') || text.includes('mid-level') || text.includes('mid level')) return 'Middle';
    if (text.includes('junior') || text.includes('trainee') || text.includes('intern')) return 'Junior';
    return null;
  };

  const matches = levelChecks
    .map((item) => {
      const level = inferFromText(item.text);
      return level ? { source: item.source, level } : null;
    })
    .filter(Boolean);

  if (!matches.length) {
    return {
      expectedLevel: null,
      confidence: 0,
      source: 'none',
      ambiguous: true,
    };
  }

  const distinctLevels = uniqueStrings(matches.map((item) => item.level));
  const preferred = matches.find((item) => item.source === 'title') || matches[0];
  const sourceConfidence =
    preferred.source === 'title' ? 1 : preferred.source === 'requirements' ? 0.8 : 0.7;

  return {
    expectedLevel: preferred.level,
    confidence: distinctLevels.length > 1 ? Math.max(0.45, sourceConfidence - 0.25) : sourceConfidence,
    source: preferred.source,
    ambiguous: distinctLevels.length > 1,
  };
}

function computeMatchConfidence(job, analysis, skillBuckets, experienceSignals, profileConfidence, meta = {}) {
  const thresholds = METHOD_CONFIG.flagThresholds;
  const weights = METHOD_CONFIG.confidenceScoring.match;
  const lowMatchThreshold = Math.max(
    thresholds.sparseMatchScoreThreshold,
    METHOD_CONFIG.confidenceThresholds.lowMatch
  );
  const requirements = Array.isArray(job.requirements) ? job.requirements : [];
  const stack = Array.isArray(job.stack) ? job.stack : [];
  const explicitBucketCount = [
    Array.isArray(job.criticalSkills) && job.criticalSkills.length > 0,
    Array.isArray(job.coreSkills) && job.coreSkills.length > 0,
    Array.isArray(job.optionalSkills) && job.optionalSkills.length > 0,
  ].filter(Boolean).length;
  const totalBucketCount =
    skillBuckets.criticalSkills.length + skillBuckets.coreSkills.length + skillBuckets.optionalSkills.length;
  const bucketQuality = clamp(
    average([
      totalBucketCount / Math.max(thresholds.minSkillBucketsTotal, 1),
      [
        skillBuckets.criticalSkills.length > 0,
        skillBuckets.coreSkills.length > 0,
        skillBuckets.optionalSkills.length > 0,
      ].filter(Boolean).length / 3,
    ]),
    0,
    1
  );
  const heuristicAssumptionsScore = clamp(
    1 -
      average([
        explicitBucketCount > 0 ? 0 : 1,
        experienceSignals.source === 'explicit' ? 0 : 1,
        meta.requiredYearsMeta?.source === 'none' || meta.requiredYearsMeta?.ambiguous ? 1 : 0,
        meta.expectedLevelMeta?.source === 'none' || meta.expectedLevelMeta?.ambiguous ? 1 : 0,
      ]),
    0,
    1
  );

  const componentScores = {
    titlePresence: job.title ? 1 : 0,
    requirementsPresence: requirements.length >= thresholds.minRequirementItems
      ? 1
      : requirements.length > 0
        ? round(requirements.length / thresholds.minRequirementItems)
        : 0,
    stackPresence: stack.length >= thresholds.minStackItems
      ? 1
      : thresholds.minStackItems === 0
        ? 1
        : stack.length > 0
          ? round(stack.length / thresholds.minStackItems)
          : 0,
    explicitBuckets: explicitBucketCount / 3,
    requiredYearsClarity: meta.requiredYearsMeta?.confidence || 0,
    expectedLevelClarity: meta.expectedLevelMeta?.confidence || 0,
    bucketQuality,
    candidateEvidence: profileConfidence.score,
    heuristicAssumptions: heuristicAssumptionsScore,
  };

  const score = Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + (componentScores[key] || 0) * weight,
    0
  );

  const flags = [...(profileConfidence.flags || [])];
  const reasons = [];

  if (score <= lowMatchThreshold) {
    flags.push('sparseVacancyData');
    reasons.push('У вакансії замало даних для впевненого результату оцінювання.');
  }
  if (!requirements.length || requirements.join(' ').trim().length < thresholds.weakRequirementsTextMinChars) {
    flags.push('weakRequirementsText');
    reasons.push('Опис вимог відсутній або занадто короткий для точного зіставлення.');
  }
  if (!totalBucketCount) {
    flags.push('emptySkillBuckets');
    reasons.push('Із вакансії не вдалося побудувати достатньо корисні групи навичок.');
  }
  if (meta.requiredYearsMeta?.source === 'none' || meta.requiredYearsMeta?.ambiguous) {
    flags.push('ambiguousRequiredYears');
    reasons.push('У вакансії нечітко вказано потрібну кількість років досвіду.');
  }
  if (meta.expectedLevelMeta?.source === 'none' || meta.expectedLevelMeta?.ambiguous) {
    flags.push('ambiguousExpectedLevel');
    reasons.push('Очікуваний рівень кандидата не вдалося впевнено визначити з тексту вакансії.');
  }
  if (experienceSignals.source !== 'explicit') {
    flags.push('heuristicRelevantYears');
    reasons.push('Релевантний досвід у профілі кандидата оцінено евристично, тому впевненість у збігу нижча.');
  }
  if (profileConfidence.flags?.includes('weakSkillEvidence')) {
    flags.push('weakSkillEvidence');
    reasons.push('Підтвердження навичок у кандидата слабке, тому рівні збігу за навичками менш надійні.');
  }

  return buildConfidenceResult(score, flags, reasons);
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
  const rawLevelInference = safeObject(raw.levelInference);
  const rawMatchPenalties = safeObject(raw.matchPenalties);
  const rawMatchSkillTiers = safeObject(raw.matchSkillTiers);
  const rawSkillMatching = safeObject(raw.skillMatching);
  const rawBucketBuilding = safeObject(raw.bucketBuilding);
  const rawRoleContextMatching = safeObject(raw.roleContextMatching);
  const rawNeuralMatching = safeObject(raw.neuralMatching);
  const rawThresholds = safeObject(raw.recommendationThresholds);
  const rawLanguageScores = safeObject(raw.languageScoresByCount);
  const rawEducationScores = safeObject(raw.educationScores);
  const rawHardSkillsScoring = safeObject(raw.hardSkillsScoring);
  const rawSoftSkillsScoring = safeObject(raw.softSkillsScoring);
  const rawExperienceScoring = safeObject(raw.experienceScoring);
  const rawConfidenceScoring = safeObject(raw.confidenceScoring);
  const rawProfileConfidence = safeObject(rawConfidenceScoring.profile);
  const rawMatchConfidence = safeObject(rawConfidenceScoring.match);
  const rawConfidenceThresholds = safeObject(raw.confidenceThresholds);
  const rawFlagThresholds = safeObject(raw.flagThresholds);
  const rawProfileYearsBlend = safeObject(rawExperienceScoring.profileYearsBlend);
  const rawRelevantExperienceHeuristic = safeObject(rawExperienceScoring.relevantExperienceHeuristic);
  const rawMatchExperience = safeObject(rawExperienceScoring.matchExperience);
  const rawHardSkillSourceBonuses = safeObject(rawHardSkillsScoring.sourceBonuses);
  const rawHardSkillPriorityBonuses = safeObject(rawHardSkillsScoring.priorityBonuses);
  const rawRoleContextFamilies = safeObject(rawRoleContextMatching.families);
  const rawRoleContextAdjacency = safeObject(rawRoleContextMatching.adjacency);
  const rawRoleContextWeights = safeObject(rawRoleContextMatching.weights);
  const rawRoleContextJobWeights = safeObject(rawRoleContextWeights.job);
  const rawRoleContextCandidateWeights = safeObject(rawRoleContextWeights.candidate);
  const rawRoleContextScoring = safeObject(rawRoleContextMatching.scoring);
  const rawRoleContextThresholds = safeObject(rawRoleContextMatching.thresholds);
  const rawNeuralProvider = safeObject(rawNeuralMatching.provider);
  const rawNeuralSemanticTextBuilding = safeObject(rawNeuralMatching.semanticTextBuilding);
  const rawNeuralWeights = safeObject(rawNeuralMatching.neuralWeights);
  const rawNeuralRuleAdjustments = safeObject(rawNeuralMatching.ruleAdjustments);
  const rawNeuralFinalScore = safeObject(rawNeuralMatching.finalScore);
  const rawNeuralRecommendationThresholds = safeObject(rawNeuralFinalScore.recommendationThresholds);
  const skillMatching = {
    synonymGroups: normalizeSkillGroups(
      rawSkillMatching.synonymGroups,
      DEFAULT_METHOD_CONFIG.skillMatching.synonymGroups
    ),
    relatedGroups: normalizeSkillGroups(
      rawSkillMatching.relatedGroups,
      DEFAULT_METHOD_CONFIG.skillMatching.relatedGroups
    ),
    criticalMarkers: normalizeStringArray(
      rawSkillMatching.criticalMarkers,
      DEFAULT_METHOD_CONFIG.skillMatching.criticalMarkers
    ).map((item) => toLower(item)),
    optionalMarkers: normalizeStringArray(
      rawSkillMatching.optionalMarkers,
      DEFAULT_METHOD_CONFIG.skillMatching.optionalMarkers
    ).map((item) => toLower(item)),
    genericRoleTokens: normalizeStringArray(
      rawSkillMatching.genericRoleTokens,
      DEFAULT_METHOD_CONFIG.skillMatching.genericRoleTokens
    ).map((item) => normalizeSkill(item)),
    tokenOverlapRelatedThreshold: clamp(
      safeNumber(
        rawSkillMatching.tokenOverlapRelatedThreshold,
        DEFAULT_METHOD_CONFIG.skillMatching.tokenOverlapRelatedThreshold
      ),
      0,
      1
    ),
  };

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
  const profileConfidenceWeights = normalizeWeights(
    rawProfileConfidence,
    DEFAULT_METHOD_CONFIG.confidenceScoring.profile,
    [
      'skillsPresence',
      'technologiesPresence',
      'educationPresence',
      'languagesPresence',
      'workHistoryPresence',
      'summaryPresence',
      'explicitYears',
      'hardSkillEvidence',
      'relevantYearsExplicit',
    ]
  );
  const matchConfidenceWeights = normalizeWeights(
    rawMatchConfidence,
    DEFAULT_METHOD_CONFIG.confidenceScoring.match,
    [
      'titlePresence',
      'requirementsPresence',
      'stackPresence',
      'explicitBuckets',
      'requiredYearsClarity',
      'expectedLevelClarity',
      'bucketQuality',
      'candidateEvidence',
      'heuristicAssumptions',
    ]
  );
  const roleContextJobWeights = normalizeWeights(
    rawRoleContextJobWeights,
    DEFAULT_METHOD_CONFIG.roleContextMatching.weights.job,
    ['title', 'requirements', 'stack', 'explicitBuckets']
  );
  const roleContextCandidateWeights = normalizeWeights(
    rawRoleContextCandidateWeights,
    DEFAULT_METHOD_CONFIG.roleContextMatching.weights.candidate,
    ['position', 'summary', 'skills', 'technologies', 'historyTitles', 'historyDescriptions', 'projects']
  );
  const roleContextFamilies = normalizeFamilyMap(
    rawRoleContextFamilies,
    DEFAULT_METHOD_CONFIG.roleContextMatching.families
  );
  const roleContextAdjacency = normalizeAdjacencyMap(
    rawRoleContextAdjacency,
    DEFAULT_METHOD_CONFIG.roleContextMatching.adjacency
  );
  const neuralWeights = normalizeWeights(
    rawNeuralWeights,
    DEFAULT_METHOD_CONFIG.neuralMatching.neuralWeights,
    ['overall', 'skills', 'experience']
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
    levelInference: {
      middleMinYears: clamp(
        safeNumber(rawLevelInference.middleMinYears, DEFAULT_METHOD_CONFIG.levelInference.middleMinYears),
        1,
        10
      ),
      seniorMinYears: clamp(
        safeNumber(rawLevelInference.seniorMinYears, DEFAULT_METHOD_CONFIG.levelInference.seniorMinYears),
        2,
        15
      ),
    },
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
      relatedTokenOverlap: clamp(
        safeNumber(
          rawMatchSkillTiers.relatedTokenOverlap,
          DEFAULT_METHOD_CONFIG.matchSkillTiers.relatedTokenOverlap
        ),
        0,
        clamp(safeNumber(rawMatchSkillTiers.related, DEFAULT_METHOD_CONFIG.matchSkillTiers.related), 0, 1)
      ),
      none: clamp(
        safeNumber(rawMatchSkillTiers.none, DEFAULT_METHOD_CONFIG.matchSkillTiers.none),
        0,
        1
      ),
    },
    skillMatching,
    bucketBuilding: {
      explicitPrecedenceMode: ['primary', 'strict', 'merge'].includes(
        toText(rawBucketBuilding.explicitPrecedenceMode).toLowerCase()
      )
        ? toText(rawBucketBuilding.explicitPrecedenceMode).toLowerCase()
        : DEFAULT_METHOD_CONFIG.bucketBuilding.explicitPrecedenceMode,
      useHeuristicsWhenExplicitPartial: safeBoolean(
        rawBucketBuilding.useHeuristicsWhenExplicitPartial,
        DEFAULT_METHOD_CONFIG.bucketBuilding.useHeuristicsWhenExplicitPartial
      ),
      stackDefaultBucket: ['critical', 'core', 'optional'].includes(
        toText(rawBucketBuilding.stackDefaultBucket).toLowerCase()
      )
        ? toText(rawBucketBuilding.stackDefaultBucket).toLowerCase()
        : DEFAULT_METHOD_CONFIG.bucketBuilding.stackDefaultBucket,
      deduplicateAcrossBuckets: safeBoolean(
        rawBucketBuilding.deduplicateAcrossBuckets,
        DEFAULT_METHOD_CONFIG.bucketBuilding.deduplicateAcrossBuckets
      ),
    },
    roleContextMatching: {
      enabled: safeBoolean(rawRoleContextMatching.enabled, DEFAULT_METHOD_CONFIG.roleContextMatching.enabled),
      families: roleContextFamilies,
      adjacency: roleContextAdjacency,
      weights: {
        job: roleContextJobWeights,
        candidate: roleContextCandidateWeights,
      },
      scoring: {
        sameFamilyScore: clamp(
          safeNumber(rawRoleContextScoring.sameFamilyScore, DEFAULT_METHOD_CONFIG.roleContextMatching.scoring.sameFamilyScore),
          0,
          1
        ),
        genericFamilyScore: clamp(
          safeNumber(rawRoleContextScoring.genericFamilyScore, DEFAULT_METHOD_CONFIG.roleContextMatching.scoring.genericFamilyScore),
          0,
          1
        ),
        unknownFamilyScore: clamp(
          safeNumber(rawRoleContextScoring.unknownFamilyScore, DEFAULT_METHOD_CONFIG.roleContextMatching.scoring.unknownFamilyScore),
          0,
          1
        ),
        adjacentFamilyFloor: clamp(
          safeNumber(rawRoleContextScoring.adjacentFamilyFloor, DEFAULT_METHOD_CONFIG.roleContextMatching.scoring.adjacentFamilyFloor),
          0,
          1
        ),
        crossFamilyScore: clamp(
          safeNumber(rawRoleContextScoring.crossFamilyScore, DEFAULT_METHOD_CONFIG.roleContextMatching.scoring.crossFamilyScore),
          0,
          1
        ),
        matchBonusMax: clamp(
          safeNumber(rawRoleContextScoring.matchBonusMax, DEFAULT_METHOD_CONFIG.roleContextMatching.scoring.matchBonusMax),
          0,
          0.08
        ),
        mismatchPenaltyMax: clamp(
          safeNumber(rawRoleContextScoring.mismatchPenaltyMax, DEFAULT_METHOD_CONFIG.roleContextMatching.scoring.mismatchPenaltyMax),
          0,
          0.1
        ),
        nearNeutralMax: clamp(
          safeNumber(rawRoleContextScoring.nearNeutralMax, DEFAULT_METHOD_CONFIG.roleContextMatching.scoring.nearNeutralMax),
          0,
          0.03
        ),
      },
      thresholds: {
        strongAlignmentMin: clamp(
          safeNumber(rawRoleContextThresholds.strongAlignmentMin, DEFAULT_METHOD_CONFIG.roleContextMatching.thresholds.strongAlignmentMin),
          0,
          1
        ),
        weakAlignmentMax: clamp(
          safeNumber(rawRoleContextThresholds.weakAlignmentMax, DEFAULT_METHOD_CONFIG.roleContextMatching.thresholds.weakAlignmentMax),
          0,
          1
        ),
        minimumFamilyConfidence: clamp(
          safeNumber(rawRoleContextThresholds.minimumFamilyConfidence, DEFAULT_METHOD_CONFIG.roleContextMatching.thresholds.minimumFamilyConfidence),
          0,
          1
        ),
      },
    },
    neuralMatching: {
      enabled: safeBoolean(rawNeuralMatching.enabled, DEFAULT_METHOD_CONFIG.neuralMatching.enabled),
      provider: {
        provider: ['google', 'mock'].includes(toText(rawNeuralProvider.provider).toLowerCase())
          ? toText(rawNeuralProvider.provider).toLowerCase()
          : DEFAULT_METHOD_CONFIG.neuralMatching.provider.provider,
        model: toText(rawNeuralProvider.model) || DEFAULT_METHOD_CONFIG.neuralMatching.provider.model,
        allowFallbackToRuleBased: safeBoolean(
          rawNeuralProvider.allowFallbackToRuleBased,
          DEFAULT_METHOD_CONFIG.neuralMatching.provider.allowFallbackToRuleBased
        ),
      },
      semanticTextBuilding: {
        maxOverallChars: clamp(
          safeNumber(
            rawNeuralSemanticTextBuilding.maxOverallChars,
            DEFAULT_METHOD_CONFIG.neuralMatching.semanticTextBuilding.maxOverallChars
          ),
          600,
          12000
        ),
        maxItemChars: clamp(
          safeNumber(
            rawNeuralSemanticTextBuilding.maxItemChars,
            DEFAULT_METHOD_CONFIG.neuralMatching.semanticTextBuilding.maxItemChars
          ),
          40,
          600
        ),
        maxSkillsItems: clamp(
          safeNumber(
            rawNeuralSemanticTextBuilding.maxSkillsItems,
            DEFAULT_METHOD_CONFIG.neuralMatching.semanticTextBuilding.maxSkillsItems
          ),
          4,
          40
        ),
        maxTechnologiesItems: clamp(
          safeNumber(
            rawNeuralSemanticTextBuilding.maxTechnologiesItems,
            DEFAULT_METHOD_CONFIG.neuralMatching.semanticTextBuilding.maxTechnologiesItems
          ),
          4,
          40
        ),
        maxHistoryTitleItems: clamp(
          safeNumber(
            rawNeuralSemanticTextBuilding.maxHistoryTitleItems,
            DEFAULT_METHOD_CONFIG.neuralMatching.semanticTextBuilding.maxHistoryTitleItems
          ),
          1,
          20
        ),
        maxHistoryDetailItems: clamp(
          safeNumber(
            rawNeuralSemanticTextBuilding.maxHistoryDetailItems,
            DEFAULT_METHOD_CONFIG.neuralMatching.semanticTextBuilding.maxHistoryDetailItems
          ),
          1,
          20
        ),
        maxProjectItems: clamp(
          safeNumber(
            rawNeuralSemanticTextBuilding.maxProjectItems,
            DEFAULT_METHOD_CONFIG.neuralMatching.semanticTextBuilding.maxProjectItems
          ),
          0,
          20
        ),
        maxRequirementItems: clamp(
          safeNumber(
            rawNeuralSemanticTextBuilding.maxRequirementItems,
            DEFAULT_METHOD_CONFIG.neuralMatching.semanticTextBuilding.maxRequirementItems
          ),
          2,
          30
        ),
        maxStackItems: clamp(
          safeNumber(
            rawNeuralSemanticTextBuilding.maxStackItems,
            DEFAULT_METHOD_CONFIG.neuralMatching.semanticTextBuilding.maxStackItems
          ),
          1,
          30
        ),
        maxLanguageItems: clamp(
          safeNumber(
            rawNeuralSemanticTextBuilding.maxLanguageItems,
            DEFAULT_METHOD_CONFIG.neuralMatching.semanticTextBuilding.maxLanguageItems
          ),
          0,
          10
        ),
      },
      neuralWeights,
      ruleAdjustments: {
        criticalPenaltyPerMissing: clamp(
          safeNumber(
            rawNeuralRuleAdjustments.criticalPenaltyPerMissing,
            DEFAULT_METHOD_CONFIG.neuralMatching.ruleAdjustments.criticalPenaltyPerMissing
          ),
          0,
          20
        ),
        maxCriticalPenalty: clamp(
          safeNumber(
            rawNeuralRuleAdjustments.maxCriticalPenalty,
            DEFAULT_METHOD_CONFIG.neuralMatching.ruleAdjustments.maxCriticalPenalty
          ),
          0,
          40
        ),
        lowConfidencePenaltyThreshold: clamp(
          safeNumber(
            rawNeuralRuleAdjustments.lowConfidencePenaltyThreshold,
            DEFAULT_METHOD_CONFIG.neuralMatching.ruleAdjustments.lowConfidencePenaltyThreshold
          ),
          0,
          1
        ),
        maxConfidencePenalty: clamp(
          safeNumber(
            rawNeuralRuleAdjustments.maxConfidencePenalty,
            DEFAULT_METHOD_CONFIG.neuralMatching.ruleAdjustments.maxConfidencePenalty
          ),
          0,
          20
        ),
        levelMismatchPenaltyPerLevel: clamp(
          safeNumber(
            rawNeuralRuleAdjustments.levelMismatchPenaltyPerLevel,
            DEFAULT_METHOD_CONFIG.neuralMatching.ruleAdjustments.levelMismatchPenaltyPerLevel
          ),
          0,
          30
        ),
        lowCriticalCoveragePenaltyMax: clamp(
          safeNumber(
            rawNeuralRuleAdjustments.lowCriticalCoveragePenaltyMax,
            DEFAULT_METHOD_CONFIG.neuralMatching.ruleAdjustments.lowCriticalCoveragePenaltyMax
          ),
          0,
          20
        ),
        sparseVacancyPenaltyMax: clamp(
          safeNumber(
            rawNeuralRuleAdjustments.sparseVacancyPenaltyMax,
            DEFAULT_METHOD_CONFIG.neuralMatching.ruleAdjustments.sparseVacancyPenaltyMax
          ),
          0,
          20
        ),
        roleContextPositiveMax: clamp(
          safeNumber(
            rawNeuralRuleAdjustments.roleContextPositiveMax,
            DEFAULT_METHOD_CONFIG.neuralMatching.ruleAdjustments.roleContextPositiveMax
          ),
          0,
          12
        ),
        roleContextNegativeMax: clamp(
          safeNumber(
            rawNeuralRuleAdjustments.roleContextNegativeMax,
            DEFAULT_METHOD_CONFIG.neuralMatching.ruleAdjustments.roleContextNegativeMax
          ),
          0,
          12
        ),
        crossDomainMismatchPenalty: clamp(
          safeNumber(
            rawNeuralRuleAdjustments.crossDomainMismatchPenalty,
            DEFAULT_METHOD_CONFIG.neuralMatching.ruleAdjustments.crossDomainMismatchPenalty
          ),
          0,
          25
        ),
        unknownDomainMismatchPenalty: clamp(
          safeNumber(
            rawNeuralRuleAdjustments.unknownDomainMismatchPenalty,
            DEFAULT_METHOD_CONFIG.neuralMatching.ruleAdjustments.unknownDomainMismatchPenalty
          ),
          0,
          20
        ),
        weakCoreCoverageThreshold: clamp(
          safeNumber(
            rawNeuralRuleAdjustments.weakCoreCoverageThreshold,
            DEFAULT_METHOD_CONFIG.neuralMatching.ruleAdjustments.weakCoreCoverageThreshold
          ),
          0,
          1
        ),
        weakOverlapPenalty: clamp(
          safeNumber(
            rawNeuralRuleAdjustments.weakOverlapPenalty,
            DEFAULT_METHOD_CONFIG.neuralMatching.ruleAdjustments.weakOverlapPenalty
          ),
          0,
          25
        ),
        veryLowRuleBasedThreshold: clamp(
          safeNumber(
            rawNeuralRuleAdjustments.veryLowRuleBasedThreshold,
            DEFAULT_METHOD_CONFIG.neuralMatching.ruleAdjustments.veryLowRuleBasedThreshold
          ),
          0,
          100
        ),
        severeSemanticMismatchThreshold: clamp(
          safeNumber(
            rawNeuralRuleAdjustments.severeSemanticMismatchThreshold,
            DEFAULT_METHOD_CONFIG.neuralMatching.ruleAdjustments.severeSemanticMismatchThreshold
          ),
          0,
          1
        ),
        severeSemanticMismatchPenalty: clamp(
          safeNumber(
            rawNeuralRuleAdjustments.severeSemanticMismatchPenalty,
            DEFAULT_METHOD_CONFIG.neuralMatching.ruleAdjustments.severeSemanticMismatchPenalty
          ),
          0,
          25
        ),
      },
      finalScore: {
        recommendationThresholds: {
          proceedMin: clamp(
            safeNumber(
              rawNeuralRecommendationThresholds.proceedMin,
              DEFAULT_METHOD_CONFIG.neuralMatching.finalScore.recommendationThresholds.proceedMin
            ),
            0,
            100
          ),
          reviewMin: clamp(
            safeNumber(
              rawNeuralRecommendationThresholds.reviewMin,
              DEFAULT_METHOD_CONFIG.neuralMatching.finalScore.recommendationThresholds.reviewMin
            ),
            0,
            100
          ),
        },
      },
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
        dateRecencyHalfLife: clamp(
          safeNumber(
            rawRelevantExperienceHeuristic.dateRecencyHalfLife,
            DEFAULT_METHOD_CONFIG.experienceScoring.relevantExperienceHeuristic.dateRecencyHalfLife
          ),
          0.25,
          20
        ),
        indexFallbackDecay: clamp(
          safeNumber(
            rawRelevantExperienceHeuristic.indexFallbackDecay ?? rawRelevantExperienceHeuristic.roleRecencyDecay,
            DEFAULT_METHOD_CONFIG.experienceScoring.relevantExperienceHeuristic.indexFallbackDecay
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
        requireDateForStrongRecencyBonus: safeBoolean(
          rawRelevantExperienceHeuristic.requireDateForStrongRecencyBonus,
          DEFAULT_METHOD_CONFIG.experienceScoring.relevantExperienceHeuristic.requireDateForStrongRecencyBonus
        ),
        maxRoleDateGapPenalty: clamp(
          safeNumber(
            rawRelevantExperienceHeuristic.maxRoleDateGapPenalty,
            DEFAULT_METHOD_CONFIG.experienceScoring.relevantExperienceHeuristic.maxRoleDateGapPenalty
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
    confidenceScoring: {
      profile: profileConfidenceWeights,
      match: matchConfidenceWeights,
    },
    confidenceThresholds: {
      lowProfile: clamp(
        safeNumber(rawConfidenceThresholds.lowProfile, DEFAULT_METHOD_CONFIG.confidenceThresholds.lowProfile),
        0,
        1
      ),
      lowMatch: clamp(
        safeNumber(rawConfidenceThresholds.lowMatch, DEFAULT_METHOD_CONFIG.confidenceThresholds.lowMatch),
        0,
        1
      ),
      proceedDowngradeThreshold: clamp(
        safeNumber(
          rawConfidenceThresholds.proceedDowngradeThreshold,
          DEFAULT_METHOD_CONFIG.confidenceThresholds.proceedDowngradeThreshold
        ),
        0,
        1
      ),
    },
    flagThresholds: {
      minCandidateSkills: clamp(
        safeNumber(rawFlagThresholds.minCandidateSkills, DEFAULT_METHOD_CONFIG.flagThresholds.minCandidateSkills),
        1,
        50
      ),
      minCandidateTechnologies: clamp(
        safeNumber(
          rawFlagThresholds.minCandidateTechnologies,
          DEFAULT_METHOD_CONFIG.flagThresholds.minCandidateTechnologies
        ),
        1,
        50
      ),
      minLanguages: clamp(
        safeNumber(rawFlagThresholds.minLanguages, DEFAULT_METHOD_CONFIG.flagThresholds.minLanguages),
        0,
        20
      ),
      minRequirementItems: clamp(
        safeNumber(rawFlagThresholds.minRequirementItems, DEFAULT_METHOD_CONFIG.flagThresholds.minRequirementItems),
        1,
        50
      ),
      minStackItems: clamp(
        safeNumber(rawFlagThresholds.minStackItems, DEFAULT_METHOD_CONFIG.flagThresholds.minStackItems),
        0,
        50
      ),
      minSkillBucketsTotal: clamp(
        safeNumber(rawFlagThresholds.minSkillBucketsTotal, DEFAULT_METHOD_CONFIG.flagThresholds.minSkillBucketsTotal),
        1,
        100
      ),
      weakRequirementsTextMinChars: clamp(
        safeNumber(
          rawFlagThresholds.weakRequirementsTextMinChars,
          DEFAULT_METHOD_CONFIG.flagThresholds.weakRequirementsTextMinChars
        ),
        0,
        5000
      ),
      weakSkillEvidenceMinSourceCount: clamp(
        safeNumber(
          rawFlagThresholds.weakSkillEvidenceMinSourceCount,
          DEFAULT_METHOD_CONFIG.flagThresholds.weakSkillEvidenceMinSourceCount
        ),
        0,
        10
      ),
      weakSkillEvidenceMinEvidenceBonus: clamp(
        safeNumber(
          rawFlagThresholds.weakSkillEvidenceMinEvidenceBonus,
          DEFAULT_METHOD_CONFIG.flagThresholds.weakSkillEvidenceMinEvidenceBonus
        ),
        0,
        10
      ),
      sparseProfileScoreThreshold: clamp(
        safeNumber(
          rawFlagThresholds.sparseProfileScoreThreshold,
          DEFAULT_METHOD_CONFIG.flagThresholds.sparseProfileScoreThreshold
        ),
        0,
        1
      ),
      sparseMatchScoreThreshold: clamp(
        safeNumber(
          rawFlagThresholds.sparseMatchScoreThreshold,
          DEFAULT_METHOD_CONFIG.flagThresholds.sparseMatchScoreThreshold
        ),
        0,
        1
      ),
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
  if (years >= METHOD_CONFIG.levelInference.seniorMinYears) return 'Senior';
  if (years >= METHOD_CONFIG.levelInference.middleMinYears) return 'Middle';
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
  const confidence = computeProfileConfidence(normalizedAnalysis, rawAnalysis, {
    skillDetails: {
      hardSkills: hardSkills.meta,
      softSkills: softSkills.meta,
    },
    experience: {
      generalYears: round(experience.generalYears),
      relevantYears: round(experience.relevantYears),
      blendedYears: round(blendedYears),
      source: experience.source,
      relevantYearsSource: experience.relevantYearsSource,
      hasReliableRoleDates: experience.hasReliableRoleDates,
      roleDateCoverage: round(experience.roleDateCoverage || 0),
      yearsWeightMultiplier: round(yearsWeightMultiplier),
      nonYearsSignal: round(nonYearsSignal),
      experienceEvidence: experience.experienceEvidence,
    },
  });

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
      relevantYearsSource: experience.relevantYearsSource,
      hasReliableRoleDates: experience.hasReliableRoleDates,
      roleDateCoverage: round(experience.roleDateCoverage || 0),
      yearsWeightMultiplier: round(yearsWeightMultiplier),
      nonYearsSignal: round(nonYearsSignal),
      experienceEvidence: experience.experienceEvidence,
    },
    skillDetails: {
      hardSkills: hardSkills.meta,
      softSkills: softSkills.meta,
    },
    confidence,
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
      confidence: {
        profileConfidenceScore: breakdown.confidence.score,
        flags: breakdown.confidence.flags,
        reasons: breakdown.confidence.reasons,
      },
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
  return inferExpectedLevelMeta(job).expectedLevel;
}

// РџСЂРѕР±СѓС” РІРёС‚СЏРіРЅСѓС‚Рё required years Р· С‚РµРєСЃС‚Сѓ РІР°РєР°РЅСЃС–С—.
function extractRequiredYears(job = {}) {
  return extractRequiredYearsMeta(job).requiredYears;
}

function normalizeRoleFamily(value) {
  const family = toText(value).toLowerCase();
  return ROLE_FAMILY_VALUES.includes(family) ? family : 'unknown';
}

function buildFamilyHitStrength(markerHits = [], priorityHits = []) {
  const markerStrength = markerHits.length ? Math.min(1, 0.55 + markerHits.length * 0.18) : 0;
  const priorityStrength = priorityHits.length ? Math.min(1, 0.7 + priorityHits.length * 0.15) : 0;
  return clamp(Math.max(markerStrength, priorityStrength), 0, 1);
}

function collectTermsFromSource(source = {}, terms = []) {
  const normalizedTerms = uniqueSkills(terms);
  if (!normalizedTerms.length) return [];

  const text = normalizeSkill(source.text);
  const values = uniqueSkills(source.values);
  return normalizedTerms.filter((term) => {
    if (!term) return false;
    if (values.includes(term)) return true;
    if (!text) return false;
    return textIncludesSkill(text, term);
  });
}

function inferRoleFamilyFromSources(sources = [], familyType = 'job') {
  const config = METHOD_CONFIG.roleContextMatching;
  const families = config.families;
  const familyEntries = Object.entries(families).filter(([family]) => family !== 'generic');
  const presentSources = sources.filter((source) => source.present && source.weight > 0);
  const presentWeight = presentSources.reduce((sum, source) => sum + source.weight, 0);
  const totalPossibleWeight = sources.reduce((sum, source) => sum + (source.weight > 0 ? source.weight : 0), 0);
  const familyScores = [];

  familyEntries.forEach(([family, definition]) => {
    let score = 0;
    const evidence = {};
    let matchedSourceCount = 0;

    presentSources.forEach((source) => {
      const markerHits = collectTermsFromSource(source, definition.markers);
      const priorityHits = collectTermsFromSource(source, definition.prioritySkills);
      const strength = buildFamilyHitStrength(markerHits, priorityHits);
      if (strength <= 0) return;

      score += source.weight * strength;
      matchedSourceCount += 1;
      evidence[source.key] = {
        markerHits,
        priorityHits,
        contribution: round(source.weight * strength),
      };
    });

    familyScores.push({
      family,
      score,
      matchedSourceCount,
      evidence,
    });
  });

  familyScores.sort((left, right) => right.score - left.score);
  const top = familyScores[0] || { family: 'unknown', score: 0, matchedSourceCount: 0, evidence: {} };
  const second = familyScores[1] || { score: 0 };
  const topRatio = presentWeight > 0 ? top.score / presentWeight : 0;
  const marginRatio = presentWeight > 0 ? Math.max(0, top.score - second.score) / presentWeight : 0;
  const sourceCoverage = presentSources.length > 0 ? top.matchedSourceCount / presentSources.length : 0;
  const presenceCoverage = totalPossibleWeight > 0 ? presentWeight / totalPossibleWeight : 0;
  const baseConfidence = clamp(
    (topRatio * 0.7 + marginRatio * 0.2 + sourceCoverage * 0.1) *
      (0.45 + presenceCoverage * 0.55),
    0,
    1
  );
  const genericDefinition = families.generic || { markers: [], prioritySkills: [] };
  const genericMarkerHits = presentSources.flatMap((source) => collectTermsFromSource(source, genericDefinition.markers));
  const genericScore = genericMarkerHits.length
    ? clamp((genericMarkerHits.length / Math.max(genericDefinition.markers.length, 1)) * 0.6, 0, 1)
    : 0;

  let family = top.family;
  let confidence = baseConfidence;
  let evidence = top.evidence;
  let matchedMarkers = uniqueStrings(
    Object.values(top.evidence).flatMap((item) => [...(item.markerHits || []), ...(item.priorityHits || [])])
  );

  if (topRatio < config.thresholds.minimumFamilyConfidence) {
    if (genericScore > 0) {
      family = 'generic';
      confidence = clamp(genericScore * (0.55 + sourceCoverage * 0.2), 0, 1);
      evidence = {
        generic: {
          markerHits: uniqueStrings(genericMarkerHits),
          priorityHits: [],
          contribution: round(genericScore),
        },
      };
      matchedMarkers = uniqueStrings(genericMarkerHits);
    } else {
      family = 'unknown';
      confidence = 0;
      evidence = {};
      matchedMarkers = [];
    }
  }

  return {
    family,
    confidence: round(confidence),
    evidence,
    matchedMarkers,
    familyScores: familyScores.map((item) => ({
      family: item.family,
      score: round(item.score),
    })),
    sourceType: familyType,
  };
}

function inferRoleFamilyFromJob(job = {}, skillBuckets = null) {
  const resolvedBuckets = skillBuckets || buildVacancySkillBuckets(job);
  const explicitBucketValues = [
    ...(Array.isArray(job.criticalSkills) ? job.criticalSkills : []),
    ...(Array.isArray(job.coreSkills) ? job.coreSkills : []),
    ...(Array.isArray(job.optionalSkills) ? job.optionalSkills : []),
    ...(Array.isArray(resolvedBuckets?.criticalSkills) ? resolvedBuckets.criticalSkills : []),
    ...(Array.isArray(resolvedBuckets?.coreSkills) ? resolvedBuckets.coreSkills : []),
    ...(Array.isArray(resolvedBuckets?.optionalSkills) ? resolvedBuckets.optionalSkills : []),
  ];

  const sources = [
    {
      key: 'title',
      weight: METHOD_CONFIG.roleContextMatching.weights.job.title,
      present: Boolean(toText(job.title)),
      text: job.title,
      values: [job.title],
    },
    {
      key: 'requirements',
      weight: METHOD_CONFIG.roleContextMatching.weights.job.requirements,
      present: Array.isArray(job.requirements) && job.requirements.length > 0,
      text: Array.isArray(job.requirements) ? job.requirements.join(' ') : '',
      values: Array.isArray(job.requirements) ? job.requirements : [],
    },
    {
      key: 'stack',
      weight: METHOD_CONFIG.roleContextMatching.weights.job.stack,
      present: Array.isArray(job.stack) && job.stack.length > 0,
      text: Array.isArray(job.stack) ? job.stack.join(' ') : '',
      values: Array.isArray(job.stack) ? job.stack : [],
    },
    {
      key: 'explicitBuckets',
      weight: METHOD_CONFIG.roleContextMatching.weights.job.explicitBuckets,
      present: explicitBucketValues.length > 0,
      text: explicitBucketValues.join(' '),
      values: explicitBucketValues,
    },
  ];

  return inferRoleFamilyFromSources(sources, 'job');
}

function inferRoleFamilyFromCandidate(analysis = {}, rawAnalysis = analysis) {
  const roleEntries = extractRoleEntries(rawAnalysis, safeYears(analysis.generalYearsExperience ?? analysis.yearsOfExperience));
  const historyTitles = roleEntries.map((item) => item.title).filter(Boolean);
  const historyDescriptions = roleEntries.map((item) => item.text).filter(Boolean);
  const projectTexts = extractTextFromUnknown(rawAnalysis.projects);
  const sources = [
    {
      key: 'position',
      weight: METHOD_CONFIG.roleContextMatching.weights.candidate.position,
      present: Boolean(toText(analysis.position)),
      text: analysis.position,
      values: [analysis.position],
    },
    {
      key: 'summary',
      weight: METHOD_CONFIG.roleContextMatching.weights.candidate.summary,
      present: Boolean(toText(analysis.summary)),
      text: analysis.summary,
      values: [analysis.summary],
    },
    {
      key: 'skills',
      weight: METHOD_CONFIG.roleContextMatching.weights.candidate.skills,
      present: Array.isArray(analysis.skills) && analysis.skills.length > 0,
      text: Array.isArray(analysis.skills) ? analysis.skills.join(' ') : '',
      values: Array.isArray(analysis.skills) ? analysis.skills : [],
    },
    {
      key: 'technologies',
      weight: METHOD_CONFIG.roleContextMatching.weights.candidate.technologies,
      present: Array.isArray(analysis.technologies) && analysis.technologies.length > 0,
      text: Array.isArray(analysis.technologies) ? analysis.technologies.join(' ') : '',
      values: Array.isArray(analysis.technologies) ? analysis.technologies : [],
    },
    {
      key: 'historyTitles',
      weight: METHOD_CONFIG.roleContextMatching.weights.candidate.historyTitles,
      present: historyTitles.length > 0,
      text: historyTitles.join(' '),
      values: historyTitles,
    },
    {
      key: 'historyDescriptions',
      weight: METHOD_CONFIG.roleContextMatching.weights.candidate.historyDescriptions,
      present: historyDescriptions.length > 0,
      text: historyDescriptions.join(' '),
      values: historyDescriptions,
    },
    {
      key: 'projects',
      weight: METHOD_CONFIG.roleContextMatching.weights.candidate.projects,
      present: Boolean(projectTexts),
      text: projectTexts,
      values: [projectTexts],
    },
  ];

  return inferRoleFamilyFromSources(sources, 'candidate');
}

function getRoleFamilyAdjacency(leftFamily, rightFamily) {
  const left = normalizeRoleFamily(leftFamily);
  const right = normalizeRoleFamily(rightFamily);
  if (left === right) return 1;
  const directKey = `${left}:${right}`;
  const reverseKey = `${right}:${left}`;
  return METHOD_CONFIG.roleContextMatching.adjacency[directKey] ??
    METHOD_CONFIG.roleContextMatching.adjacency[reverseKey] ??
    null;
}

function bandFromAlignment(alignment, familyA, familyB) {
  const left = normalizeRoleFamily(familyA);
  const right = normalizeRoleFamily(familyB);
  if (['generic', 'unknown'].includes(left) || ['generic', 'unknown'].includes(right)) return 'neutral';
  if (alignment >= METHOD_CONFIG.roleContextMatching.thresholds.strongAlignmentMin) return 'strong';
  if (alignment <= METHOD_CONFIG.roleContextMatching.thresholds.weakAlignmentMax) return 'weak';
  return 'medium';
}

function computeRoleContextAlignment(jobFamilyInfo, candidateFamilyInfo, analysis = {}, job = {}) {
  const config = METHOD_CONFIG.roleContextMatching;
  const jobFamily = normalizeRoleFamily(jobFamilyInfo?.family);
  const candidateFamily = normalizeRoleFamily(candidateFamilyInfo?.family);
  const adjacencyScore = getRoleFamilyAdjacency(jobFamily, candidateFamily);

  let roleContextAlignment = config.scoring.unknownFamilyScore;
  let adjustmentReason = 'Контекст ролі нейтральний.';

  if (jobFamily === candidateFamily && !['generic', 'unknown'].includes(jobFamily)) {
    roleContextAlignment = config.scoring.sameFamilyScore;
    adjustmentReason = `Кандидат і вакансія належать до одного рольового напряму: ${jobFamily}.`;
  } else if (adjacencyScore !== null && !['generic', 'unknown'].includes(jobFamily) && !['generic', 'unknown'].includes(candidateFamily)) {
    roleContextAlignment = clamp(adjacencyScore, 0, 1);
    adjustmentReason = `Напрям кандидата ${candidateFamily} є суміжним до напряму вакансії ${jobFamily}.`;
  } else if (jobFamily === 'generic' || candidateFamily === 'generic') {
    roleContextAlignment = config.scoring.genericFamilyScore;
    adjustmentReason = 'Одна зі сторін має занадто загальний професійний контекст, тому вплив цього фактора майже нейтральний.';
  } else if (jobFamily === 'unknown' || candidateFamily === 'unknown') {
    roleContextAlignment = config.scoring.unknownFamilyScore;
    adjustmentReason = 'Для однієї зі сторін не вдалося впевнено визначити професійний напрям.';
  } else {
    roleContextAlignment = config.scoring.crossFamilyScore;
    adjustmentReason = `Напрям кандидата ${candidateFamily} слабко узгоджується з напрямом вакансії ${jobFamily}.`;
  }

  const roleContextConfidence = round(
    Math.sqrt(clamp(jobFamilyInfo?.confidence || 0, 0, 1) * clamp(candidateFamilyInfo?.confidence || 0, 0, 1))
  );
  let rawContextAdjustment = 0;
  if (jobFamily === candidateFamily && !['generic', 'unknown'].includes(jobFamily)) {
    rawContextAdjustment =
      config.scoring.matchBonusMax * clamp((roleContextAlignment - 0.5) / 0.5, 0, 1);
  } else if (adjacencyScore !== null && !['generic', 'unknown'].includes(jobFamily) && !['generic', 'unknown'].includes(candidateFamily)) {
    if (roleContextAlignment >= 0.5) {
      rawContextAdjustment =
        config.scoring.matchBonusMax * 0.7 * clamp((roleContextAlignment - 0.5) / 0.5, 0, 1);
    } else {
      rawContextAdjustment =
        -config.scoring.mismatchPenaltyMax * 0.6 * clamp((0.5 - roleContextAlignment) / 0.5, 0, 1);
    }
  } else if (jobFamily === 'generic' || candidateFamily === 'generic' || jobFamily === 'unknown' || candidateFamily === 'unknown') {
    rawContextAdjustment =
      clamp((roleContextAlignment - 0.5) * 2, -1, 1) * config.scoring.nearNeutralMax;
  } else {
    rawContextAdjustment =
      -config.scoring.mismatchPenaltyMax * clamp((0.5 - roleContextAlignment) / 0.5, 0, 1);
  }

  const effectiveContextAdjustment = round(rawContextAdjustment * roleContextConfidence, 4);
  const alignmentBand = bandFromAlignment(roleContextAlignment, jobFamily, candidateFamily);

  return {
    roleContextAlignment: round(roleContextAlignment),
    alignmentBand,
    rawContextAdjustment: round(rawContextAdjustment, 4),
    effectiveContextAdjustment,
    adjustmentReason,
    roleContextConfidence,
    jobRoleFamily: jobFamily,
    candidateRoleFamily: candidateFamily,
    jobFamilyConfidence: round(jobFamilyInfo?.confidence || 0),
    candidateFamilyConfidence: round(candidateFamilyInfo?.confidence || 0),
    jobFamilyEvidence: {
      evidence: jobFamilyInfo?.evidence || {},
      matchedMarkers: jobFamilyInfo?.matchedMarkers || [],
      familyScores: jobFamilyInfo?.familyScores || [],
    },
    candidateFamilyEvidence: {
      evidence: candidateFamilyInfo?.evidence || {},
      matchedMarkers: candidateFamilyInfo?.matchedMarkers || [],
      familyScores: candidateFamilyInfo?.familyScores || [],
    },
    analysisPosition: toText(analysis.position),
    jobTitle: toText(job.title),
  };
}

function canonicalSkill(value) {
  return normalizeSkill(value)
    .replace(/\bc\+\+\b/g, 'cpp')
    .replace(/\bc#\b/g, 'csharp')
    .replace(/\.js\b/g, 'js')
    .replace(/[^a-z0-9]+/g, '');
}

function getCanonicalLabel(normalizedSkill, aliasKey) {
  return (
    ACTIVE_CANONICAL_LABEL_LOOKUP.get(aliasKey) ||
    normalizeSkill(normalizedSkill) ||
    normalizeSkill(aliasKey) ||
    ''
  );
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

function buildCanonicalLabelLookup(groups = []) {
  const map = new Map();
  for (const group of groups) {
    const canonicalGroupKey = canonicalSkill(group[0]);
    const canonicalLabel = normalizeSkill(group[0]) || group[0];
    if (canonicalGroupKey) {
      map.set(canonicalGroupKey, canonicalLabel);
    }
  }
  return map;
}

function buildRelatedLookup(groups = [], aliasLookup = new Map()) {
  const map = new Map();
  groups.forEach((group, index) => {
    group.forEach((item) => {
      const aliasKey = aliasLookup.get(canonicalSkill(item)) || canonicalSkill(item);
      map.set(aliasKey, `group-${index}`);
    });
  });
  return map;
}

const ACTIVE_GENERIC_ROLE_TOKENS = new Set(METHOD_CONFIG.skillMatching.genericRoleTokens);
const ACTIVE_CRITICAL_REQUIREMENT_MARKERS = METHOD_CONFIG.skillMatching.criticalMarkers;
const ACTIVE_OPTIONAL_REQUIREMENT_MARKERS = METHOD_CONFIG.skillMatching.optionalMarkers;
const ACTIVE_SKILL_ALIAS_LOOKUP = buildAliasLookup(METHOD_CONFIG.skillMatching.synonymGroups);
const ACTIVE_CANONICAL_LABEL_LOOKUP = buildCanonicalLabelLookup(METHOD_CONFIG.skillMatching.synonymGroups);
const ACTIVE_RELATED_SKILL_LOOKUP = buildRelatedLookup(
  METHOD_CONFIG.skillMatching.relatedGroups,
  ACTIVE_SKILL_ALIAS_LOOKUP
);
const ACTIVE_REQUIREMENT_MARKERS_PATTERN = [
  ...ACTIVE_CRITICAL_REQUIREMENT_MARKERS,
  ...ACTIVE_OPTIONAL_REQUIREMENT_MARKERS,
]
  .map((marker) => escapeRegExp(marker))
  .sort((left, right) => right.length - left.length)
  .join('|');

function tokenizeSkill(value) {
  return uniqueSkills(
    normalizeSkill(value)
      .replace(/[^a-z0-9+#.]+/g, ' ')
      .split(/\s+/)
      .filter(
        (token) =>
          token &&
          !ACTIVE_GENERIC_ROLE_TOKENS.has(token) &&
          !['experience', 'knowledge'].includes(token)
      )
  );
}

function cleanSkillFragment(fragment = '') {
  const markerPattern = ACTIVE_REQUIREMENT_MARKERS_PATTERN || 'must have|must-have|required|mandatory|essential|nice to have|nice-to-have|preferred|plus|bonus';
  const cleaned = toText(fragment)
    .replace(new RegExp(`\\b(${markerPattern})\\b[:\\s-]*`, 'ig'), '')
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
  if (ACTIVE_OPTIONAL_REQUIREMENT_MARKERS.some((marker) => normalized.includes(marker))) return 'optional';
  if (ACTIVE_CRITICAL_REQUIREMENT_MARKERS.some((marker) => normalized.includes(marker))) return 'critical';
  return 'core';
}

function buildVacancySkillBuckets(job = {}) {
  const config = METHOD_CONFIG.bucketBuilding;
  const bucketOrder = ['critical', 'core', 'optional'];
  const buckets = {
    critical: new Map(),
    core: new Map(),
    optional: new Map(),
  };
  const duplicateCandidatesRemoved = {
    explicit: 0,
    heuristic: 0,
    stack: 0,
  };
  let deduplicatedSkillCount = 0;

  const explicitEntries = {
    critical: Array.isArray(job.criticalSkills) ? job.criticalSkills : [],
    core: Array.isArray(job.coreSkills) ? job.coreSkills : [],
    optional: Array.isArray(job.optionalSkills) ? job.optionalSkills : [],
  };
  const explicitCounts = {
    critical: explicitEntries.critical.length,
    core: explicitEntries.core.length,
    optional: explicitEntries.optional.length,
  };
  const explicitProvidedBuckets = bucketOrder.filter((bucket) => explicitCounts[bucket] > 0);
  const hasExplicitBuckets = explicitProvidedBuckets.length > 0;
  const explicitBucketsArePartial = hasExplicitBuckets && explicitProvidedBuckets.length < bucketOrder.length;
  const useHeuristicSupplement =
    !hasExplicitBuckets ||
    (config.useHeuristicsWhenExplicitPartial && explicitBucketsArePartial) ||
    config.explicitPrecedenceMode === 'merge';

  const addSkill = (bucketName, skill, source = 'heuristic') => {
    const normalized = normalizeSkill(skill);
    const label = toText(skill);
    if (!normalized || !label) return false;

    if (config.deduplicateAcrossBuckets) {
      for (const existingBucketName of bucketOrder) {
        if (buckets[existingBucketName].has(normalized)) {
          duplicateCandidatesRemoved[source] += 1;
          return false;
        }
      }
    } else if (buckets[bucketName].has(normalized)) {
      duplicateCandidatesRemoved[source] += 1;
      return false;
    }

    buckets[bucketName].set(normalized, label);
    deduplicatedSkillCount += 1;
    return true;
  };

  bucketOrder.forEach((bucketName) => {
    explicitEntries[bucketName].forEach((skill) => addSkill(bucketName, skill, 'explicit'));
  });

  const shouldSupplementBucket = (bucketName) => {
    if (!hasExplicitBuckets) return true;
    if (config.explicitPrecedenceMode === 'merge') return true;
    if (config.explicitPrecedenceMode === 'strict') return explicitCounts[bucketName] === 0;
    if (config.explicitPrecedenceMode === 'primary') {
      if (!config.useHeuristicsWhenExplicitPartial) return explicitCounts[bucketName] === 0 && !hasExplicitBuckets;
      return explicitCounts[bucketName] === 0;
    }
    return explicitCounts[bucketName] === 0;
  };

  if (useHeuristicSupplement) {
    const requirements = Array.isArray(job.requirements) ? job.requirements : [];
    requirements.forEach((item) => {
      const bucketName = detectRequirementBucket(item);
      if (!shouldSupplementBucket(bucketName)) return;
      const fragments = splitSkillFragments(item);
      if (!fragments.length) return;
      fragments.forEach((fragment) => addSkill(bucketName, fragment, 'heuristic'));
    });
  }

  const stack = Array.isArray(job.stack) ? job.stack : [];
  const stackBucketName = ['critical', 'core', 'optional'].includes(config.stackDefaultBucket)
    ? config.stackDefaultBucket
    : 'core';
  const shouldUseStack = !hasExplicitBuckets || config.explicitPrecedenceMode === 'merge' || explicitCounts[stackBucketName] === 0;
  if (shouldUseStack) {
    stack.forEach((item) => addSkill(stackBucketName, item, 'stack'));
  }

  const bucketBuildMode = !hasExplicitBuckets
    ? 'heuristic-only'
    : useHeuristicSupplement
      ? 'partial-explicit-with-heuristic-supplement'
      : 'explicit-only';

  return {
    criticalSkills: [...buckets.critical.values()],
    coreSkills: [...buckets.core.values()],
    optionalSkills: [...buckets.optional.values()],
    metadata: {
      skillBucketsSource:
        bucketBuildMode === 'explicit-only'
          ? 'explicit'
          : bucketBuildMode === 'heuristic-only'
            ? 'heuristic'
            : 'explicit+heuristic',
      hasExplicitBuckets,
      usedHeuristicSupplement: useHeuristicSupplement && hasExplicitBuckets,
      bucketBuildMode,
      deduplicatedSkillCount,
      duplicateCandidatesRemoved,
    },
  };
}

function buildCandidateSkillEntries(analysis = {}) {
  return uniqueStrings([
    ...(Array.isArray(analysis.skills) ? analysis.skills : []),
    ...(Array.isArray(analysis.technologies) ? analysis.technologies : []),
  ]).map((skill) => {
    const canonical = canonicalSkill(skill);
    const aliasKey = ACTIVE_SKILL_ALIAS_LOOKUP.get(canonical) || canonical;
    return {
      label: skill,
      normalized: normalizeSkill(skill),
      canonical,
      aliasKey,
      canonicalLabel: getCanonicalLabel(skill, aliasKey),
      relatedGroup: ACTIVE_RELATED_SKILL_LOOKUP.get(aliasKey) || null,
      tokens: tokenizeSkill(skill),
    };
  });
}

function isRelatedSkill(requiredEntry, candidateEntry) {
  if (requiredEntry.relatedGroup && requiredEntry.relatedGroup === candidateEntry.relatedGroup) {
    return {
      matched: true,
      source: 'related-group',
      score: METHOD_CONFIG.matchSkillTiers.related,
    };
  }

  const requiredTokens = requiredEntry.tokens || [];
  const candidateTokens = candidateEntry.tokens || [];
  if (!requiredTokens.length || !candidateTokens.length) {
    return {
      matched: false,
      source: 'none',
      score: METHOD_CONFIG.matchSkillTiers.none,
    };
  }

  const overlap = requiredTokens.filter((token) => candidateTokens.includes(token)).length;
  const minTokenCount = Math.min(requiredTokens.length, candidateTokens.length);
  const threshold = METHOD_CONFIG.skillMatching.tokenOverlapRelatedThreshold;
  const matches = minTokenCount > 0 ? overlap / minTokenCount >= threshold : false;
  return {
    matched: matches,
    source: matches ? 'token-overlap' : 'none',
    score: matches ? METHOD_CONFIG.matchSkillTiers.relatedTokenOverlap : METHOD_CONFIG.matchSkillTiers.none,
  };
}

function getTierLabel(score) {
  if (score >= METHOD_CONFIG.matchSkillTiers.exact) return 'exact';
  if (score >= METHOD_CONFIG.matchSkillTiers.synonym) return 'synonym';
  if (score >= METHOD_CONFIG.matchSkillTiers.relatedTokenOverlap) return 'related';
  return 'none';
}

function findBestSkillMatch(requiredSkill, candidateEntries = []) {
  const requiredCanonical = canonicalSkill(requiredSkill);
  const requiredAliasKey = ACTIVE_SKILL_ALIAS_LOOKUP.get(requiredCanonical) || requiredCanonical;
  const requiredEntry = {
    label: requiredSkill,
    normalized: normalizeSkill(requiredSkill),
    canonical: requiredCanonical,
    aliasKey: requiredAliasKey,
    canonicalLabel: getCanonicalLabel(requiredSkill, requiredAliasKey),
    relatedGroup: ACTIVE_RELATED_SKILL_LOOKUP.get(requiredAliasKey) || null,
    tokens: tokenizeSkill(requiredSkill),
  };

  let best = {
    requiredSkill,
    matchedSkill: null,
    tier: 'none',
    score: METHOD_CONFIG.matchSkillTiers.none,
    matchSource: 'none',
    requiredCanonical: requiredEntry.canonicalLabel,
    matchedCanonical: null,
    matchedTierScore: METHOD_CONFIG.matchSkillTiers.none,
  };

  for (const candidateEntry of candidateEntries) {
    let score = METHOD_CONFIG.matchSkillTiers.none;
    let matchSource = 'none';
    if (candidateEntry.normalized === requiredEntry.normalized) {
      score = METHOD_CONFIG.matchSkillTiers.exact;
      matchSource = 'exact';
    } else if (candidateEntry.aliasKey === requiredEntry.aliasKey) {
      score = METHOD_CONFIG.matchSkillTiers.synonym;
      matchSource = 'synonym-group';
    } else {
      const relatedMatch = isRelatedSkill(requiredEntry, candidateEntry);
      score = relatedMatch.score;
      matchSource = relatedMatch.source;
    }

    if (score > best.score) {
      best = {
        requiredSkill,
        matchedSkill: candidateEntry.label,
        tier: getTierLabel(score),
        score,
        matchSource,
        requiredCanonical: requiredEntry.canonicalLabel,
        matchedCanonical: candidateEntry.canonicalLabel,
        matchedTierScore: score,
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
          ? `У вакансії немає чіткої вимоги щодо років досвіду. Використано комбінований досвід: ${round(relevantYears)} р. релевантного та ${round(generalYears)} р. загального відносно базового орієнтиру ${defaultYears} р.`
          : `У вакансії немає чіткої вимоги щодо років досвіду. Використано загальний досвід: ${round(generalYears)} р. відносно базового орієнтиру ${defaultYears} р.`,
    };
  }

  const fit = clamp(effectiveYears / requiredYears, 0, 1);
  let reason = `Вакансія очікує ${requiredYears}+ р. досвіду. Ефективний досвід кандидата оцінено як ${round(effectiveYears)} р. (${round(relevantYears)} р. релевантного та ${round(generalYears)} р. загального).`;
  if (relevantYears < requiredYears && generalYears >= requiredYears) {
    reason += ' Загальний досвід допомагає, але ключовим обмеженням лишається саме релевантний досвід.';
  } else if (relevantYears >= requiredYears) {
    reason += ' Релевантного досвіду достатньо навіть без додаткових припущень.';
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
    strengths.push(`Збіг критично важливих навичок: ${matchDetails.matchedCriticalSkills.length} з ${matchDetails.criticalTotal}`);
  }
  if (matchDetails.coreTotal > 0) {
    strengths.push(`Збіг основних навичок: ${matchDetails.matchedCoreSkills.length} з ${matchDetails.coreTotal}`);
  }
  for (const skill of matchDetails.matchedCriticalSkills.slice(0, 2)) {
    strengths.push(`Є критично важлива навичка: ${skill}`);
  }
  for (const skill of matchDetails.matchedOptionalSkills.slice(0, 2)) {
    strengths.push(`Є додаткова корисна навичка: ${skill}`);
  }

  if (experienceContext.relevantYears >= 1) {
    strengths.push(`Релевантний досвід: ${round(experienceContext.relevantYears)} р.`);
  } else if (experienceContext.generalYears >= 2) {
    strengths.push(`Загальний досвід: ${round(experienceContext.generalYears)} р.`);
  }
  if (expectedLevel && normalizeLevel(analysis.level) === expectedLevel) {
    strengths.push(`Рівень відповідає ролі: ${analysis.level}`);
  }
  if (requiredYears && experienceContext.fit >= 1) {
    strengths.push(`Відповідає вимозі за досвідом (${requiredYears}+ р.)`);
  }

  return uniqueStrings(strengths).slice(0, 5);
}

// Р¤РѕСЂРјСѓС” РєРѕСЂРѕС‚РєС– "РіРµРїРё" РґР»СЏ РїРѕСЏСЃРЅРµРЅРЅСЏ СЂРµР·СѓР»СЊС‚Р°С‚Сѓ.
function buildGaps(matchDetails, analysis, expectedLevel, requiredYears, experienceContext) {
  const gaps = [];
  for (const skill of matchDetails.missingCriticalSkills.slice(0, 3)) {
    gaps.push(`Відсутня критично важлива навичка: ${skill}`);
  }
  for (const skill of matchDetails.missingCoreSkills.slice(0, 2)) {
    gaps.push(`Відсутня основна навичка: ${skill}`);
  }
  if (
    matchDetails.missingCriticalSkills.length >=
    METHOD_CONFIG.matchPenalties.criticalMissingProceedBlockThreshold
  ) {
    gaps.push('Брак критично важливих навичок не дозволяє автоматично рекомендувати кандидата.');
  }

  if (requiredYears && experienceContext.fit < 1) {
    gaps.push(
      `Досвід нижчий за вимоги вакансії (${round(experienceContext.relevantYears)} р. релевантного / ${round(experienceContext.generalYears)} р. загального при вимозі ${requiredYears}+ р.)`
    );
  }

  if (expectedLevel && levelToRank(analysis.level) < levelToRank(expectedLevel)) {
    gaps.push(`Поточний рівень (${analysis.level}) нижчий за очікуваний (${expectedLevel})`);
  }

  return uniqueStrings(gaps).slice(0, 5);
}

// РћСЃРЅРѕРІРЅР° С„РѕСЂРјСѓР»Р° РІС–РґРїРѕРІС–РґРЅРѕСЃС‚С–:
// match = criticalCoverage*w1 + coreCoverage*w2 + optionalCoverage*w3 + experienceFit*w4 + levelFit*w5 - penalty
// matchPercentage = round(match * 100)
function computeDeterministicMatch(analysisRaw = {}, job = {}) {
  const analysis = normalizeAnalysisForScoring(analysisRaw);
  const profileBreakdown = computeProfileScoringBreakdown(analysis, analysisRaw);
  const profileConfidence = profileBreakdown.confidence;
  const candidateEntries = buildCandidateSkillEntries(analysis);
  const skillBuckets = buildVacancySkillBuckets(job);
  const criticalMatch = computeBucketMatch(skillBuckets.criticalSkills, candidateEntries, 'critical');
  const coreMatch = computeBucketMatch(skillBuckets.coreSkills, candidateEntries, 'core');
  const optionalMatch = computeBucketMatch(skillBuckets.optionalSkills, candidateEntries, 'optional');
  const requiredYearsMeta = extractRequiredYearsMeta(job);
  const expectedLevelMeta = inferExpectedLevelMeta(job);
  const requiredYears = requiredYearsMeta.requiredYears;
  const expectedLevel = expectedLevelMeta.expectedLevel;
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
  const jobFamilyInfo = inferRoleFamilyFromJob(job, skillBuckets);
  const candidateFamilyInfo = inferRoleFamilyFromCandidate(analysis, analysisRaw);
  const roleContext = computeRoleContextAlignment(jobFamilyInfo, candidateFamilyInfo, analysis, job);
  let contextAdjustment = METHOD_CONFIG.roleContextMatching.enabled ? roleContext.effectiveContextAdjustment : 0;
  if (criticalMatch.missing.length > 0 && contextAdjustment > 0) {
    contextAdjustment = 0;
    roleContext.adjustmentReason += ' Позитивне коригування за контекстом вимкнено, бо бракує критично важливих навичок.';
  }
  const scoreAfterContext = clamp(scoreAfterPenalty + contextAdjustment, 0, 1);
  const matchPercentage = clamp(Math.round(scoreAfterContext * 100), 0, 100);
  let recommendation = recommendationFromScore(matchPercentage);
  if (
    criticalMatch.missing.length >= METHOD_CONFIG.matchPenalties.criticalMissingProceedBlockThreshold &&
    recommendation === 'Proceed'
  ) {
    recommendation = 'Review manually';
  }
  const confidence = computeMatchConfidence(job, analysis, skillBuckets, experienceSignals, profileConfidence, {
    requiredYearsMeta,
    expectedLevelMeta,
  });
  if (
    recommendation === 'Proceed' &&
    confidence.score < METHOD_CONFIG.confidenceThresholds.proceedDowngradeThreshold
  ) {
    recommendation = 'Review manually';
  }
  const confidenceReasons = confidence.reasons || [];

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
    matchedTierScore: round(item.matchedTierScore),
  }));

  return {
    matchPercentage,
    strengths: buildStrengths(matchDetails, analysis, expectedLevel, requiredYears, {
      ...experienceSignals,
      ...experienceContext,
    }),
    gaps: uniqueStrings([
      ...buildGaps(matchDetails, analysis, expectedLevel, requiredYears, {
        ...experienceSignals,
        ...experienceContext,
      }),
      ...(recommendation === 'Review manually' &&
      matchPercentage >= METHOD_CONFIG.recommendationThresholds.proceedMin &&
      confidence.score < METHOD_CONFIG.confidenceThresholds.proceedDowngradeThreshold
        ? ['Низька впевненість системи не дозволяє автоматично рекомендувати кандидата']
        : []),
    ]).slice(0, 6),
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
      confidence: {
        matchConfidenceScore: confidence.score,
        flags: confidence.flags,
        reasons: confidenceReasons,
      },
      breakdown: {
        criticalCoverage: round(criticalMatch.coverage || 0),
        coreCoverage: round(coreMatch.coverage || 0),
        optionalCoverage: round(optionalMatch.coverage || 0),
        experienceFit: round(experienceFit),
        generalYears: round(experienceSignals.generalYears),
        relevantYears: round(experienceSignals.relevantYears),
        relevantYearsSource: experienceSignals.relevantYearsSource,
        hasReliableRoleDates: experienceSignals.hasReliableRoleDates,
        roleDateCoverage: round(experienceSignals.roleDateCoverage || 0),
        effectiveYears: round(experienceContext.effectiveYears),
        experienceFitReason: experienceContext.reason,
        experienceEvidence: experienceSignals.experienceEvidence,
        levelFit: round(levelFit),
        scoreBeforePenalty: round(scoreBeforePenalty),
        criticalPenalty: round(criticalPenalty),
        scoreAfterPenalty: round(scoreAfterPenalty),
        scoreAfterContext: round(scoreAfterContext),
      },
      weights: activeWeights,
      configuredWeights: METHOD_CONFIG.matchWeights,
      penalties: METHOD_CONFIG.matchPenalties,
      matchTiers: METHOD_CONFIG.matchSkillTiers,
      skillMatching: {
        tokenOverlapRelatedThreshold: METHOD_CONFIG.skillMatching.tokenOverlapRelatedThreshold,
      },
      thresholds: METHOD_CONFIG.recommendationThresholds,
      confidenceThresholds: METHOD_CONFIG.confidenceThresholds,
      expectedLevel: expectedLevel || null,
      requiredYears: Number.isFinite(requiredYears) ? requiredYears : null,
      expectedLevelSource: expectedLevelMeta.source,
      expectedLevelConfidence: round(expectedLevelMeta.confidence),
      requiredYearsSource: requiredYearsMeta.source,
      requiredYearsConfidence: round(requiredYearsMeta.confidence),
      skillBucketsSource: skillBuckets.metadata?.skillBucketsSource || 'heuristic',
      hasExplicitBuckets: Boolean(skillBuckets.metadata?.hasExplicitBuckets),
      usedHeuristicSupplement: Boolean(skillBuckets.metadata?.usedHeuristicSupplement),
      bucketBuildMode: skillBuckets.metadata?.bucketBuildMode || 'heuristic-only',
      deduplicatedSkillCount: Number(skillBuckets.metadata?.deduplicatedSkillCount || 0),
      duplicateCandidatesRemoved: skillBuckets.metadata?.duplicateCandidatesRemoved || {
        explicit: 0,
        heuristic: 0,
        stack: 0,
      },
      skillBuckets: {
        criticalSkills: skillBuckets.criticalSkills,
        coreSkills: skillBuckets.coreSkills,
        optionalSkills: skillBuckets.optionalSkills,
      },
      skillBucketMetadata: skillBuckets.metadata || null,
      matchedCounts: {
        critical: criticalMatch.matched.length,
        core: coreMatch.matched.length,
        optional: optionalMatch.matched.length,
      },
      missingCriticalCount: criticalMatch.missing.length,
      roleContext: {
        jobRoleFamily: roleContext.jobRoleFamily,
        candidateRoleFamily: roleContext.candidateRoleFamily,
        jobFamilyConfidence: roleContext.jobFamilyConfidence,
        candidateFamilyConfidence: roleContext.candidateFamilyConfidence,
        roleContextAlignment: roleContext.roleContextAlignment,
        roleContextConfidence: roleContext.roleContextConfidence,
        alignmentBand: roleContext.alignmentBand,
        rawAdjustment: roleContext.rawContextAdjustment,
        effectiveAdjustment: round(contextAdjustment, 4),
        adjustmentReason: roleContext.adjustmentReason,
        jobFamilyEvidence: roleContext.jobFamilyEvidence,
        candidateFamilyEvidence: roleContext.candidateFamilyEvidence,
      },
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

