const express = require('express');
const mongoose = require('mongoose');
const Candidate = require('../models/Candidate');
const CandidateStatus = require('../models/CandidateStatus');
const CV = require('../models/CV');
const Vacancy = require('../models/Vacancy');
const {
  backfillTrashMetadataForRejectedCandidates,
  buildTrashDeleteAfter,
  getTrashRetentionDays,
  purgeExpiredRejectedCandidates,
} = require('../services/trashCleanupService');

const router = express.Router();

const BOARD_STATUSES = new Set(['New', 'Screening', 'Interview', 'Test Task', 'Offer', 'Hired', 'Rejected']);

function sanitizeText(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function sanitizeNumber(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function sanitizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeEmail(value) {
  return sanitizeText(value).toLowerCase();
}

function normalizePhone(value) {
  return sanitizeText(value).replace(/\s+/g, '');
}

function normalizeLinkedin(value) {
  return sanitizeText(value).toLowerCase();
}

function toApiCandidate(candidateDoc) {
  const isOverdue =
    candidateDoc.nextActionAt &&
    candidateDoc.status !== 'Rejected' &&
    candidateDoc.status !== 'Hired' &&
    new Date(candidateDoc.nextActionAt).getTime() < Date.now();

  return {
    id: candidateDoc._id.toString(),
    name: candidateDoc.name,
    surname: candidateDoc.surname,
    vacancyId: candidateDoc.vacancyId ? String(candidateDoc.vacancyId) : null,
    position: candidateDoc.position || '',
    ownerId: candidateDoc.ownerId || '',
    avatar: candidateDoc.avatar || '',
    progress: candidateDoc.progress || 0,
    deadline: candidateDoc.deadline || '14d',
    email: candidateDoc.email || '',
    phone: candidateDoc.phone || '',
    linkedin: candidateDoc.linkedin || '',
    status: candidateDoc.status || 'New',
    stageEnteredAt: candidateDoc.stageEnteredAt || null,
    nextActionAt: candidateDoc.nextActionAt || null,
    rejectionReason: candidateDoc.rejectionReason || '',
    rejectedAt: candidateDoc.rejectedAt || null,
    trashDeleteAfter: candidateDoc.trashDeleteAfter || null,
    statusHistory: Array.isArray(candidateDoc.statusHistory) ? candidateDoc.statusHistory : [],
    resumeAnalysis: candidateDoc.resumeAnalysis || null,
    createdAt: candidateDoc.createdAt,
    updatedAt: candidateDoc.updatedAt,
    isOverdue: Boolean(isOverdue),
  };
}

function getChangedBy(req) {
  return req?.user?.id ? String(req.user.id) : '';
}

function applyStatusTransition(candidateDoc, nextStatus, options = {}) {
  const previousStatus = candidateDoc.status;
  const changedAt = options.changedAt || new Date();
  const reason = sanitizeText(options.reason);
  const comment = sanitizeText(options.comment);
  const changedBy = sanitizeText(options.changedBy);

  candidateDoc.status = nextStatus;

  if (previousStatus !== nextStatus) {
    candidateDoc.stageEnteredAt = changedAt;
    candidateDoc.statusHistory.push({
      from: previousStatus || null,
      to: nextStatus,
      changedAt,
      changedBy,
      reason,
      comment,
    });
  }

  if (nextStatus === 'Rejected') {
    const rejectionReason = reason || candidateDoc.rejectionReason;
    if (!rejectionReason) {
      const error = new Error('Rejection reason is required');
      error.statusCode = 400;
      throw error;
    }

    const rejectedAt = previousStatus === 'Rejected' && candidateDoc.rejectedAt
      ? candidateDoc.rejectedAt
      : changedAt;

    candidateDoc.rejectionReason = rejectionReason;
    candidateDoc.rejectedAt = rejectedAt;
    candidateDoc.trashDeleteAfter = buildTrashDeleteAfter(rejectedAt);
    return;
  }

  candidateDoc.rejectionReason = '';
  candidateDoc.rejectedAt = null;
  candidateDoc.trashDeleteAfter = null;
}

async function resolveVacancy(vacancyId) {
  const safeVacancyId = sanitizeText(vacancyId);
  if (!safeVacancyId) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(safeVacancyId)) {
    const error = new Error('vacancyId must be a valid ObjectId');
    error.statusCode = 400;
    throw error;
  }

  const vacancy = await Vacancy.findById(safeVacancyId).select('_id title status');
  if (!vacancy) {
    const error = new Error('vacancyId not found');
    error.statusCode = 400;
    throw error;
  }

  return vacancy;
}

async function findDuplicateCandidate(candidateDoc, excludeId = null) {
  const conditions = [];
  const email = normalizeEmail(candidateDoc.email);
  const phone = normalizePhone(candidateDoc.phone);
  const linkedin = normalizeLinkedin(candidateDoc.linkedin);

  if (email) {
    const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    conditions.push({ email: { $regex: `^${escaped}$`, $options: 'i' } });
  }
  if (phone) {
    conditions.push({ phone });
  }
  if (linkedin) {
    const escaped = linkedin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    conditions.push({ linkedin: { $regex: `^${escaped}$`, $options: 'i' } });
  }

  if (!conditions.length) {
    return null;
  }

  const filter = {
    $or: conditions,
    vacancyId: candidateDoc.vacancyId || null,
  };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  return Candidate.findOne(filter);
}

router.post('/', async (req, res) => {
  try {
    const {
      name,
      surname,
      email,
      phone,
      linkedin,
      vacancyId,
      position,
      ownerId,
      avatar,
      progress,
      deadline,
      status,
      nextActionAt,
      rejectionReason,
      resumeAnalysis,
      status_id,
      cv_id,
    } = req.body;

    const safeName = sanitizeText(name);
    const safeSurname = sanitizeText(surname);
    if (!safeName || !safeSurname) {
      return res.status(400).json({ message: 'name and surname are required' });
    }

    if (status_id && !mongoose.Types.ObjectId.isValid(status_id)) {
      return res.status(400).json({ message: 'status_id must be a valid ObjectId' });
    }
    if (status_id) {
      const statusExists = await CandidateStatus.findById(status_id);
      if (!statusExists) return res.status(400).json({ message: 'status_id not found' });
    }

    if (cv_id && !mongoose.Types.ObjectId.isValid(cv_id)) {
      return res.status(400).json({ message: 'cv_id must be a valid ObjectId' });
    }
    if (cv_id) {
      const cvExists = await CV.findById(cv_id);
      if (!cvExists) return res.status(400).json({ message: 'cv_id not found' });
    }

    let safeStatus = sanitizeText(status, 'New');
    if (!BOARD_STATUSES.has(safeStatus)) {
      safeStatus = 'New';
    }

    const linkedVacancy = await resolveVacancy(vacancyId);

    const candidate = new Candidate({
      name: safeName,
      surname: safeSurname,
      email: normalizeEmail(email),
      phone: normalizePhone(phone),
      linkedin: normalizeLinkedin(linkedin),
      vacancyId: linkedVacancy ? linkedVacancy._id : null,
      position: linkedVacancy ? linkedVacancy.title : sanitizeText(position),
      ownerId: sanitizeText(ownerId),
      avatar: sanitizeText(avatar),
      progress: Math.max(0, Math.min(100, sanitizeNumber(progress, 0))),
      deadline: sanitizeText(deadline, '14d'),
      stageEnteredAt: new Date(),
      nextActionAt: sanitizeDate(nextActionAt),
      status: safeStatus,
      rejectionReason: '',
      resumeAnalysis: resumeAnalysis ?? null,
      status_id: status_id || undefined,
      cv_id: cv_id || undefined,
    });

    const duplicate = await findDuplicateCandidate(candidate);
    if (duplicate) {
      return res.status(409).json({
        message: 'Duplicate candidate found for this vacancy (email/phone/linkedin)',
        duplicate: toApiCandidate(duplicate),
      });
    }

    const changedBy = getChangedBy(req);
    if (safeStatus === 'Rejected') {
      applyStatusTransition(candidate, 'Rejected', {
        changedBy,
        reason: sanitizeText(rejectionReason),
        comment: 'Created directly in rejected status',
      });
    } else {
      candidate.statusHistory.push({
        from: null,
        to: safeStatus,
        changedAt: new Date(),
        changedBy,
        reason: '',
        comment: 'Candidate created',
      });
    }

    await candidate.save();
    return res.status(201).json(toApiCandidate(candidate));
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, name, email, position, vacancyId, ownerId, includeRejected, overdue } = req.query;
    const filter = {};

    if (status) {
      const safeStatus = sanitizeText(status);
      if (BOARD_STATUSES.has(safeStatus)) {
        filter.status = safeStatus;
      } else if (mongoose.Types.ObjectId.isValid(safeStatus)) {
        filter.status_id = safeStatus;
      }
    } else if (String(includeRejected || '').toLowerCase() !== 'true') {
      filter.status = { $ne: 'Rejected' };
    }

    if (vacancyId) {
      const safeVacancyId = sanitizeText(vacancyId);
      if (mongoose.Types.ObjectId.isValid(safeVacancyId)) {
        filter.vacancyId = safeVacancyId;
      }
    }

    if (ownerId) {
      filter.ownerId = sanitizeText(ownerId);
    }

    if (name) filter.name = { $regex: sanitizeText(name), $options: 'i' };
    if (email) filter.email = { $regex: sanitizeText(email), $options: 'i' };
    if (position) filter.position = { $regex: sanitizeText(position), $options: 'i' };

    const safeOverdue = String(overdue || '').toLowerCase();
    if (safeOverdue === 'true') {
      filter.nextActionAt = { $lt: new Date() };
      if (!filter.status || typeof filter.status === 'object') {
        filter.status = { $nin: ['Rejected', 'Hired'] };
      }
    }

    const candidates = await Candidate.find(filter).sort({ createdAt: -1 });
    return res.json(candidates.map(toApiCandidate));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/trash', async (_req, res) => {
  try {
    await backfillTrashMetadataForRejectedCandidates();
    const candidates = await Candidate.find({ status: 'Rejected' }).sort({ rejectedAt: -1, updatedAt: -1 });
    return res.json({
      retentionDays: getTrashRetentionDays(),
      items: candidates.map(toApiCandidate),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete('/trash/expired', async (_req, res) => {
  try {
    const result = await purgeExpiredRejectedCandidates();
    return res.json({
      message: 'Expired rejected candidates purged',
      retentionDays: getTrashRetentionDays(),
      ...result,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid candidate ID' });
    }

    const candidate = await Candidate.findById(id);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    const restoreTo = sanitizeText(req.body.status, 'New');
    if (!BOARD_STATUSES.has(restoreTo) || restoreTo === 'Rejected') {
      return res.status(400).json({ message: 'Invalid restore status' });
    }

    applyStatusTransition(candidate, restoreTo, {
      changedBy: getChangedBy(req),
      reason: 'restored',
      comment: 'Restored from trash',
    });
    await candidate.save();

    return res.json(toApiCandidate(candidate));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid candidate ID' });
    }

    const candidate = await Candidate.findById(id);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    return res.json(toApiCandidate(candidate));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid candidate ID' });
    }

    const nextStatus = sanitizeText(req.body.status);
    if (!BOARD_STATUSES.has(nextStatus)) {
      return res.status(400).json({ message: 'Invalid candidate status' });
    }

    const candidate = await Candidate.findById(id);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    applyStatusTransition(candidate, nextStatus, {
      changedBy: getChangedBy(req),
      reason: sanitizeText(req.body.rejectionReason),
      comment: sanitizeText(req.body.comment),
    });
    await candidate.save();

    return res.json(toApiCandidate(candidate));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid candidate ID' });
    }

    const candidate = await Candidate.findById(id);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    if (req.body.status !== undefined) {
      const safeStatus = sanitizeText(req.body.status);
      if (!BOARD_STATUSES.has(safeStatus)) {
        return res.status(400).json({ message: 'Invalid candidate status' });
      }

      applyStatusTransition(candidate, safeStatus, {
        changedBy: getChangedBy(req),
        reason: sanitizeText(req.body.rejectionReason),
        comment: sanitizeText(req.body.comment),
      });
    }

    if (req.body.name !== undefined) candidate.name = sanitizeText(req.body.name);
    if (req.body.surname !== undefined) candidate.surname = sanitizeText(req.body.surname);
    if (req.body.email !== undefined) candidate.email = normalizeEmail(req.body.email);
    if (req.body.phone !== undefined) candidate.phone = normalizePhone(req.body.phone);
    if (req.body.linkedin !== undefined) candidate.linkedin = normalizeLinkedin(req.body.linkedin);
    if (req.body.ownerId !== undefined) candidate.ownerId = sanitizeText(req.body.ownerId);
    if (req.body.avatar !== undefined) candidate.avatar = sanitizeText(req.body.avatar);
    if (req.body.deadline !== undefined) candidate.deadline = sanitizeText(req.body.deadline, '14d');
    if (req.body.nextActionAt !== undefined) candidate.nextActionAt = sanitizeDate(req.body.nextActionAt);

    if (req.body.progress !== undefined) {
      candidate.progress = Math.max(0, Math.min(100, sanitizeNumber(req.body.progress, 0)));
    }

    if (req.body.resumeAnalysis !== undefined) {
      candidate.resumeAnalysis = req.body.resumeAnalysis ?? null;
    }

    if (req.body.vacancyId !== undefined) {
      const linkedVacancy = await resolveVacancy(req.body.vacancyId);
      candidate.vacancyId = linkedVacancy ? linkedVacancy._id : null;
      if (linkedVacancy) {
        candidate.position = linkedVacancy.title;
      }
    }

    if (req.body.position !== undefined && req.body.vacancyId === undefined) {
      candidate.position = sanitizeText(req.body.position);
    }

    const duplicate = await findDuplicateCandidate(candidate, candidate._id);
    if (duplicate) {
      return res.status(409).json({
        message: 'Duplicate candidate found for this vacancy (email/phone/linkedin)',
        duplicate: toApiCandidate(duplicate),
      });
    }

    await candidate.save();

    return res.json(toApiCandidate(candidate));
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid candidate ID' });
    }

    const deleted = await Candidate.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    return res.json({ message: 'Candidate deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
