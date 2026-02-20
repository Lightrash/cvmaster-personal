const express = require('express');
const mongoose = require('mongoose');
const Candidate = require('../models/Candidate');
const CandidateStatus = require('../models/CandidateStatus');
const CV = require('../models/CV');

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

function toApiCandidate(candidateDoc) {
  return {
    id: candidateDoc._id.toString(),
    name: candidateDoc.name,
    surname: candidateDoc.surname,
    position: candidateDoc.position || '',
    avatar: candidateDoc.avatar || '',
    progress: candidateDoc.progress || 0,
    deadline: candidateDoc.deadline || '14d',
    email: candidateDoc.email || '',
    phone: candidateDoc.phone || '',
    linkedin: candidateDoc.linkedin || '',
    status: candidateDoc.status || 'New',
    resumeAnalysis: candidateDoc.resumeAnalysis || null,
    createdAt: candidateDoc.createdAt,
    updatedAt: candidateDoc.updatedAt,
  };
}

router.post('/', async (req, res) => {
  try {
    const {
      name,
      surname,
      email,
      phone,
      linkedin,
      position,
      avatar,
      progress,
      deadline,
      status,
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

    const candidate = await Candidate.create({
      name: safeName,
      surname: safeSurname,
      email: sanitizeText(email),
      phone: sanitizeText(phone),
      linkedin: sanitizeText(linkedin),
      position: sanitizeText(position),
      avatar: sanitizeText(avatar),
      progress: Math.max(0, Math.min(100, sanitizeNumber(progress, 0))),
      deadline: sanitizeText(deadline, '14d'),
      status: safeStatus,
      resumeAnalysis: resumeAnalysis ?? null,
      status_id: status_id || undefined,
      cv_id: cv_id || undefined,
    });

    return res.status(201).json(toApiCandidate(candidate));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, name, email, position } = req.query;
    const filter = {};

    if (status) {
      const safeStatus = sanitizeText(status);
      if (BOARD_STATUSES.has(safeStatus)) {
        filter.status = safeStatus;
      } else if (mongoose.Types.ObjectId.isValid(safeStatus)) {
        filter.status_id = safeStatus;
      }
    }
    if (name) filter.name = { $regex: sanitizeText(name), $options: 'i' };
    if (email) filter.email = { $regex: sanitizeText(email), $options: 'i' };
    if (position) filter.position = { $regex: sanitizeText(position), $options: 'i' };

    const candidates = await Candidate.find(filter).sort({ createdAt: -1 });
    return res.json(candidates.map(toApiCandidate));
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

    const candidate = await Candidate.findByIdAndUpdate(
      id,
      { status: nextStatus },
      { new: true, runValidators: true }
    );

    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    return res.json(toApiCandidate(candidate));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid candidate ID' });
    }

    const payload = { ...req.body };
    if (payload.status !== undefined) {
      const safeStatus = sanitizeText(payload.status);
      if (!BOARD_STATUSES.has(safeStatus)) {
        return res.status(400).json({ message: 'Invalid candidate status' });
      }
      payload.status = safeStatus;
    }

    if (payload.name !== undefined) payload.name = sanitizeText(payload.name);
    if (payload.surname !== undefined) payload.surname = sanitizeText(payload.surname);
    if (payload.email !== undefined) payload.email = sanitizeText(payload.email);
    if (payload.phone !== undefined) payload.phone = sanitizeText(payload.phone);
    if (payload.linkedin !== undefined) payload.linkedin = sanitizeText(payload.linkedin);
    if (payload.position !== undefined) payload.position = sanitizeText(payload.position);
    if (payload.avatar !== undefined) payload.avatar = sanitizeText(payload.avatar);
    if (payload.deadline !== undefined) payload.deadline = sanitizeText(payload.deadline, '14d');
    if (payload.progress !== undefined) {
      payload.progress = Math.max(0, Math.min(100, sanitizeNumber(payload.progress, 0)));
    }

    const candidate = await Candidate.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    return res.json(toApiCandidate(candidate));
  } catch (error) {
    return res.status(500).json({ message: error.message });
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
