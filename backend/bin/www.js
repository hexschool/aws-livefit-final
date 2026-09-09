#!/usr/bin/env node

/**
 * Module dependencies.
 */
const http = require('http')
const config = require('../config/index')
const app = require('../app') // 導入 app.js
const logger = require('../utils/logger')('www')
const { dataSource } = require('../db/data-source')

const port = config.get('web.port')

app.set('port', port)

const server = http.createServer(app)

function onError (error) {
  if (error.syscall !== 'listen') {
    throw error
  }
  const bind = typeof port === 'string'
    ? `Pipe ${port}`
    : `Port ${port}`
  // handle specific listen errors
  switch (error.code) {
    case 'EACCES':
      logger.error(`${bind} requires elevated privileges`)
      process.exit(1)
      break
    case 'EADDRINUSE':
      logger.error(`${bind} is already in use`)
      process.exit(1)
      break
    default:
      logger.error(`exception on ${bind}: ${error.code}`)
      process.exit(1)
  }
}

server.on('error', onError)
async function start () {
  try {
    await dataSource.initialize()
    server.listen(port, () => logger.info({ port }, '伺服器與資料庫已就緒'))
  } catch (error) {
    logger.error({ errorCode: error.code }, '資料庫啟動失敗')
    process.exit(1)
  }
}
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    server.close(async () => {
      if (dataSource.isInitialized) await dataSource.destroy()
      process.exit(0)
    })
    setTimeout(() => process.exit(1), 10000).unref()
  })
}
start()
