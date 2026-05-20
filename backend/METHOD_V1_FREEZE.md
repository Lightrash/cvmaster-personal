# Candidate Evaluation Method v1.0 Freeze Notes

## Test Status
- Command: `npm --prefix backend test`
- Result: `23/23` tests passed
- Scope:
  - profile scoring
  - vacancy match
  - confidence layer
  - role-context alignment

## Method v1.0 Layers
- Deterministic profile scoring
- Deterministic vacancy match scoring
- Confidence / data quality layer
- Chronology-aware relevant experience
- Explicit bucket precedence over heuristic buckets
- Config-driven skill vocabulary
- Role-context family alignment layer
- Automated backend tests

## Manual Freeze Checklist
1. Review 10-20 real candidate-vacancy pairs.
2. Inspect for each case:
   - `overallScore`
   - `matchPercentage`
   - `recommendation`
   - `scoringMeta.confidence`
   - `scoringMeta.roleContext`
3. Verify sparse CV and sparse vacancy behavior.
4. Verify backend / frontend / fullstack / qa / devops cases.
5. Run `npm --prefix backend test` once more before tagging.
6. Freeze `backend/src/config/method-config.json` together with the method version.

## Config Blocks Most Likely To Calibrate
- `recommendationThresholds`
- `confidenceThresholds`
- `matchWeights`
- `roleContextMatching.adjacency`
- `roleContextMatching.scoring`

## What To Fix Before Freeze Only If Metrics Demand It
- Config values only
- No JS logic changes
- No new scoring layers
- No formula rewrites

## Known Limitations
- Relevant experience is still heuristic for incomplete CVs.
- Sparse vacancy text lowers confidence and may suppress auto-Proceed.
- Mixed-role candidates can produce near-competing role families.
- Role-context alignment is bounded and secondary; it does not override missing critical skills.
- API-level and persistence-level tests are still lighter than method-layer tests.

## Suggested Freeze Commit
- `Freeze candidate evaluation method v1.0`
