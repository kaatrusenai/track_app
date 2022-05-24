const mongo = require('./mongo')

async function well () {
  await mongo.connect()
  const doc = await mongo.user().findOne({ username: 'tango' })
  doc.routes.push(
  )
  doc.save()
}

well()
