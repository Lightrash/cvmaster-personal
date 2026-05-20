const crypto = require('crypto');

function isMethodDebugEnabled() {
  return process.env.METHOD_DEBUG === 'true';
}

function safeStringify(payload) {
  try {
    return JSON.stringify(payload);
  } catch (_error) {
    return JSON.stringify({ error: 'unserializable-payload' });
  }
}

function debugMethodLog(event, payload = {}) {
  if (!isMethodDebugEnabled()) return;
  const timestamp = new Date().toISOString();
  const serialized = safeStringify(payload);
  console.log(`[method-debug] ${timestamp} ${event} ${serialized}`);
}

function fingerprintText(text = '') {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex').slice(0, 16);
}

module.exports = {
  isMethodDebugEnabled,
  debugMethodLog,
  fingerprintText,
};
