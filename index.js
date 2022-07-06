const express = require('express')
const WebSocket = require('ws')
const mongo = require('./mongo')
const response = require('./response')
const bodyParser = require('body-parser')
const utility = require('./utility')
const url = require('node:url')
const { dataJson } = require('./response')

const app = express()
app.use(bodyParser.urlencoded({ extended: true, limit: '25mb' }))
app.use(bodyParser.json({ limit: '25mb' }))
app.use(bodyParser.raw())

const server = app.listen(
  process.env.PORT || 3100,
  async () => await mongo.connect()
)

const wss = new WebSocket.Server({ server: server })

app.get('/signin', async (req, res) => {
  const email = req.query.email
  const password = req.query.password
  const mobileID = req.headers.id ?? ''
  try {
    const user = await mongo.getUser(email)
    user.mobileID = ''
    if (user != null) {
      if (user.password === password) {
        if (user.mobileID.length === 0) {
          await mongo.addMobileID(mobileID, user)
          res.json(response.dataJson(200, [user]))
        } else {
          if (user.mobile_id === mobileID) {
            res.json(response.dataJson(200, [user]))
          } else {
            res.json(response.authJson(402))
          }
        }
      } else {
        res.json(response.authJson(401))
      }
    } else {
      res.json(response.authJson(404))
    }
  } catch (error) {
    console.log(error)
    res.json(response.authJson(500))
  }
})

app.get('/signout', async (req, res) => {
  const email = req.query.user
  try {
    await mongo.signout(email)
    res.json(response.dataJson(200))
  } catch (error) {
    console.log(error)
    res.json(response.authJson(500))
  }
})

app.get('/dashboard', async (req, res) => {
  try {
    const email = req.query.user
    const id = req.headers.id
    const authCheck = await mongo.checkMobileId(id, email)
    if (authCheck) {
      const data = await mongo.getDashBoardData(email)
      res.json(response.dataJson(200, [data]))
    } else {
      res.json(response.dataJson(402))
    }
  } catch {
    res.json(response.dataJson(500))
  }
})

app.get('/activity', async (req, res) => {
  const result = await mongo.getActivityData(req.query.user)
  res.json(dataJson(200, [result]))
})

app.get('/session_history', async (req, res) => {
  try {
    const email = req.query.user
    const id = req.headers.id
    const authCheck = await mongo.checkMobileId(id, email)
    if (authCheck) {
      const sessionHistory = await mongo
        .getSessionHistory(email)
        .then((value) => JSON.parse(JSON.stringify(value)))
      for (const i in utility.numberRange(0, sessionHistory.length)) {
        sessionHistory.at(i).coordinates = utility.filterCoordinates(
          sessionHistory.at(i).coordinates
        )
      }
      res.json(response.dataJson(200, sessionHistory))
    } else {
      res.json(response.dataJson(402))
    }
  } catch (error) {
    console.log(error)
    res.json(response.dataJson(500))
  }
})

app.get('/profile', async (req, res) => {
  try {
    const email = req.query.user
    const id = req.headers.id
    const authCheck = await mongo.checkMobileId(id, email)
    if (authCheck) {
      const profile = await mongo.getUser(email)
      res.json(response.dataJson(200, [profile]))
    } else {
      res.json(response.dataJson(402))
    }
  } catch (error) {
    res.json(response.dataJson(500))
  }
})

app.get('/covered_area', async (req, res) => {
  try {
    const id = req.headers.id
    const email = req.query.user
    const authCheck = await mongo.checkMobileId(id, email)
    if (authCheck) {
      const coveredArea = await mongo.getCoveredArea()
      res.json(response.dataJson(200, coveredArea))
    } else {
      res.json(response.dataJson(402))
    }
  } catch (e) {
    console.log(e)
    res.json(response.dataJson(500))
  }
})

app.get('/check_last_session', async (req, res) => {
  try {
    console.log('checking last session')
    const email = req.query.user
    const id = req.headers.id
    const authCheck = await mongo.checkMobileId(id, email)
    if (authCheck) {
      const userTracking = await mongo.getUserTracking(email)
      await mongo.checkEmptySession(userTracking)
      const status =
        mongo.isSessionClosed(userTracking) === true
          ? {
              status: 'closed'
            }
          : {
              status: 'open'
            }
      res.json(response.dataJson(200, [status]))
    } else {
      res.json(response.dataJson(402))
    }
  } catch (e) {
    console.log(e)
    res.json(response.dataJson(500))
  }
})

app.post('/close_session', async (req, res) => {
  try {
    console.log('closing last session')
    const email = req.query.user
    const id = req.headers.id
    const authCheck = await mongo.checkMobileId(id, email)
    if (authCheck) {
      const data = req.body

      await mongo.closeSession(email, data)
      res.json(response.dataJson(200))
    } else {
      res.json(response.dataJson(402))
    }
  } catch (e) {
    console.log(e)
    res.json(response.dataJson(500))
  }
})

app.get('/device_status', async (req, res) => {
  res.json(response.dataJson(200, [{ device: 1, deviceStatus: true }]))
  // try {
  //   console.log("checking device status");
  //   const email = req.query.user;
  //   const id = req.headers.id;
  //   const authCheck = await mongo.checkMobileId(id, email);
  //   if (authCheck) {
  //     const deviceID = await mongo.getDeviceID(email);
  //     const status = await mongo.getDeviceStatus(deviceID);
  //     res.json(response.dataJson(200, [status]));
  //   } else {
  //     res.json(response.dataJson(402));
  //   }
  // } catch (e) {
  //   console.log(e);
  //   res.json(response.dataJson(500));
  // }
})

app.get('/routes', async (req, res) => {
  const result = await mongo.getRoutes(req.query.user)
  res.json(dataJson(200, [result]))
})

app.get('/custom_session_history', async (req, res) => {
  const result = await mongo.getCustomSessionHistory(req.query.user)
  console.log(result)
  res.json(dataJson(200, result))
})

async function close (ws) {
  console.log('closing')
  await ws.close(1001)
}

wss.on('connection', async function connection (ws, req) {
  const path = new url.URL(req.url, 'ws://localhost:3000').pathname
  if (path === '/session') {
    sessionSocket(ws, req)
  } else {
    customRouteSocket(ws, req)
  }
})

async function sessionSocket (ws, req) {
  const user = req.url.split('=')[1]
  try {
    const userTracking = await mongo.getUserTracking(user)
    await mongo.addNewSession(userTracking)
    const deviceID = await mongo.getDeviceID(user)
    const timer = setTimeout(close, 10000, ws)
    ws.on('message', async function incoming (data) {
      const coordinates = JSON.parse(data.toString())
      const updated = await mongo.updateSession(user, coordinates, deviceID)
      ws.send(JSON.stringify(updated))
    })

    ws.on('ping', async () => {
      console.log('ping')
      ws.pong()
      timer.refresh()
    })

    ws.on('close', async (code, metric) => {
      if (code === 1000) {
        const data = JSON.parse(metric.toString())
        await mongo.closeSession(user, data)
      } else {
        await mongo.checkEmptySession(userTracking)
      }
      console.log('closed')
    })
  } catch (e) {
    console.log('error' + e)
    ws.send(JSON.stringify(response.dataJson(500)))
    ws.close(1001)
  }
}

async function customRouteSocket (ws, req) {
  const query = new url.URL(req.url, 'ws://localhost:3000').searchParams
  const user = query.get('user')
  const routeID = query.get('routeID')
  const session = query.get('session')
  console.log(user, routeID)
  const route = await mongo.getRoutes(user).then((value) =>
    value.route.features.at(0).geometry.coordinates.map((e) => {
      return { lat: e[1], lng: e[0] }
    })
  )
  await mongo.addCustomSession(routeID, user, session)
  ws.on('message', async function incoming (data) {
    const parsedData = JSON.parse(data.toString())
    await mongo.addCustomSessionData(routeID, session, parsedData)
    if (utility.isOverLapping(parsedData, route)) {
      ws.send(JSON.stringify({ overlap: true }))
    } else {
      ws.send(JSON.stringify({ overlap: false }))
    }
  })
  ws.on('close', async function close (code, data) {
    if (code === 1000) {
      await mongo.endCustomSession(routeID, session)
    }
  })
}
