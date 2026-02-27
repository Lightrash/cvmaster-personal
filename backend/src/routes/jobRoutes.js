const express = require('express');
const mongoose = require('mongoose');
const Vacancy = require('../models/Vacancy');
const Candidate = require('../models/Candidate');

const router = express.Router();
const STATUS_VALUES = ['Active', 'Closed', 'Draft'];

function mapDbStatusToApi(status) {
  const value = String(status || '').trim();
  if (value === 'Р’С–РґРєСЂРёС‚Р°' || value.toLowerCase() === 'active') return 'Active';
  if (value === 'Р—Р°РєСЂРёС‚Р°' || value.toLowerCase() === 'closed') return 'Closed';
  if (value === 'Р’ РѕС‡С–РєСѓРІР°РЅРЅС–' || value.toLowerCase() === 'draft') return 'Draft';
  return 'Draft';
}

function mapApiStatusToDb(status) {
  const value = String(status || '').trim();
  return STATUS_VALUES.includes(value) ? value : 'Active';
}

function toJob(v) {
  return {
    id: v._id.toString(),
    title: v.title,
    department: v.department || 'General',
    candidatesCount: v.candidatesCount || 0,
    status: mapDbStatusToApi(v.status),
    postedDate: v.createdAt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    description: v.description || '',
    requirements: v.requirements || [],
    stack: v.stack || [],
  };
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

router.get('/', async (req, res) => {
  try {
    const [vacancies, countsByVacancyId, countsByPosition] = await Promise.all([
      Vacancy.find().sort({ createdAt: -1 }),
      Candidate.aggregate([
        {
          $match: {
            status: { $ne: 'Rejected' },
            vacancyId: { $ne: null },
          },
        },
        {
          $group: {
            _id: { $toString: '$vacancyId' },
            count: { $sum: 1 },
          },
        },
      ]),
      Candidate.aggregate([
        {
          $match: {
            status: { $ne: 'Rejected' },
            vacancyId: null,
            position: { $type: 'string', $ne: '' },
          },
        },
        {
          $group: {
            _id: { $toLower: { $trim: { input: '$position' } } },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const countsByVacancyMap = new Map(countsByVacancyId.map((item) => [item._id, item.count]));
    const countsByTitle = new Map(countsByPosition.map((item) => [item._id, item.count]));
    return res.json(
      vacancies.map((vacancy) => ({
        ...toJob(vacancy),
        candidatesCount:
          countsByVacancyMap.get(vacancy._id.toString()) ??
          countsByTitle.get(normalizeKey(vacancy.title)) ??
          vacancy.candidatesCount ??
          0,
      }))
    );
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, department, description, requirements, stack, status } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const vacancy = await Vacancy.create({
      title: String(title).trim(),
      description: String(description || '').trim(),
      department: String(department || 'General').trim(),
      requirements: Array.isArray(requirements) ? requirements : [],
      stack: Array.isArray(stack) ? stack : [],
      status: mapApiStatusToDb(status),
      candidatesCount: 0,
    });

    return res.status(201).json(toJob(vacancy));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid job ID' });
    }

    const payload = {};

    if (req.body.title !== undefined) {
      const title = String(req.body.title || '').trim();
      if (!title) {
        return res.status(400).json({ message: 'Title cannot be empty' });
      }
      payload.title = title;
    }

    if (req.body.department !== undefined) {
      payload.department = String(req.body.department || 'General').trim() || 'General';
    }

    if (req.body.description !== undefined) {
      payload.description = String(req.body.description || '').trim();
    }

    if (req.body.requirements !== undefined) {
      payload.requirements = Array.isArray(req.body.requirements) ? req.body.requirements : [];
    }

    if (req.body.stack !== undefined) {
      payload.stack = Array.isArray(req.body.stack) ? req.body.stack : [];
    }

    if (req.body.status !== undefined) {
      payload.status = mapApiStatusToDb(req.body.status);
    }

    const updated = await Vacancy.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ message: 'Job not found' });
    }

    return res.json(toJob(updated));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid job ID' });
    }

    const deleted = await Vacancy.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Job not found' });
    }

    return res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
