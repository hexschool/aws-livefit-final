const express = require('express')

const router = express.Router()
const skillController = require('../controllers/skill')

router.get('/', skillController.getAll)

router.post('/', skillController.postSkill)

router.delete('/:skillId', skillController.delete)

module.exports = router
