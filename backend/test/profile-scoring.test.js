const test = require('node:test');
const assert = require('node:assert/strict');
const { applyDeterministicProfileScoring } = require('../src/services/deterministicScoringService');
const {
  strongProfile,
  noisyProfile,
  weakHardSoftProfile,
  heuristicYearsProfile,
  explicitYearsProfile,
} = require('./fixtures');

test('profile scoring: strong hard-skill profile gets high score and strong confidence', () => {
  const result = applyDeterministicProfileScoring(strongProfile);

  assert.ok(result.overallScore >= 7);
  assert.ok(result.scoringMeta.confidence.profileConfidenceScore >= 0.9);
  assert.ok(result.scoringMeta.breakdown.components.hardSkillsScore >= 8);
  assert.equal(result.relevantYearsExperience, 5);
});

test('profile scoring: many noisy skills are damped by diminishing returns', () => {
  const result = applyDeterministicProfileScoring(noisyProfile);
  const hardMeta = result.scoringMeta.breakdown.skillDetails.hardSkills;

  assert.ok(hardMeta.rawHardSkillCount >= 15);
  assert.ok(hardMeta.effectiveHardSkillCount < hardMeta.rawHardSkillCount);
  assert.ok(hardMeta.cappedScore < 7);
  assert.ok(result.overallScore <= 5);
});

test('profile scoring: soft skills cannot overinflate weak hard profile', () => {
  const result = applyDeterministicProfileScoring(weakHardSoftProfile);
  const hardMeta = result.scoringMeta.breakdown.skillDetails.hardSkills;
  const softMeta = result.scoringMeta.breakdown.skillDetails.softSkills;

  assert.ok(hardMeta.cappedScore < 2);
  assert.ok(softMeta.capApplied);
  assert.ok(softMeta.cappedScore <= softMeta.softSkillCap);
  assert.ok(result.overallScore <= 3);
});

test('profile scoring: heuristic and explicit relevant years are distinguished', () => {
  const heuristic = applyDeterministicProfileScoring(heuristicYearsProfile);
  const explicit = applyDeterministicProfileScoring(explicitYearsProfile);

  assert.equal(heuristic.scoringMeta.breakdown.experience.relevantYearsSource, 'heuristic-date-based');
  assert.equal(explicit.scoringMeta.breakdown.experience.relevantYearsSource, 'explicit');
  assert.ok(heuristic.scoringMeta.confidence.flags.includes('heuristicRelevantYears'));
  assert.ok(!explicit.scoringMeta.confidence.flags.includes('heuristicRelevantYears'));
  assert.equal(explicit.relevantYearsExperience, 3);
});

test('profile scoring: ambiguous junior evidence stays conservative on level classification', () => {
  const result = applyDeterministicProfileScoring({
    position: 'Junior Developer',
    summary: 'Entry-level developer helping with bug fixes and support tasks.',
    skills: ['HTML', 'CSS'],
    technologies: ['Git'],
    yearsOfExperience: 2,
    workHistory: [
      {
        title: 'Junior Developer',
        startDate: '2024',
        endDate: 'Present',
        description: 'Assisted senior developers with simple fixes and QA support.',
      },
    ],
  });

  assert.equal(result.level, 'Junior');
  assert.ok(result.yearsOfExperience >= 2);
});
