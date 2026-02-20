const Candidate = require("../models/Candidate");

exports.getCandidates = async (req, res) => {
  try {
    const { name, email, status, position } = req.query;

    let filter = {};

    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    if (email) {
      filter.email = { $regex: email, $options: "i" };
    }

    if (status) {
      filter.status = status;
    }

    if (position) {
      filter.position = position;
    }

    const candidates = await Candidate.find(filter);

    res.json(candidates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
