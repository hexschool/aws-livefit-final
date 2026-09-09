const pino = require('pino')
module.exports = function getLogger (prefix) {
  return pino({
    name: prefix,
    level: process.env.LOG_LEVEL || 'info',
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', 'password', 'token'],
      censor: '[REDACTED]'
    }
  })
}
