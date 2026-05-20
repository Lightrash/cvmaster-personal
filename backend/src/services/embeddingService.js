const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getMethodConfig } = require('./deterministicScoringService');

function toText(value) {
  return String(value || '').trim();
}

function normalize(text = '') {
  return toText(text).toLowerCase();
}

function unique(values = []) {
  return [...new Set(values)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const methodConfig = getMethodConfig();
const DEFAULT_PROVIDER_CONFIG = {
  provider: methodConfig?.neuralMatching?.provider?.provider || 'google',
  model: methodConfig?.neuralMatching?.provider?.model || 'gemini-embedding-001',
  allowFallbackToRuleBased:
    methodConfig?.neuralMatching?.provider?.allowFallbackToRuleBased !== false,
};

const synonymGroups = Array.isArray(methodConfig?.skillMatching?.synonymGroups)
  ? methodConfig.skillMatching.synonymGroups
  : [];
const aliasLookup = new Map();
for (const group of synonymGroups) {
  if (!Array.isArray(group) || !group.length) continue;
  const canonical = normalize(group[0]);
  for (const item of group) {
    aliasLookup.set(normalize(item), canonical);
  }
}

function canonicalToken(token) {
  const normalized = normalize(token).replace(/[^a-z0-9+#.]+/g, ' ').trim();
  return aliasLookup.get(normalized) || normalized;
}

function tokenize(text = '') {
  return unique(
    normalize(text)
      .replace(/[^a-z0-9+#.]+/g, ' ')
      .split(/\s+/)
      .map((token) => canonicalToken(token))
      .filter(Boolean)
  );
}

function hashToken(token, size) {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % size;
}

function buildMockEmbedding(text) {
  const size = 256;
  const vector = new Array(size).fill(0);
  const tokens = tokenize(text);
  tokens.forEach((token, index) => {
    const tokenWeight = 1 + Math.max(0, 0.35 - index * 0.015);
    const forwardIndex = hashToken(token, size);
    const backwardIndex = hashToken(`${token}:alt`, size);
    vector[forwardIndex] += tokenWeight;
    vector[backwardIndex] -= tokenWeight * 0.4;
  });
  return normalizeVector(vector);
}

function normalizeVector(vector = []) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm <= 0) return vector.map(() => 0);
  return vector.map((value) => value / norm);
}

function cosineSimilarity(left = [], right = []) {
  const length = Math.min(left.length, right.length);
  if (!length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < length; i += 1) {
    const a = Number(left[i]) || 0;
    const b = Number(right[i]) || 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (leftNorm <= 0 || rightNorm <= 0) return 0;
  return clamp(dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm)), -1, 1);
}

function similarity01(left = [], right = []) {
  return clamp((cosineSimilarity(left, right) + 1) / 2, 0, 1);
}

function getProviderSettings() {
  const providerFromEnv = toText(process.env.EMBEDDING_PROVIDER).toLowerCase();
  const provider = providerFromEnv || (process.env.AI_MOCK === 'true' ? 'mock' : DEFAULT_PROVIDER_CONFIG.provider) || 'google';
  const model = toText(process.env.EMBEDDING_MODEL || DEFAULT_PROVIDER_CONFIG.model) || 'gemini-embedding-001';
  return {
    provider,
    model,
    allowFallbackToRuleBased: DEFAULT_PROVIDER_CONFIG.allowFallbackToRuleBased,
  };
}

function getGoogleModel(modelName) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error('GEMINI_API_KEY is not set for embeddings');
    error.code = 'EMBEDDING_PROVIDER_UNAVAILABLE';
    throw error;
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: modelName });
}

function isRetryableEmbeddingError(error) {
  const message = toText(error?.message).toLowerCase();
  const status = Number(error?.status || error?.response?.status || error?.code);
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    message.includes('429') ||
    message.includes('quota') ||
    message.includes('resource exhausted') ||
    message.includes('rate limit') ||
    message.includes('temporar') ||
    message.includes('unavailable')
  );
}

async function embedContentWithRetry(model, text) {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await model.embedContent(text);
    } catch (error) {
      if (!isRetryableEmbeddingError(error) || attempt === maxAttempts) {
        throw error;
      }
      const delayMs = 1200 * attempt;
      await sleep(delayMs);
    }
  }
  throw new Error('Embedding retry loop failed unexpectedly');
}

async function embedTexts(texts = []) {
  const settings = getProviderSettings();
  const normalizedTexts = texts.map((text) => toText(text));

  if (settings.provider === 'mock') {
    return {
      provider: 'mock',
      model: 'mock-semantic-hash-v1',
      embeddings: normalizedTexts.map((text) => buildMockEmbedding(text)),
    };
  }

  if (settings.provider !== 'google') {
    const error = new Error(`Unsupported embedding provider: ${settings.provider}`);
    error.code = 'EMBEDDING_PROVIDER_UNSUPPORTED';
    throw error;
  }

  const model = getGoogleModel(settings.model);
  const embeddings = [];
  for (const text of normalizedTexts) {
    const response = await embedContentWithRetry(model, text);
    const values = response?.embedding?.values;
    if (!Array.isArray(values) || !values.length) {
      const error = new Error('Embedding provider returned empty vector');
      error.code = 'EMBEDDING_EMPTY_VECTOR';
      throw error;
    }
    embeddings.push(normalizeVector(values));
  }

  return {
    provider: 'google',
    model: settings.model,
    embeddings,
  };
}

module.exports = {
  embedTexts,
  cosineSimilarity,
  similarity01,
  tokenize,
  getProviderSettings,
};
