const express = require('express');
const mongoose = require('mongoose');
const Vacancy = require('../models/Vacancy');
const Candidate = require('../models/Candidate');

const router = express.Router();

function toJob(v) {
  return {
    id: v._id.toString(),
    title: v.title,
    department: v.department || 'General',
    candidatesCount: v.candidatesCount || 0,
    status: v.status || 'Active',
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
    const [vacancies, counts] = await Promise.all([
      Vacancy.find().sort({ createdAt: -1 }),
      Candidate.aggregate([
        {
          $match: {
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

    const countsByTitle = new Map(counts.map((item) => [item._id, item.count]));
    return res.json(
      vacancies.map((vacancy) => ({
        ...toJob(vacancy),
        candidatesCount:
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
      status: ['Active', 'Closed', 'Draft'].includes(status) ? status : 'Active',
      candidatesCount: 0,
    });

    return res.status(201).json(toJob(vacancy));
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
