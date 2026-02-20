const mongoose = require("mongoose");

const cvSchema = new mongoose.Schema({
  position_id: { type: mongoose.Schema.Types.ObjectId, ref: "Position" },
  skills: [String],
  level: String, // Junior/Middle/Senior
  year_exp: Number,
  stack: [String],
  soft_skills: [String],
  total_rating: Number,
  summary: String,
}, { timestamps: true });

module.exports = mongoose.model("CV", cvSchema);