const express = require('express')

const router = express.Router()
const config = require('../config/index')
const { dataSource } = require('../db/data-source')
const logger = require('../utils/logger')('Users')
const usersController = require('../controllers/users')
const auth = require('../middlewares/auth')({
  secret: config.get('secret').jwtSecret,
  userRepository: dataSource.getRepository('User'),
  logger
})

router.post('/signup', usersController.postSignup)

router.post('/login', usersController.postLogin)

router.get('/profile', auth, usersController.getProfile)

router.get('/credit-package', auth, usersController.getCreditPackage)

router.put('/profile', auth, usersController.putProfile)

router.put('/password', auth, usersController.putPassword)

router.get('/courses', auth, usersController.getCourseBooking)

module.exports = router
