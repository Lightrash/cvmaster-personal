const mongoose = require('mongoose');

const candidateStatusSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    enum: ['New', 'Screening', 'Interview', 'Test Task', 'Offer', 'Hired', 'Rejected'] // [cite: 31-37]
  }
});

module.exports = mongoose.model('CandidateStatus', candidateStatusSchema);