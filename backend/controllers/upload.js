const photos = require('../services/photos')
exports.postUploadImage = async (req, res, next) => {
  try {
    const data = await photos.createUpload(req.user.id, req.body.content_type, req.body.size)
    res.status(201).json({ status: 'success', data })
  } catch (error) { next(error) }
}
exports.confirmUpload = async (req, res, next) => {
  try {
    await photos.validatePhoto(req.body.key, req.user.id)
    res.json({ status: 'success', data: { key: req.body.key, image_url: await photos.imageUrl(req.body.key) } })
  } catch (error) { next(error) }
}
