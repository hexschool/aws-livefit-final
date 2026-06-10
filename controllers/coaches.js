const { MoreThan } = require('typeorm')
const { dataSource } = require('../db/data-source')
const logger = require('../utils/logger')('CoachesController')
function isUndefined (value) {
  return value === undefined || value === 'undefined'
}

function isNotValidInteger (value) {
  return typeof value !== 'number' || value < 0 || value % 1 !== 0
}

function isNotValidSting (value) {
  return typeof value !== 'string' || value.trim().length === 0 || value === ''
}

class CoachesController {
  static async getCoaches (req, res, next) {
    try {
      const { per, page } = req.query
      if (isUndefined(per) || isNotValidSting(per) ||
        isUndefined(page) || isNotValidSting(page)) {
        res.status(400).json({
          status: 'failed',
          message: '欄位未填寫正確'
        })
        return
      }
      const perToInt = parseInt(per, 10)
      const pageToInt = parseInt(page, 10)
      if (isNotValidInteger(perToInt) || isNotValidInteger(pageToInt)) {
        res.status(400).json({
          status: 'failed',
          message: '欄位未填寫正確'
        })
        return
      }
      const coaches = await dataSource.getRepository('Coach').find({
        select: {
          id: true,
          user_id: true,
          User: {
            name: true
          }
        },
        take: perToInt,
        skip: (pageToInt - 1) * perToInt,
        relations: {
          User: true
        }
      })
      res.status(200).json({
        status: 'success',
        data: coaches.map((coach) => ({
          id: coach.id,
          user_id: coach.user_id,
          name: coach.User.name
        }))
      })
    } catch (error) {
      logger.error(error)
      next(error)
    }
  }

  static async getCoachDetail (req, res, next) {
    try {
      const { coachId } = req.params
      if (isUndefined(coachId) || isNotValidSting(coachId)) {
        res.status(400).json({
          status: 'failed',
          message: '欄位未填寫正確'
        })
        return
      }
      const coach = await dataSource.getRepository('Coach').findOne({
        select: {
          id: true,
          user_id: true,
          experience_years: true,
          description: true,
          profile_image_url: true,
          created_at: true,
          updated_at: true,
          User: {
            name: true,
            role: true
          }
        },
        where: {
          id: coachId
        },
        relations: {
          User: true
        }
      })
      if (!coach) {
        logger.warn('找不到該教練')
        res.status(400).json({
          status: 'failed',
          message: '找不到該教練'
        })
        return
      }
      const coachSkill = await dataSource.getRepository('CoachLinkSkill').find({
        select: {
          Skill: {
            name: true
          }
        },
        where: {
          coach_id: coach.id
        },
        relations: {
          Skill: true
        }
      })
      logger.info(`coachSkill: ${JSON.stringify(coachSkill)}`)
      const skills = coachSkill.map((cs) => cs.Skill.name)
      logger.info(`coach: ${JSON.stringify(coach)}`)
      res.status(200).json({
        status: 'success',
        data: {
          user: coach.User,
          coach: {
            id: coach.id,
            user_id: coach.user_id,
            experience_years: coach.experience_years,
            description: coach.description,
            profile_image_url: coach.profile_image_url,
            created_at: coach.created_at,
            updated_at: coach.updated_at,
            skills
          }
        }
      })
    } catch (error) {
      logger.error(error)
      next(error)
    }
  }

  static async getCoachCourses (req, res, next) {
    try {
      const { coachId } = req.params
      if (isUndefined(coachId) || isNotValidSting(coachId)) {
        res.status(400).json({
          status: 'failed',
          message: '欄位未填寫正確'
        })
        return
      }
      const coach = await dataSource.getRepository('Coach').findOne({
        select: {
          id: true,
          user_id: true,
          User: {
            name: true
          }
        },
        where: {
          id: coachId
        },
        relations: {
          User: true
        }
      })
      if (!coach) {
        logger.warn('找不到該教練')
        res.status(400).json({
          status: 'failed',
          message: '找不到該教練'
        })
        return
      }
      logger.info(`coach: ${JSON.stringify(coach)}`)
      const courses = await dataSource.getRepository('Course').find({
        select: {
          id: true,
          name: true,
          description: true,
          start_at: true,
          end_at: true,
          max_participants: true,
          Skill: {
            name: true
          }
        },
        where: {
          user_id: coach.user_id,
          end_at: MoreThan(new Date())
        },
        relations: {
          Skill: true
        }
      })
      logger.info(`courses: ${JSON.stringify(courses)}`)
      res.status(200).json({
        status: 'success',
        data: courses.map((course) => ({
          id: course.id,
          name: course.name,
          description: course.description,
          start_at: course.start_at,
          end_at: course.end_at,
          max_participants: course.max_participants,
          coach_name: coach.User.name,
          skill_name: course.Skill.name
        }))
      })
    } catch (error) {
      logger.error(error)
      next(error)
    }
  }
}
module.exports = CoachesController
