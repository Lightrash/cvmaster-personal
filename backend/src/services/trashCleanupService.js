const Candidate = require('../models/Candidate');
const CV = require('../models/CV');

const DEFAULT_TRASH_RETENTION_DAYS = 60;
const DEFAULT_CLEANUP_INTERVAL_MINUTES = 60;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function getTrashRetentionDays() {
  return parsePositiveInt(process.env.TRASH_RETENTION_DAYS, DEFAULT_TRASH_RETENTION_DAYS);
}

function getCleanupIntervalMs() {
  const minutes = parsePositiveInt(
    process.env.TRASH_CLEANUP_INTERVAL_MINUTES,
    DEFAULT_CLEANUP_INTERVAL_MINUTES
  );
  return minutes * 60 * 1000;
}

function buildTrashDeleteAfter(baseDate = new Date()) {
  const days = getTrashRetentionDays();
  return new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
}

async function purgeExpiredRejectedCandidates() {
  const now = new Date();
  const expired = await Candidate.find({
    status: 'Rejected',
    trashDeleteAfter: { $lte: now },
  }).select('_id cv_id');

  if (!expired.length) {
    return { deletedCandidates: 0, deletedCvs: 0 };
  }

  const candidateIds = expired.map((candidate) => candidate._id);
  const rawCvIds = expired
    .map((candidate) => candidate.cv_id)
    .filter(Boolean)
    .map((cvId) => String(cvId));

  let deletedCvs = 0;
  if (rawCvIds.length) {
    const stillUsedCvIds = await Candidate.distinct('cv_id', {
      _id: { $nin: candidateIds },
      cv_id: { $in: rawCvIds },
    });
    const stillUsed = new Set(stillUsedCvIds.map(String));
    const removableCvIds = rawCvIds.filter((cvId) => !stillUsed.has(cvId));

    if (removableCvIds.length) {
      const cvResult = await CV.deleteMany({ _id: { $in: removableCvIds } });
      deletedCvs = cvResult.deletedCount || 0;
    }
  }

  const candidateResult = await Candidate.deleteMany({ _id: { $in: candidateIds } });

  return {
    deletedCandidates: candidateResult.deletedCount || 0,
    deletedCvs,
  };
}

async function backfillTrashMetadataForRejectedCandidates() {
  const legacyCandidates = await Candidate.find({
    status: 'Rejected',
    $or: [{ rejectedAt: null }, { trashDeleteAfter: null }],
  });

  if (!legacyCandidates.length) {
    return 0;
  }

  await Promise.all(
    legacyCandidates.map(async (candidate) => {
      const baseDate = candidate.rejectedAt || candidate.updatedAt || candidate.createdAt || new Date();
      candidate.rejectedAt = baseDate;
      candidate.trashDeleteAfter = buildTrashDeleteAfter(baseDate);
      await candidate.save();
    })
  );

  return legacyCandidates.length;
}

function startTrashCleanupScheduler() {
  const intervalMs = getCleanupIntervalMs();
  const retentionDays = getTrashRetentionDays();

  const runCleanup = async () => {
    try {
      const backfilled = await backfillTrashMetadataForRejectedCandidates();
      const result = await purgeExpiredRejectedCandidates();
      if (backfilled > 0 || result.deletedCandidates > 0 || result.deletedCvs > 0) {
        console.log(
          `[trash-cleanup] backfilled ${backfilled}, deleted ${result.deletedCandidates} candidates and ${result.deletedCvs} CV records`
        );
      }
    } catch (error) {
      console.error(`[trash-cleanup] failed: ${error.message}`);
    }
  };

  console.log(
    `[trash-cleanup] enabled (retention=${retentionDays} days, interval=${Math.round(intervalMs / 60000)} min)`
  );

  void runCleanup();
  return setInterval(runCleanup, intervalMs);
}

module.exports = {
  backfillTrashMetadataForRejectedCandidates,
  buildTrashDeleteAfter,
  getTrashRetentionDays,
  purgeExpiredRejectedCandidates,
  startTrashCleanupScheduler,
};
