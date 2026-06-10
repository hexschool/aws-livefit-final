const express = require('express')

const router = express.Router()
const config = require('../config/index')
const { dataSource } = require('../db/data-source')
const logger = require('../utils/logger')('Course')
const auth = require('../middlewares/auth')({
  secret: config.get('secret').jwtSecret,
  userRepository: dataSource.getRepository('User'),
  logger
})
const coursesController = require('../controllers/courses')

router.get('/', coursesController.getAllCourses)

router.post('/:courseId', auth, coursesController.postCourseBooking)

router.delete('/:courseId', auth, coursesController.deleteCourseBooking)

module.exports = router
