const { GoogleGenerativeAI } = require('@google/generative-ai');

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

  return {
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
    summary: `Mock analysis for local development. Candidate looks like a ${level} ${inferPosition(resumeText)} with ${years} year(s) of experience.`,
    education: inferEducation(resumeText),
    languages: inferLanguages(resumeText),
  };
}

function buildMockMatch(analysis, job) {
  const candidate = unique([
    ...(analysis.skills || []),
    ...(analysis.technologies || []),
  ]).map((x) => normalize(String(x)));

  const required = unique([
    ...((job.requirements || []).map((x) => String(x))),
    ...((job.stack || []).map((x) => String(x))),
  ]);

  if (required.length === 0) {
    return {
      matchPercentage: 70,
      strengths: ['Base profile generated from mock mode'],
      gaps: [],
      recommendation: 'Proceed',
    };
  }

  const matched = required.filter((req) => {
    const r = normalize(req);
    return candidate.some((skill) => r.includes(skill) || skill.includes(r));
  });
  const gaps = required.filter((req) => !matched.includes(req));
  const matchPercentage = Math.max(0, Math.min(100, Math.round((matched.length / required.length) * 100)));
  const recommendation = matchPercentage >= 70 ? 'Proceed' : matchPercentage >= 40 ? 'Review manually' : 'Reject';

  return {
    matchPercentage,
    strengths: matched.slice(0, 5),
    gaps: gaps.slice(0, 5),
    recommendation,
  };
}

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in backend .env');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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

  const prompt = `You are an expert HR analyst. Analyze the following resume text and return a JSON object with exactly these fields:
{
  "firstName": "candidate's first name",
  "lastName": "candidate's last name / surname",
  "email": "email if found or empty string",
  "phone": "phone number if found or empty string",
  "position": "candidate's most likely job title/role",
  "linkedin": "LinkedIn URL if found or empty string",
  "skills": ["list of key hard skills found"],
  "level": "Junior" | "Middle" | "Senior",
  "yearsOfExperience": number,
  "technologies": ["list of technologies/tools/frameworks mentioned"],
  "softSkills": ["list of soft skills if found"],
  "overallScore": number between 1 and 10,
  "summary": "3-5 sentence profile summary in English",
  "education": "highest education degree and institution if found",
  "languages": ["list of languages the candidate knows"]
}

Rules:
- Return ONLY valid JSON, no markdown, no code blocks, no extra text
- yearsOfExperience should be a number (integer)
- overallScore should be a number between 1 and 10
- level should be exactly one of: "Junior", "Middle", "Senior"
- firstName and lastName MUST be extracted from the resume - these are critical
- position should be the candidate's current or most recent role
- If you can't determine something, make your best estimate based on context
- For empty/unknown string fields use ""
- For empty/unknown array fields use []

Resume text:
${resumeText}`;

  return callModelAndParse(prompt);
}

async function matchResumeToJob(analysis, job) {
  if (shouldUseMock()) {
    return buildMockMatch(analysis, job);
  }

  const prompt = `You are an expert HR matching system. Compare the candidate's resume analysis with the job requirements and return a JSON object with exactly these fields:
{
  "matchPercentage": number between 0 and 100,
  "strengths": ["list of candidate's strong points that match the job"],
  "gaps": ["list of requirements the candidate doesn't meet"],
  "recommendation": "Proceed" | "Review manually" | "Reject"
}

Rules:
- Return ONLY valid JSON, no markdown, no code blocks, no extra text
- matchPercentage should be a realistic number
- recommendation: "Proceed" if match >= 70%, "Review manually" if 40-69%, "Reject" if < 40%
- Be specific in strengths and gaps

Candidate Analysis:
${JSON.stringify(analysis, null, 2)}

Job Details:
Title: ${job.title}
Department: ${job.department}
Description: ${job.description || 'N/A'}
Requirements: ${(job.requirements || []).join(', ') || 'N/A'}
Tech Stack: ${(job.stack || []).join(', ') || 'N/A'}`;

  return callModelAndParse(prompt);
}

module.exports = { analyzeResumeText, matchResumeToJob };
