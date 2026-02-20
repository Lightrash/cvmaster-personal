const express = require('express');
const router = express.Router();
const { applyToVacancy, getApplications } = require('../controllers/applicationController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getApplications)
  .post(protect, applyToVacancy);

module.exports = router;