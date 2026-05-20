const test = require('node:test');
const assert = require('node:assert/strict');
const { applyDeterministicProfileScoring, computeDeterministicMatch } = require('../src/services/deterministicScoringService');
const { strongProfile, sparseJob } = require('./fixtures');

test('confidence: sparse candidate data lowers profile confidence and sets flags', () => {
  const result = applyDeterministicProfileScoring({ position: 'Candidate' });

  assert.ok(result.scoringMeta.confidence.profileConfidenceScore < 0.45);
  assert.ok(result.scoringMeta.confidence.flags.includes('sparseCandidateData'));
  assert.ok(result.scoringMeta.confidence.flags.includes('weakSkillEvidence'));
});

test('confidence: sparse vacancy data lowers match confidence and sets vacancy flags', () => {
  const result = computeDeterministicMatch(
    {
      skills: ['Node.js'],
      yearsOfExperience: 5,
      relevantYearsExperience: 5,
    },
    sparseJob
  );

  assert.ok(result.scoringMeta.confidence.matchConfidenceScore < 0.5);
  assert.ok(result.scoringMeta.confidence.flags.includes('sparseVacancyData'));
  assert.ok(result.scoringMeta.confidence.flags.includes('weakRequirementsText'));
});

test('confidence: low confidence downgrades Proceed to Review manually', () => {
  const result = computeDeterministicMatch(strongProfile, sparseJob);

  assert.ok(result.matchPercentage >= 70);
  assert.equal(result.recommendation, 'Review manually');
  assert.ok(result.scoringMeta.confidence.matchConfidenceScore < result.scoringMeta.confidenceThresholds.proceedDowngradeThreshold);
});

test('confidence: strong score but low confidence case is visible in metadata and gaps', () => {
  const result = computeDeterministicMatch(strongProfile, sparseJob);

  assert.ok(result.matchPercentage >= 90);
  assert.ok(result.scoringMeta.confidence.reasons.length > 0);
  assert.ok(result.gaps.includes('Низька впевненість системи не дозволяє автоматично рекомендувати кандидата'));
});
