const test = require('node:test');
const assert = require('node:assert/strict');
const { computeNeuralMatchScore } = require('../src/services/neuralMatchingService');

const ORIGINAL_PROVIDER = process.env.EMBEDDING_PROVIDER;

test.afterEach(() => {
  if (ORIGINAL_PROVIDER === undefined) {
    delete process.env.EMBEDDING_PROVIDER;
  } else {
    process.env.EMBEDDING_PROVIDER = ORIGINAL_PROVIDER;
  }
});

function useMockEmbeddings() {
  process.env.EMBEDDING_PROVIDER = 'mock';
}

const backendJob = {
  title: 'Senior Backend Engineer',
  description: 'Design APIs, backend platform services, and distributed cloud data systems.',
  requirements: ['Must have Node.js', 'Required TypeScript', 'Mandatory PostgreSQL', 'Mandatory REST API'],
  stack: ['Docker', 'AWS'],
};

test('neural-first: semantically strong match can stay strong with imperfect keyword overlap', async () => {
  useMockEmbeddings();
  const candidate = {
    position: 'Server-side API Engineer',
    summary: 'Builds cloud platform services, APIs, and distributed backend systems.',
    skills: ['Node', 'Postgres', 'REST API', 'Microservices'],
    technologies: ['TypeScript', 'Docker', 'AWS'],
    yearsOfExperience: 5,
    relevantYearsExperience: 4,
    workHistory: [
      {
        title: 'API Engineer',
        startDate: '2022',
        endDate: 'Present',
        description: 'Platform services, server-side APIs, distributed systems, AWS Docker',
      },
    ],
  };

  const result = await computeNeuralMatchScore(candidate, candidate, backendJob);

  assert.ok(result.neuralMatchScore >= 70);
  assert.ok(result.finalMatchScore >= 70);
  assert.equal(result.recommendation, 'Proceed');
  assert.ok(result.neuralBreakdown.semanticSharedConcepts.length > 0);
});

test('neural-first: keyword overlap with weak semantic relevance scores below rule-based match', async () => {
  useMockEmbeddings();
  const candidate = {
    position: 'Frontend Engineer',
    summary: 'Design systems, UI architecture, and frontend platform work.',
    skills: ['Node.js', 'PostgreSQL', 'REST API', 'TypeScript', 'Docker'],
    technologies: ['React', 'CSS', 'Next.js'],
    yearsOfExperience: 5,
    relevantYearsExperience: 5,
    workHistory: [
      {
        title: 'Frontend Engineer',
        startDate: '2020',
        endDate: 'Present',
        description: 'React design systems, UI components, and frontend platform architecture.',
      },
    ],
  };

  const result = await computeNeuralMatchScore(candidate, candidate, backendJob);

  assert.ok(result.ruleBasedMatchScore >= 90);
  assert.ok(result.finalMatchScore < result.ruleBasedMatchScore);
  assert.ok(result.neuralMatchScore < result.ruleBasedMatchScore);
  assert.notEqual(result.recommendation, 'Proceed');
});

test('neural-first: missing critical skill still penalizes a strong neural match', async () => {
  useMockEmbeddings();
  const candidate = {
    position: 'Backend Engineer',
    summary: 'Builds backend APIs, distributed services, and cloud systems.',
    skills: ['Node.js', 'REST API', 'TypeScript', 'Docker', 'AWS'],
    technologies: ['Node', 'TS'],
    yearsOfExperience: 5,
    relevantYearsExperience: 5,
    workHistory: [
      {
        title: 'Backend Developer',
        startDate: '2021',
        endDate: 'Present',
        description: 'Backend APIs, AWS, Docker, TypeScript services',
      },
    ],
  };

  const result = await computeNeuralMatchScore(candidate, candidate, backendJob);

  assert.ok(result.neuralMatchScore >= 70);
  assert.ok(result.missingCriticalSkills.includes('PostgreSQL'));
  assert.ok(result.penaltiesApplied.criticalPenaltyAdjustment < 0);
  assert.ok(result.finalMatchScore < result.neuralMatchScore);
  assert.equal(result.recommendation, 'Review manually');
});

test('neural-first: strong rule-based match but weak semantic context is held back by neural score', async () => {
  useMockEmbeddings();
  const candidate = {
    position: 'Frontend Engineer',
    summary: 'Frontend architect focused on design systems and user interfaces.',
    skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'REST API', 'Docker', 'AWS'],
    technologies: ['React', 'CSS', 'Next.js'],
    yearsOfExperience: 6,
    relevantYearsExperience: 4,
    workHistory: [
      {
        title: 'Frontend Engineer',
        startDate: '2020',
        endDate: 'Present',
        description: 'Led frontend platform, React UI, component architecture, design systems.',
      },
    ],
  };

  const result = await computeNeuralMatchScore(candidate, candidate, backendJob);

  assert.ok(result.ruleBasedMatchScore >= 95);
  assert.ok(result.neuralMatchScore < result.ruleBasedMatchScore);
  assert.ok(result.finalMatchScore < result.ruleBasedMatchScore);
  assert.equal(result.scoringMeta.finalScoreComposition.dominantSource, 'neural');
});

test('neural-first: fullstack candidate stays viable for backend vacancy without oversized penalty', async () => {
  useMockEmbeddings();
  const candidate = {
    position: 'Fullstack Engineer',
    summary: 'Builds frontend and backend product features and APIs.',
    skills: ['Node.js', 'TypeScript', 'React', 'PostgreSQL', 'REST API'],
    technologies: ['Next.js', 'Docker'],
    yearsOfExperience: 5,
    relevantYearsExperience: 4,
    workHistory: [
      {
        title: 'Fullstack Developer',
        startDate: '2021',
        endDate: 'Present',
        description: 'React, Node.js, PostgreSQL APIs and product delivery.',
      },
    ],
  };

  const result = await computeNeuralMatchScore(candidate, candidate, backendJob);

  assert.equal(result.roleContext.candidateRoleFamily, 'fullstack');
  assert.ok(result.penaltiesApplied.roleContextAdjustment >= 0);
  assert.ok(result.finalMatchScore >= 60);
});

test('neural-first: sparse vacancy text lowers confidence and blocks auto-proceed', async () => {
  useMockEmbeddings();
  const candidate = {
    position: 'Backend Engineer',
    summary: 'Builds backend APIs and cloud services.',
    skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'REST API', 'Docker'],
    technologies: ['AWS'],
    yearsOfExperience: 5,
    relevantYearsExperience: 4,
    workHistory: [
      {
        title: 'Backend Engineer',
        startDate: '2021',
        endDate: 'Present',
        description: 'Node.js APIs, PostgreSQL, AWS, Docker',
      },
    ],
  };
  const sparseJob = {
    title: 'Engineer',
    requirements: ['Node.js'],
  };

  const result = await computeNeuralMatchScore(candidate, candidate, sparseJob);

  assert.ok(result.confidence.matchConfidenceScore < 0.5);
  assert.ok(result.confidence.flags.includes('sparseVacancyData'));
  assert.notEqual(result.recommendation, 'Proceed');
});

test('neural-first: high semantic similarity with low confidence stays guarded', async () => {
  useMockEmbeddings();
  const sparseJob = {
    title: 'Backend Engineer',
    description: 'Backend APIs and cloud services',
    requirements: ['Node.js'],
  };
  const candidate = {
    position: 'Backend Engineer',
    summary: 'Backend APIs and cloud services',
    skills: ['Node.js', 'TypeScript', 'PostgreSQL'],
    technologies: ['Docker', 'AWS'],
    yearsOfExperience: 5,
    relevantYearsExperience: 4,
    workHistory: [
      {
        title: 'Backend Engineer',
        startDate: '2021',
        endDate: 'Present',
        description: 'Backend APIs and cloud services',
      },
    ],
  };

  const result = await computeNeuralMatchScore(candidate, candidate, sparseJob);

  assert.ok(result.neuralMatchScore >= 60);
  assert.ok(result.confidence.matchConfidenceScore < 0.6);
  assert.notEqual(result.recommendation, 'Proceed');
});

test('neural-first: backend candidate is held back on frontend-heavy role', async () => {
  useMockEmbeddings();
  const frontendJob = {
    title: 'Senior Frontend Engineer',
    description: 'Build React interfaces, design systems, and client-side product features.',
    requirements: ['Must have React', 'Required Next.js', 'Required TypeScript', 'Mandatory CSS'],
    stack: ['HTML', 'JavaScript'],
  };
  const candidate = {
    position: 'Backend Engineer',
    summary: 'Builds backend APIs, microservices, and data services.',
    skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'REST API', 'Docker'],
    technologies: ['AWS'],
    yearsOfExperience: 6,
    relevantYearsExperience: 5,
    workHistory: [
      {
        title: 'Backend Engineer',
        startDate: '2020',
        endDate: 'Present',
        description: 'Node.js APIs, PostgreSQL, Docker, AWS',
      },
    ],
  };

  const result = await computeNeuralMatchScore(candidate, candidate, frontendJob);

  assert.equal(result.roleContext.jobRoleFamily, 'frontend');
  assert.equal(result.roleContext.candidateRoleFamily, 'backend');
  assert.ok(result.finalMatchScore < 50);
  assert.notEqual(result.recommendation, 'Proceed');
});

test('neural-first: cross-domain recruiter profile is pushed down by domain-mismatch calibration', async () => {
  useMockEmbeddings();
  const frontendJob = {
    title: 'Senior Frontend Developer',
    description: 'Build React interfaces, design systems, and client-side product features.',
    requirements: ['Must have React', 'Required Next.js', 'Required TypeScript', 'Mandatory CSS'],
    stack: ['React', 'Next.js', 'TypeScript', 'CSS', 'HTML'],
  };
  const candidate = {
    position: 'Junior Recruiter',
    summary: 'Screens candidates, coordinates interviews, and manages hiring pipelines.',
    skills: ['communication', 'sourcing', 'screening', 'recruiting'],
    technologies: ['linkedin recruiter', 'google sheets', 'notion'],
    yearsOfExperience: 1,
    relevantYearsExperience: 1,
    workHistory: [
      {
        title: 'Junior Recruiter',
        startDate: '2024',
        endDate: 'Present',
        description: 'Candidate screening, sourcing, interview scheduling, and stakeholder communication.',
      },
    ],
  };

  const result = await computeNeuralMatchScore(candidate, candidate, frontendJob);

  assert.notEqual(result.roleContext.candidateRoleFamily, 'frontend');
  assert.ok(result.penaltiesApplied.domainMismatchAdjustment < 0);
  assert.ok(result.finalMatchScore < result.neuralMatchScore);
  assert.notEqual(result.recommendation, 'Proceed');
});

test('neural-first: obvious recruiter to backend mismatch is numerically suppressed below manual-review high band', async () => {
  useMockEmbeddings();
  const backendJob = {
    title: 'Middle Python Backend Developer',
    description: 'Build backend services, APIs, Python applications, SQL data access, and production integrations.',
    requirements: ['Must have Python', 'Required backend development', 'Required SQL', 'Mandatory REST API'],
    stack: ['Python', 'SQL', 'Docker'],
  };
  const candidate = {
    position: 'Junior Recruiter',
    summary: 'Screens candidates, coordinates interviews, and manages hiring pipelines.',
    skills: ['communication', 'sourcing', 'screening', 'recruiting'],
    technologies: ['linkedin recruiter', 'google sheets', 'notion'],
    yearsOfExperience: 2,
    relevantYearsExperience: 1,
    workHistory: [
      {
        title: 'Junior Recruiter',
        startDate: '2024',
        endDate: 'Present',
        description: 'Candidate screening, sourcing, interview scheduling, and stakeholder communication.',
      },
    ],
  };

  const result = await computeNeuralMatchScore(candidate, candidate, backendJob);

  assert.ok(result.penaltiesApplied.domainMismatchAdjustment < 0);
  assert.ok(result.penaltiesApplied.weakOverlapAdjustment < 0);
  assert.ok(result.finalMatchScore < 50);
  assert.notEqual(result.recommendation, 'Proceed');
});

test('neural-first: embeddings fallback preserves backward compatibility with rule-based final score', async () => {
  process.env.EMBEDDING_PROVIDER = 'unsupported-provider';
  const candidate = {
    position: 'Backend Engineer',
    summary: 'Builds backend APIs and cloud services.',
    skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'REST API'],
    technologies: ['Docker', 'AWS'],
    yearsOfExperience: 5,
    relevantYearsExperience: 4,
  };

  const result = await computeNeuralMatchScore(candidate, candidate, backendJob);

  assert.equal(result.neuralMatchScore, null);
  assert.equal(result.finalMatchScore, result.ruleBasedMatchScore);
  assert.equal(result.matchPercentage, result.ruleBasedMatchScore);
  assert.equal(result.scoringMeta.neuralBreakdown.providerStatus, 'fallback-rule-based');
  assert.ok(result.scoringMeta.neuralBreakdown.providerFlags.includes('embeddingProviderUnavailable'));
});

