const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwt');

// Функція для створення токена
const generateToken = (id) => {
  return jwt.sign({ id }, getJwtSecret(), { expiresIn: '30d' });
};

// РЕЄСТРАЦІЯ
router.post('/register', async (req, res) => {
  try {
    const { name, login, password } = req.body;
    const userExists = await User.findOne({ login });

    if (userExists) return res.status(400).json({ message: 'Користувач вже існує' });

    const user = await User.create({ name, login, password });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      token: generateToken(user._id) // Видаємо токен
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// АВТОРИЗАЦІЯ (LOGIN)
router.post('/login', async (req, res) => {
  const { login, password } = req.body;
  const user = await User.findOne({ login });

  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      name: user.name,
      token: generateToken(user._id)
    });
  } else {
    res.status(401).json({ message: 'Невірний логін або пароль' });
  }
});

module.exports = router;
