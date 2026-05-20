const test = require('node:test');
const assert = require('node:assert/strict');
const { computeDeterministicMatch } = require('../src/services/deterministicScoringService');
const {
  strongProfile,
  weakHardSoftProfile,
  heuristicYearsProfile,
  strongJob,
  partialJob,
  explicitOnlyJob,
} = require('./fixtures');

test('vacancy match: strong match returns Proceed with no missing critical skills', () => {
  const result = computeDeterministicMatch(strongProfile, strongJob);

  assert.ok(result.matchPercentage >= 90);
  assert.equal(result.recommendation, 'Proceed');
  assert.deepEqual(result.missingCriticalSkills, []);
});

test('vacancy match: partial match stays in manual review band', () => {
  const candidate = {
    position: 'Backend Developer',
    skills: ['Node.js', 'JavaScript'],
    technologies: ['Docker'],
    yearsOfExperience: 2,
    relevantYearsExperience: 1.5,
    summary: 'Node backend developer',
    workHistory: [
      {
        title: 'Backend Developer',
        startDate: '2023',
        endDate: 'Present',
        description: 'Node.js Docker APIs',
      },
    ],
  };
  const result = computeDeterministicMatch(candidate, partialJob);

  assert.ok(result.matchPercentage >= 40 && result.matchPercentage < 70);
  assert.equal(result.recommendation, 'Review manually');
  assert.ok(result.missingCriticalSkills.includes('PostgreSQL'));
});

test('vacancy match: weak match is rejected', () => {
  const result = computeDeterministicMatch(weakHardSoftProfile, strongJob);

  assert.ok(result.matchPercentage < 40);
  assert.equal(result.recommendation, 'Reject');
});

test('vacancy match: missing critical skills are surfaced explicitly', () => {
  const result = computeDeterministicMatch(weakHardSoftProfile, strongJob);

  assert.ok(result.missingCriticalSkills.length >= 3);
  assert.ok(result.scoringMeta.missingCriticalCount >= 3);
});

test('vacancy match: explicit buckets take precedence over heuristic parsing', () => {
  const candidate = {
    skills: ['Node.js', 'TypeScript', 'Redis', 'PostgreSQL'],
    technologies: ['Node'],
    yearsOfExperience: 4,
    relevantYearsExperience: 4,
  };
  const result = computeDeterministicMatch(candidate, explicitOnlyJob);

  assert.equal(result.scoringMeta.skillBucketsSource, 'explicit');
  assert.equal(result.scoringMeta.bucketBuildMode, 'explicit-only');
  assert.deepEqual(result.scoringMeta.skillBuckets.criticalSkills, ['Node.js']);
  assert.deepEqual(result.scoringMeta.skillBuckets.coreSkills, ['TypeScript']);
  assert.deepEqual(result.scoringMeta.skillBuckets.optionalSkills, ['Redis']);
});

test('vacancy match: synonym match is reported with source metadata', () => {
  const result = computeDeterministicMatch(
    {
      skills: ['Node'],
      technologies: ['Postgres'],
      yearsOfExperience: 4,
      relevantYearsExperience: 4,
    },
    {
      title: 'Backend Engineer',
      requirements: ['Required PostgreSQL'],
      stack: ['Node.js'],
    }
  );

  const postgresMatch = result.skillMatchBreakdown.find((item) => item.requiredSkill === 'PostgreSQL');
  assert.equal(postgresMatch.tier, 'synonym');
  assert.equal(postgresMatch.matchSource, 'synonym-group');
  assert.equal(postgresMatch.matchedCanonical, 'postgresql');
});

test('vacancy match: related-group match uses related tier', () => {
  const result = computeDeterministicMatch(heuristicYearsProfile, strongJob);

  const relatedMatch = result.skillMatchBreakdown.find((item) => item.requiredSkill === 'Redis');
  assert.equal(relatedMatch.tier, 'related');
  assert.equal(relatedMatch.matchSource, 'related-group');
  assert.equal(relatedMatch.matchedTierScore, 0.5);
});

test('vacancy match: token-overlap match uses discounted related score', () => {
  const result = computeDeterministicMatch(
    {
      skills: ['JavaScript', 'Node', 'REST API'],
      technologies: ['Postgres', 'Docker'],
      yearsOfExperience: 4,
      relevantYearsExperience: 4,
      summary: 'Backend engineer building REST services',
      workHistory: [
        {
          title: 'Node.js Developer',
          startDate: '2022',
          endDate: 'Present',
          description: 'Built REST APIs with Node.js and PostgreSQL',
        },
      ],
    },
    {
      title: 'Backend Developer',
      requirements: ['Experience with REST services'],
      stack: ['Node.js'],
    }
  );

  const tokenOverlapMatch = result.skillMatchBreakdown.find((item) => item.requiredSkill === 'REST services');
  assert.equal(tokenOverlapMatch.tier, 'related');
  assert.equal(tokenOverlapMatch.matchSource, 'token-overlap');
  assert.ok(tokenOverlapMatch.matchedTierScore < 0.5);
});
