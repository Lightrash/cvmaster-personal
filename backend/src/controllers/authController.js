const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwt');

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({ name, email: normalizedEmail, password });
    const token = jwt.sign({ id: user._id }, getJwtSecret(), { expiresIn: '30d' });
    return res.status(201).json({ _id: user._id, name: user.name, token });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user =
      (await User.findOne({ email: normalizedEmail })) ||
      (await User.findOne({ login: normalizedEmail }));

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, getJwtSecret(), { expiresIn: '30d' });
    return res.json({ _id: user._id, name: user.name, token });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
