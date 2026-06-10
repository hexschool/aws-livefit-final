const { IsNull, MoreThan, LessThanOrEqual } = require('typeorm')
const { dataSource } = require('../db/data-source')
const logger = require('../utils/logger')('CoursesController')

class CoursesController {
  static async getAllCourses (req, res, next) {
    try {
      const courses = await dataSource.getRepository('Course').find({
        select: {
          id: true,
          name: true,
          description: true,
          start_at: true,
          end_at: true,
          max_participants: true,
          User: {
            name: true
          },
          Skill: {
            name: true
          }
        },
        where: {
          start_at: LessThanOrEqual(new Date()),
          end_at: MoreThan(new Date())
        },
        relations: {
          User: true,
          Skill: true
        }
      })
      res.status(200).json({
        status: 'success',
        data: courses.map((course) => {
          return {
            id: course.id,
            name: course.name,
            description: course.description,
            start_at: course.start_at,
            end_at: course.end_at,
            max_participants: course.max_participants,
            coach_name: course.User.name,
            skill_name: course.Skill.name
          }
        })
      })
    } catch (error) {
      logger.error(error)
      next(error)
    }
  }

  static async postCourseBooking (req, res, next) {
    try {
      const { id } = req.user
      const { courseId } = req.params
      const courseRepo = dataSource.getRepository('Course')
      const course = await courseRepo.findOne({
        where: {
          id: courseId
        }
      })
      if (!course) {
        res.status(400).json({
          status: 'failed',
          message: 'ID錯誤'
        })
        return
      }
      const creditPurchaseRepo = dataSource.getRepository('CreditPurchase')
      const courseBookingRepo = dataSource.getRepository('CourseBooking')
      const userCourseBooking = await courseBookingRepo.findOne({
        where: {
          user_id: id,
          course_id: courseId
        }
      })
      if (userCourseBooking) {
        res.status(400).json({
          status: 'failed',
          message: '已經報名過此課程'
        })
        return
      }
      const userCredit = await creditPurchaseRepo.sum('purchased_credits', {
        user_id: id
      })
      const userUsedCredit = await courseBookingRepo.count({
        where: {
          user_id: id,
          cancelledAt: IsNull()
        }
      })
      const courseBookingCount = await courseBookingRepo.count({
        where: {
          course_id: courseId,
          cancelledAt: IsNull()
        }
      })
      if (userUsedCredit >= userCredit) {
        res.status(400).json({
          status: 'failed',
          message: '已無可使用堂數'
        })
        return
      } else if (courseBookingCount >= course.max_participants) {
        res.status(400).json({
          status: 'failed',
          message: '已達最大參加人數，無法參加'
        })
        return
      }
      const newCourseBooking = await courseBookingRepo.create({
        user_id: id,
        course_id: courseId
      })
      await courseBookingRepo.save(newCourseBooking)
      res.status(201).json({
        status: 'success',
        data: null
      })
    } catch (error) {
      logger.error(error)
      next(error)
    }
  }

  static async deleteCourseBooking (req, res, next) {
    try {
      const { id } = req.user
      const { courseId } = req.params
      const courseBookingRepo = dataSource.getRepository('CourseBooking')
      const userCourseBooking = await courseBookingRepo.findOne({
        where: {
          user_id: id,
          course_id: courseId,
          cancelledAt: IsNull()
        }
      })
      if (!userCourseBooking) {
        res.status(400).json({
          status: 'failed',
          message: 'ID錯誤'
        })
        return
      }
      const updateResult = await courseBookingRepo.update(
        {
          user_id: id,
          course_id: courseId,
          cancelledAt: IsNull()
        },
        {
          cancelledAt: new Date().toISOString()
        }
      )
      if (updateResult.affected === 0) {
        res.status(400).json({
          status: 'failed',
          message: '取消失敗'
        })
        return
      }
      res.status(200).json({
        status: 'success',
        data: null
      })
    } catch (error) {
      logger.error(error)
      next(error)
    }
  }
}
module.exports = CoursesController
