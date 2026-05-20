const test = require('node:test');
const assert = require('node:assert/strict');
const { computeDeterministicMatch } = require('../src/services/deterministicScoringService');

const backendHeavyJob = {
  title: 'Senior Backend Engineer',
  requirements: [
    'Must have Node.js',
    'Required TypeScript',
    'Mandatory PostgreSQL',
    'Mandatory REST API',
  ],
  stack: ['Docker', 'AWS'],
};

const backendCandidate = {
  position: 'Backend Engineer',
  summary: 'Backend engineer building APIs and microservices',
  skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'REST API', 'Docker'],
  technologies: ['AWS', 'Redis'],
  yearsOfExperience: 5,
  relevantYearsExperience: 4,
  workHistory: [
    {
      title: 'Backend Developer',
      startDate: '2021',
      endDate: 'Present',
      description: 'Node.js TypeScript PostgreSQL microservices APIs',
    },
  ],
};

const frontendCandidate = {
  position: 'Frontend Engineer',
  summary: 'Frontend developer building React interfaces',
  skills: ['React', 'TypeScript', 'CSS', 'HTML', 'Next.js'],
  technologies: ['JavaScript'],
  yearsOfExperience: 5,
  relevantYearsExperience: 4,
  workHistory: [
    {
      title: 'Frontend Engineer',
      startDate: '2021',
      endDate: 'Present',
      description: 'React Next.js UI SPA',
    },
  ],
};

const fullstackCandidate = {
  position: 'Fullstack Engineer',
  summary: 'Builds frontend and backend features',
  skills: ['Node.js', 'TypeScript', 'React', 'PostgreSQL', 'REST API'],
  technologies: ['Next.js', 'Docker'],
  yearsOfExperience: 5,
  relevantYearsExperience: 4,
  workHistory: [
    {
      title: 'Fullstack Developer',
      startDate: '2021',
      endDate: 'Present',
      description: 'React Node.js PostgreSQL APIs',
    },
  ],
};

const devopsCandidate = {
  position: 'DevOps Engineer',
  summary: 'Infrastructure automation and cloud operations',
  skills: ['Docker', 'Kubernetes', 'Terraform', 'AWS', 'CI/CD'],
  technologies: ['GCP'],
  yearsOfExperience: 5,
  relevantYearsExperience: 4,
  workHistory: [
    {
      title: 'DevOps Engineer',
      startDate: '2021',
      endDate: 'Present',
      description: 'AWS Kubernetes Terraform CI/CD',
    },
  ],
};

const qaCandidate = {
  position: 'QA Automation Engineer',
  summary: 'Builds automated tests',
  skills: ['Playwright', 'Cypress', 'Testing', 'JavaScript'],
  technologies: ['QA'],
  yearsOfExperience: 5,
  relevantYearsExperience: 4,
  workHistory: [
    {
      title: 'QA Automation Engineer',
      startDate: '2021',
      endDate: 'Present',
      description: 'Playwright Cypress test automation',
    },
  ],
};

test('role context: backend candidate to backend job gets positive alignment adjustment', () => {
  const result = computeDeterministicMatch(backendCandidate, backendHeavyJob);
  const roleContext = result.scoringMeta.roleContext;

  assert.equal(roleContext.jobRoleFamily, 'backend');
  assert.equal(roleContext.candidateRoleFamily, 'backend');
  assert.equal(roleContext.alignmentBand, 'strong');
  assert.ok(roleContext.effectiveAdjustment > 0);
});

test('role context: frontend candidate to backend job gets negative adjustment', () => {
  const result = computeDeterministicMatch(frontendCandidate, backendHeavyJob);
  const roleContext = result.scoringMeta.roleContext;

  assert.equal(roleContext.jobRoleFamily, 'backend');
  assert.equal(roleContext.candidateRoleFamily, 'frontend');
  assert.ok(roleContext.effectiveAdjustment < 0);
});

test('role context: fullstack candidate stays mildly positive for backend job', () => {
  const backendResult = computeDeterministicMatch(backendCandidate, backendHeavyJob);
  const fullstackResult = computeDeterministicMatch(fullstackCandidate, backendHeavyJob);

  assert.equal(fullstackResult.scoringMeta.roleContext.candidateRoleFamily, 'fullstack');
  assert.ok(fullstackResult.scoringMeta.roleContext.effectiveAdjustment > 0);
  assert.ok(
    fullstackResult.scoringMeta.roleContext.effectiveAdjustment <
      backendResult.scoringMeta.roleContext.effectiveAdjustment
  );
});

test('role context: devops candidate with infra-only stack does not get positive boost for backend-heavy job', () => {
  const result = computeDeterministicMatch(devopsCandidate, backendHeavyJob);

  assert.equal(result.scoringMeta.roleContext.candidateRoleFamily, 'devops');
  assert.ok(result.scoringMeta.roleContext.effectiveAdjustment <= 0);
});

test('role context: QA candidate to backend job is treated as weak alignment', () => {
  const result = computeDeterministicMatch(qaCandidate, backendHeavyJob);
  const roleContext = result.scoringMeta.roleContext;

  assert.equal(roleContext.candidateRoleFamily, 'qa');
  assert.equal(roleContext.alignmentBand, 'weak');
  assert.ok(roleContext.effectiveAdjustment <= 0);
});

test('role context: sparse job yields lower family confidence and bounded adjustment', () => {
  const sparseJob = {
    title: 'Engineer',
    requirements: ['Node.js'],
  };
  const result = computeDeterministicMatch(backendCandidate, sparseJob);
  const roleContext = result.scoringMeta.roleContext;

  assert.ok(roleContext.jobFamilyConfidence < 0.5);
  assert.ok(Math.abs(roleContext.effectiveAdjustment) < 0.05);
});

test('role context: generic or unknown families stay near neutral', () => {
  const genericJob = {
    title: 'Software Engineer',
    requirements: ['Collaborate with team'],
    stack: [],
  };
  const result = computeDeterministicMatch({ position: 'Specialist' }, genericJob);
  const roleContext = result.scoringMeta.roleContext;

  assert.ok(['generic', 'unknown'].includes(roleContext.jobRoleFamily));
  assert.ok(['generic', 'unknown'].includes(roleContext.candidateRoleFamily));
  assert.ok(Math.abs(roleContext.effectiveAdjustment) <= 0.015);
});
