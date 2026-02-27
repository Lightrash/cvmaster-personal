const mongoose = require('mongoose');

const BOARD_STATUSES = ['New', 'Screening', 'Interview', 'Test Task', 'Offer', 'Hired', 'Rejected'];

const statusHistorySchema = new mongoose.Schema(
  {
    from: { type: String, enum: BOARD_STATUSES, default: null },
    to: { type: String, enum: BOARD_STATUSES, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: String, default: '' },
    reason: { type: String, default: '' },
    comment: { type: String, default: '' },
  },
  { _id: false }
);

const candidateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    surname: { type: String, required: true, trim: true },
    phone: { type: String, default: '' },
    email: { type: String, default: '', trim: true },
    linkedin: { type: String, default: '' },
    vacancyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vacancy', default: null },
    position: { type: String, default: '' },
    ownerId: { type: String, default: '' },
    avatar: { type: String, default: '' },
    progress: { type: Number, default: 0 },
    deadline: { type: String, default: '14d' },
    stageEnteredAt: { type: Date, default: Date.now },
    nextActionAt: { type: Date, default: null },
    status: {
      type: String,
      enum: BOARD_STATUSES,
      default: 'New',
    },
    rejectionReason: { type: String, default: '' },
    rejectedAt: { type: Date, default: null },
    trashDeleteAfter: { type: Date, default: null },
    statusHistory: { type: [statusHistorySchema], default: [] },
    resumeAnalysis: { type: Object, default: null },
    cv_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CV' },
    status_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CandidateStatus' },
  },
  { timestamps: true }
);

candidateSchema.index({ status: 1, trashDeleteAfter: 1 });
candidateSchema.index({ vacancyId: 1, status: 1 });
candidateSchema.index({ email: 1 });
candidateSchema.index({ phone: 1 });
candidateSchema.index({ linkedin: 1 });

module.exports = mongoose.model('Candidate', candidateSchema);
