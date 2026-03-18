const mongoose = require('mongoose');
const Vacancy = require('../models/Vacancy');

const STATUS_ALIASES = {
  Active: 'Active',
  Closed: 'Closed',
  Draft: 'Draft',
  'Відкрита': 'Active',
  'Закрита': 'Closed',
  'В очікуванні': 'Draft',
};

function normalizeStatus(status) {
  if (!status) return 'Active';
  return STATUS_ALIASES[status] || 'Active';
}

function toApiVacancy(vacancy) {
  return {
    id: vacancy._id.toString(),
    title: vacancy.title,
    description: vacancy.description,
    department: vacancy.department || 'General',
    status: normalizeStatus(vacancy.status),
    salary: vacancy.salary || '',
    requirements: vacancy.requirements || [],
    stack: vacancy.stack || [],
    criticalSkills: vacancy.criticalSkills || [],
    coreSkills: vacancy.coreSkills || [],
    optionalSkills: vacancy.optionalSkills || [],
    candidatesCount: vacancy.candidatesCount || 0,
    postedDate: vacancy.createdAt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
  };
}

exports.createVacancy = async (req, res) => {
  try {
    const {
      title,
      description,
      department,
      status,
      salary,
      requirements,
      stack,
      criticalSkills,
      coreSkills,
      optionalSkills,
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const vacancy = await Vacancy.create({
      title: String(title).trim(),
      description: String(description || '').trim(),
      department: String(department || 'General').trim(),
      status: normalizeStatus(status),
      salary: String(salary || '').trim(),
      requirements: Array.isArray(requirements) ? requirements : [],
      stack: Array.isArray(stack) ? stack : [],
      criticalSkills: Array.isArray(criticalSkills) ? criticalSkills : [],
      coreSkills: Array.isArray(coreSkills) ? coreSkills : [],
      optionalSkills: Array.isArray(optionalSkills) ? optionalSkills : [],
      candidatesCount: 0,
    });

    return res.status(201).json(toApiVacancy(vacancy));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getVacancies = async (req, res) => {
  try {
    const { status, q } = req.query;
    const filter = {};

    if (status) {
      filter.status = normalizeStatus(status);
    }

    if (q) {
      const search = String(q).trim();
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
      ];
    }

    const vacancies = await Vacancy.find(filter).sort({ createdAt: -1 });
    return res.json(vacancies.map(toApiVacancy));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateVacancy = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid vacancy ID' });
    }

    const payload = { ...req.body };
    if (payload.status) {
      payload.status = normalizeStatus(payload.status);
    }

    if (payload.title !== undefined) payload.title = String(payload.title).trim();
    if (payload.description !== undefined) payload.description = String(payload.description).trim();
    if (payload.department !== undefined) payload.department = String(payload.department).trim();
    if (payload.salary !== undefined) payload.salary = String(payload.salary).trim();
    if (payload.requirements !== undefined && !Array.isArray(payload.requirements)) payload.requirements = [];
    if (payload.stack !== undefined && !Array.isArray(payload.stack)) payload.stack = [];
    if (payload.criticalSkills !== undefined && !Array.isArray(payload.criticalSkills)) payload.criticalSkills = [];
    if (payload.coreSkills !== undefined && !Array.isArray(payload.coreSkills)) payload.coreSkills = [];
    if (payload.optionalSkills !== undefined && !Array.isArray(payload.optionalSkills)) payload.optionalSkills = [];

    const vacancy = await Vacancy.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!vacancy) {
      return res.status(404).json({ message: 'Vacancy not found' });
    }

    return res.json(toApiVacancy(vacancy));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.deleteVacancy = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid vacancy ID' });
    }

    const deleted = await Vacancy.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Vacancy not found' });
    }

    return res.json({ message: 'Vacancy deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
