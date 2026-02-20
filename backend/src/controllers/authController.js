const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwt');

exports.register = async (req, res) => {
  try {
    const { name, login, password } = req.body;
    if (!name || !login || !password) {
      return res.status(400).json({ message: 'name, login and password are required' });
    }

    const existingUser = await User.findOne({ login });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({ name, login, password });
    const token = jwt.sign({ id: user._id }, getJwtSecret(), { expiresIn: '30d' });
    return res.status(201).json({ _id: user._id, name: user.name, token });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { login, password } = req.body;
    const user = await User.findOne({ login });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, getJwtSecret(), { expiresIn: '30d' });
    return res.json({ _id: user._id, name: user.name, token });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
