const { GoogleGenerativeAI } = require('@google/generative-ai');
const {
  applyDeterministicProfileScoring,
  computeDeterministicMatch,
} = require('./deterministicScoringService');
const { computeNeuralMatchScore } = require('./neuralMatchingService');
const { debugMethodLog } = require('./methodDebugService');

// Набори ключових слів для локальних евристик (mock/fallback).
const TECH_KEYWORDS = [
  'javascript', 'typescript', 'node.js', 'node', 'react', 'vue', 'angular',
  'next.js', 'express', 'nestjs', 'python', 'java', 'c#', 'php', 'go', 'rust',
  'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'docker', 'kubernetes',
  'aws', 'azure', 'gcp', 'git', 'graphql', 'rest', 'html', 'css', 'tailwind',
];

const SOFT_SKILLS_KEYWORDS = [
  'communication', 'teamwork', 'leadership', 'mentoring', 'problem solving',
  'time management', 'adaptability', 'critical thinking',
];

function shouldUseMock() {
  if (process.env.AI_MOCK === 'true') return true;
  return false;
}

function shouldFallbackOnQuota() {
  return process.env.AI_FALLBACK_ON_QUOTA !== 'false';
}

function shouldUseDeterministicMatch() {
  // LLM mode for match is now used only for optional strengths/gaps explanations.
  return process.env.MATCH_METHOD_MODE !== 'llm';
}

function parseRetrySeconds(errorText = '') {
  const direct = errorText.match(/retry in\s+([\d.]+)s/i);
  if (direct) return Math.ceil(Number(direct[1]));

  const rpc = errorText.match(/"retryDelay":"(\d+)s"/i);
  if (rpc) return Number(rpc[1]);

  return null;
}

function isQuotaError(error) {
  const text = String(error?.message || error || '').toLowerCase();
  return (
    text.includes('429') &&
    (text.includes('quota') ||
      text.includes('rate limit') ||
      text.includes('too many requests') ||
      text.includes('generate_content_free_tier_requests'))
  );
}

function buildQuotaError(error, action) {
  const retrySeconds = parseRetrySeconds(String(error?.message || error || ''));
  const suffix = retrySeconds
    ? ` Повторіть спробу приблизно через ${retrySeconds} с.`
    : ' Повторіть пізніше або увімкніть AI_MOCK=true для локальної розробки.';
  const friendly = `Вичерпано ліміт AI під час дії: ${action}.${suffix}`;
  const wrapped = new Error(friendly);
  wrapped.statusCode = 429;
  wrapped.code = 'AI_QUOTA_EXCEEDED';
  wrapped.retryAfterSeconds = retrySeconds || undefined;
  wrapped.originalMessage = String(error?.message || error || '');
  return wrapped;
}

function unique(values) {
  return [...new Set(values)];
}

function normalize(text = '') {
  return text.toLowerCase();
}

function pickFirstNonEmptyLine(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines[0] || '';
}

function extractName(text) {
  const firstLine = pickFirstNonEmptyLine(text);
  const cleaned = firstLine.replace(/[^\p{L}\s'-]/gu, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { firstName: parts[0], lastName: parts[1] };
  }
  return { firstName: 'Unknown', lastName: 'Candidate' };
}

function extractEmail(text) {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : '';
}

function extractPhone(text) {
  const match = text.match(/(\+?\d[\d\s().-]{7,}\d)/);
  return match ? match[1].trim() : '';
}

function extractLinkedIn(text) {
  const match = text.match(/https?:\/\/(www\.)?linkedin\.com\/[^\s]+/i);
  return match ? match[0] : '';
}

function extractYearsOfExperience(text) {
  const match = text.match(/(\d{1,2})\+?\s*(years|year|рок|років|рік)/i);
  return match ? Number(match[1]) : 1;
}

function findKeywords(text, sourceKeywords) {
  const haystack = normalize(text);
  return unique(sourceKeywords.filter((k) => haystack.includes(k)));
}

function inferLevel(years) {
  if (years >= 5) return 'Senior';
  if (years >= 2) return 'Middle';
  return 'Junior';
}

function inferPosition(text) {
  const t = normalize(text);
  if (t.includes('frontend')) return 'Frontend Developer';
  if (t.includes('backend')) return 'Backend Developer';
  if (t.includes('fullstack') || t.includes('full-stack')) return 'Fullstack Developer';
  if (t.includes('qa')) return 'QA Engineer';
  if (t.includes('devops')) return 'DevOps Engineer';
  return 'Software Engineer';
}

function inferLanguages(text) {
  const t = normalize(text);
  const langs = [];
  if (t.includes('english')) langs.push('English');
  if (t.includes('ukrainian') || t.includes('україн')) langs.push('Ukrainian');
  if (t.includes('polish')) langs.push('Polish');
  if (t.includes('german')) langs.push('German');
  return langs;
}

function inferEducation(text) {
  const t = normalize(text);
  if (t.includes('master')) return "Master's degree";
  if (t.includes('bachelor')) return "Bachelor's degree";
  return '';
}

function buildMockAnalysis(resumeText) {
  const { firstName, lastName } = extractName(resumeText);
  const years = extractYearsOfExperience(resumeText);
  const technologies = findKeywords(resumeText, TECH_KEYWORDS);
  const softSkills = findKeywords(resumeText, SOFT_SKILLS_KEYWORDS);
  const level = inferLevel(years);

  // Навіть у mock-режимі фінальний бал рахуємо через єдину детерміновану формулу.
  return applyDeterministicProfileScoring({
    firstName,
    lastName,
    email: extractEmail(resumeText),
    phone: extractPhone(resumeText),
    position: inferPosition(resumeText),
    linkedin: extractLinkedIn(resumeText),
    skills: technologies.slice(0, 8),
    level,
    yearsOfExperience: years,
    technologies,
    softSkills,
    overallScore: level === 'Senior' ? 8 : level === 'Middle' ? 7 : 6,
    summary: `Тестовий аналіз для локальної розробки. Кандидат виглядає як ${level} ${inferPosition(resumeText)} з досвідом близько ${years} р.`,
    education: inferEducation(resumeText),
    languages: inferLanguages(resumeText),
  });
}

function buildMockMatch(analysis, job) {
  const deterministic = computeDeterministicMatch(analysis, job);
  return {
    ...deterministic,
    strengths: unique([...(deterministic.strengths || []), 'Тестовий режим: використано локальне детерміноване оцінювання']).slice(0, 5),
  };
}

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('У backend/.env не задано GEMINI_API_KEY');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0,
      topP: 0.1,
      topK: 1,
      candidateCount: 1,
      responseMimeType: 'application/json',
    },
  });
}

async function callModelAndParse(prompt) {
  const model = getModel();
  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  return JSON.parse(cleaned);
}

async function analyzeResumeText(resumeText) {
  if (shouldUseMock()) {
    return buildMockAnalysis(resumeText);
  }

  const prompt = `Ти досвідчений HR-аналітик. Проаналізуй текст резюме та поверни JSON-об'єкт РІВНО з такими полями:
{
  "firstName": "ім'я кандидата",
  "lastName": "прізвище кандидата",
  "email": "email, якщо знайдено, інакше порожній рядок",
  "phone": "номер телефону, якщо знайдено, інакше порожній рядок",
  "position": "найімовірніша поточна або остання посада кандидата",
  "linkedin": "посилання на LinkedIn, якщо знайдено, інакше порожній рядок",
  "skills": ["список ключових hard skills"],
  "level": "Junior" | "Middle" | "Senior",
  "yearsOfExperience": number,
  "technologies": ["список технологій, інструментів і фреймворків"],
  "softSkills": ["список soft skills, якщо знайдено"],
  "overallScore": number between 1 and 10,
  "summary": "короткий опис профілю кандидата на 3-5 речень ОБОВ'ЯЗКОВО українською мовою",
  "education": "найвищий рівень освіти та заклад, якщо знайдено",
  "languages": ["список мов, якими володіє кандидат"]
}

Правила:
- Поверни ТІЛЬКИ валідний JSON, без markdown, без code blocks, без зайвого тексту
- yearsOfExperience має бути числом (integer)
- overallScore має бути числом від 1 до 10
- level має бути рівно одним із: "Junior", "Middle", "Senior"
- firstName і lastName ОБОВ'ЯЗКОВО потрібно витягнути з резюме
- position має означати поточну або останню роль кандидата
- Якщо щось неможливо визначити точно, дай найкращу оцінку за контекстом
- Для порожніх/невідомих рядкових полів використовуй ""
- Для порожніх/невідомих масивів використовуй []
- summary має бути природною українською мовою, без англійських речень, якщо це не частина назви технології чи посади

Текст резюме:
${resumeText}`;

  try {
    const llmResult = await callModelAndParse(prompt);
    // LLM витягує структуру, але фінальний score/level перераховуємо локально.
    debugMethodLog('resume-analysis.structured', {
      yearsOfExperience: llmResult?.yearsOfExperience ?? null,
      level: llmResult?.level ?? null,
      skills: Array.isArray(llmResult?.skills) ? llmResult.skills : [],
      technologies: Array.isArray(llmResult?.technologies) ? llmResult.technologies : [],
      summary: typeof llmResult?.summary === 'string' ? llmResult.summary : '',
      structuredAnalysis: llmResult,
    });
    const scored = applyDeterministicProfileScoring(llmResult);
    debugMethodLog('resume-analysis.scored', {
      yearsOfExperience: scored?.yearsOfExperience ?? null,
      generalYearsExperience: scored?.generalYearsExperience ?? null,
      relevantYearsExperience: scored?.relevantYearsExperience ?? null,
      level: scored?.level ?? null,
      skills: Array.isArray(scored?.skills) ? scored.skills : [],
      technologies: Array.isArray(scored?.technologies) ? scored.technologies : [],
      overallScore: scored?.overallScore ?? null,
    });
    return scored;
  } catch (error) {
    if (isQuotaError(error) && shouldFallbackOnQuota()) {
      const fallback = buildMockAnalysis(resumeText);
      fallback.summary = `${fallback.summary} (Резервний режим: ліміт AI вичерпано)`;
      return fallback;
    }
    if (isQuotaError(error)) {
      throw buildQuotaError(error, 'проаналізувати резюме');
    }
    throw error;
  }
}

async function matchResumeToJob(analysis, job) {
  // Neural-first match: embeddings-based semantic similarity is primary,
  // deterministic rules stay as bounded validation/penalty/explanation layer.
  const neuralFirstMatch = await computeNeuralMatchScore(analysis, analysis, job);
  if (shouldUseMock() || shouldUseDeterministicMatch()) {
    return neuralFirstMatch;
  }

  const prompt = `Ти система HR-оцінювання відповідності. Порівняй аналіз резюме кандидата з вимогами вакансії та поверни JSON-об'єкт РІВНО з такими полями:
{
  "matchPercentage": number between 0 and 100,
  "strengths": ["список сильних сторін кандидата щодо цієї вакансії, українською"],
  "gaps": ["список основних прогалин або невідповідностей, українською"],
  "recommendation": "Proceed" | "Review manually" | "Reject"
}

Правила:
- Поверни ТІЛЬКИ валідний JSON, без markdown, без code blocks, без зайвого тексту
- matchPercentage має бути реалістичним числом
- recommendation: "Proceed" якщо match >= 70%, "Review manually" якщо 40-69%, "Reject" якщо < 40%
- strengths і gaps мають бути конкретними та ОБОВ'ЯЗКОВО українською мовою

Аналіз кандидата:
${JSON.stringify(analysis, null, 2)}

Дані вакансії:
Title: ${job.title}
Department: ${job.department}
Description: ${job.description || 'N/A'}
Requirements: ${(job.requirements || []).join(', ') || 'N/A'}
Tech Stack: ${(job.stack || []).join(', ') || 'N/A'}`;

  try {
    const llmMatch = await callModelAndParse(prompt);
    // Якщо увімкнено LLM-режим, беремо від LLM лише текстові пояснення (strengths/gaps).
    // Підсумкові numeric scores залишаються neural-first.
    return {
      ...neuralFirstMatch,
      strengths: Array.isArray(llmMatch?.strengths) && llmMatch.strengths.length
        ? llmMatch.strengths.slice(0, 5).map((x) => String(x))
        : neuralFirstMatch.strengths,
      gaps: Array.isArray(llmMatch?.gaps) && llmMatch.gaps.length
        ? llmMatch.gaps.slice(0, 5).map((x) => String(x))
        : neuralFirstMatch.gaps,
    };
  } catch (error) {
    if (isQuotaError(error) && shouldFallbackOnQuota()) {
      const fallback = {
        ...neuralFirstMatch,
      };
      fallback.strengths = [
        ...(fallback.strengths || []),
        'Резервний режим: ліміт AI вичерпано',
      ].slice(0, 5);
      return fallback;
    }
    if (isQuotaError(error)) {
      throw buildQuotaError(error, 'оцінити відповідність кандидата вакансії');
    }
    throw error;
  }
}

module.exports = { analyzeResumeText, matchResumeToJob };
