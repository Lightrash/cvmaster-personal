function getJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim()) {
    return process.env.JWT_SECRET.trim();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }

  return 'dev_jwt_secret';
}

module.exports = { getJwtSecret };
