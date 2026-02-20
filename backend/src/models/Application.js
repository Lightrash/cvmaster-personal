const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
  vacancy: { type: mongoose.Schema.Types.ObjectId, ref: 'Vacancy', required: true },
  status: { type: String, default: 'Новий' }, // Новий, Співбесіда, Оффер, Відмова
  appliedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Application', applicationSchema);