const express = require('express')
const cors = require('cors')
const path = require('path')
const pinoHttp = require('pino-http')

const logger = require('./utils/logger')('App')
const creditPackageRouter = require('./routes/creditPackage')
const skillRouter = require('./routes/skill')
const usersRouter = require('./routes/users')
const adminRouter = require('./routes/admin')
const coachRouter = require('./routes/coaches')
const coursesRouter = require('./routes/courses')
const uploadRouter = require('./routes/upload')

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(pinoHttp({ logger }))
app.use(express.static(path.join(__dirname, 'public')))

app.get('/healthcheck', (req, res) => {
  res.status(200)
  res.send('OK')
})
app.get('/ready', async (req, res) => {
  try {
    await require('./db/data-source').dataSource.query('SELECT 1')
    res.json({ status: 'ready' })
  } catch { res.status(503).json({ status: 'unavailable' }) }
})
app.use('/api/credit-package', creditPackageRouter)
app.use('/api/coaches/skill', skillRouter)
app.use('/api/users', usersRouter)
app.use('/api/admin', adminRouter)
app.use('/api/coaches', coachRouter)
app.use('/api/courses', coursesRouter)
app.use('/api/upload', uploadRouter)

// 同一映像附帶既有前端，保留 W10 單一 LiveFit Container。
app.use('/api', (req, res) => res.status(404).json({ status: 'failed', message: 'API 不存在' }))
app.get('*', (req, res, next) => {
  res.sendFile(path.join(__dirname, 'public/index.html'), error => { if (error) next(error) })
})

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  req.log.error(err)
  if (err.status) {
    res.status(err.status).json({
      status: 'failed',
      message: err.message
    })
    return
  }
  res.status(500).json({
    status: 'error',
    message: '伺服器錯誤'
  })
})

module.exports = app
