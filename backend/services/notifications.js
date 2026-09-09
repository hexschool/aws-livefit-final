const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses')
const client = new SESClient({ ...require('./aws'), maxAttempts: 1, requestHandler: { connectionTimeout: 2000, requestTimeout: 3000 } })
const logger = require('../utils/logger')('BookingNotification')
async function sendBookingNotification (user, course, bookingId) {
  if (process.env.EMAIL_MODE !== 'ses') return { status: 'disabled' }
  try {
    if (!process.env.SES_FROM_EMAIL) throw new Error('SES_FROM_EMAIL is required')
    const response = await client.send(new SendEmailCommand({
      Source: process.env.SES_FROM_EMAIL,
      Destination: { ToAddresses: [user.email] },
      Message: {
        Subject: { Data: `LiveFit 報名確認：${course.name}`, Charset: 'UTF-8' },
        Body: { Text: { Charset: 'UTF-8', Data: `${user.name} 您好，\n您已成功報名「${course.name}」。\n開始時間：${new Date(course.start_at).toISOString()}（UTC）\n報名編號：${bookingId}\n請登入 LiveFit 查看課程詳情。` } }
      }
    }))
    // SES 接受寄送請求不等於收件匣已收到。
    logger.info({ event: 'booking_email_accepted', bookingId, messageId: response.MessageId })
    return { status: 'accepted' }
  } catch (error) {
    logger.warn({ event: 'booking_email_failed', bookingId, errorCode: error.name }, '報名成功，但通知寄送失敗')
    return { status: 'failed' }
  }
}
module.exports = { sendBookingNotification }
