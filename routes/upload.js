const express = require('express')

const config = require('../config/index')
const { dataSource } = require('../db/data-source')
const uploadController = require('../controllers/upload')
const logger = require('../utils/logger')('Upload')
const auth = require('../middlewares/auth')({
  secret: config.get('secret').jwtSecret,
  userRepository: dataSource.getRepository('User'),
  logger
})

const router = express.Router()

router.post('/', auth, uploadController.postUploadImage)

module.exports = router
