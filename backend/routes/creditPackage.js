const express = require('express')

const router = express.Router()
const config = require('../config/index')
const { dataSource } = require('../db/data-source')
const creditPackageController = require('../controllers/creditPackage')
const logger = require('../utils/logger')('CreditPackage')
const auth = require('../middlewares/auth')({
  secret: config.get('secret').jwtSecret,
  userRepository: dataSource.getRepository('User'),
  logger
})

router.get('/', creditPackageController.getAll)

router.post('/', creditPackageController.postCreditPackage)

router.post('/:creditPackageId', auth, creditPackageController.postUserBuy)

router.delete('/:creditPackageId', creditPackageController.delete)

module.exports = router
