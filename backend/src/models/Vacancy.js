const mongoose = require('mongoose');

const vacancySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  department: { type: String, default: 'General', trim: true },
  status: {
    type: String,
    enum: ['Active', 'Closed', 'Draft'],
    default: 'Active',
  },
  salary: { type: String, default: '' },
  requirements: [{ type: String }],
  stack: [{ type: String }],
  candidatesCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Vacancy', vacancySchema);
