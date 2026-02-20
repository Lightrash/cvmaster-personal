const mongoose = require('mongoose');

const BOARD_STATUSES = ['New', 'Screening', 'Interview', 'Test Task', 'Offer', 'Hired', 'Rejected'];

const candidateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    surname: { type: String, required: true, trim: true },
    phone: { type: String, default: '' },
    email: { type: String, default: '', trim: true },
    linkedin: { type: String, default: '' },
    position: { type: String, default: '' },
    avatar: { type: String, default: '' },
    progress: { type: Number, default: 0 },
    deadline: { type: String, default: '14d' },
    status: {
      type: String,
      enum: BOARD_STATUSES,
      default: 'New',
    },
    resumeAnalysis: { type: Object, default: null },
    cv_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CV' },
    status_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CandidateStatus' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Candidate', candidateSchema);
