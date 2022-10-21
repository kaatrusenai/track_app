const mongoose = require('mongoose')
const response = require('./response')
const utility = require('./utility')

const timestamp = new Date()

const userSchema = mongoose.Schema({
  name: String,
  mobileNumber: String,
  email: String,
  username: String,
  mobileID: String,
  password: String,
  vehicleID: String,
  deviceID: String,
  lpNumber: String,
  rcNumber: String,
  yor: String,
  vehicleType: String,
  vehicleModel: String,
  routes: Array
})

const coordinateSchema = mongoose.Schema(
  {
    lat: Number,
    lng: Number,
    overlap: Boolean,
    timestamp: String
  },
  {
    autoCreate: false,
    autoIndex: false
  }
)

const sessionSchema = mongoose.Schema(
  {
    session: { type: Number, unique: true },
    status: { type: String, default: 'open' },
    started: { type: Date, default: timestamp.toISOString() },
    distance: { type: Number, default: 0 },
    totalDistance: { type: Number, default: 0 },
    incentive: { type: Number, default: 0 },
    fuel: { type: Number, default: 0 },
    ended: Date,
    coordinates: [coordinateSchema]
  },
  {
    autoCreate: false,
    autoIndex: false
  }
)

const customSessionDataSchema = mongoose.Schema(
  {
    ax: Number,
    ay: Number,
    az: Number,
    gx: Number,
    gy: Number,
    gz: Number,
    lat: Number,
    lng: Number,
    label: String,
    timestamp: Number
  },
  {
    autoCreate: false,
    autoIndex: false
  }
)

const customSessionSchema = mongoose.Schema(
  {
    routeID: String,
    session: String,
    user: String,
    routeDistance: { type: Number, default: 0 },
    coveredDistance: { type: Number, default: 0 },
    status: { type: String, default: 'open' },
    started: { type: Date, default: timestamp.toISOString() },
    ended: Date,
    data: [customSessionDataSchema]
  },
  {
    autoCreate: false,
    autoIndex: true
  }
)

const trackingSchema = mongoose.Schema({
  user: { type: String, unique: true },
  cumDistance: { type: Number, default: 0 },
  cumIncentives: { type: Number, default: 0 },
  sessionsCount: { type: Number, default: 0 },
  sessions: [sessionSchema]
})

const deviceSchema = mongoose.Schema(
  {
    deviceID: Number,
    deviceStatus: Boolean
  },
  {
    autoCreate: false,
    autoIndex: false
  }
)

const User = mongoose.model('userCred', userSchema)
const Tracking = mongoose.model('tracking', trackingSchema)
const Session = mongoose.model('session', sessionSchema)
const Device = mongoose.model('device', deviceSchema)
const CustomSession = mongoose.model('customSession', customSessionSchema)
const CustomSessionData = mongoose.model('customSessionData', customSessionDataSchema)

module.exports = {
  // useradmin:httpdata@3.109.93.19:27017

  user: function () {
    return User
  },

  session: function () {
    return CustomSession
  },

  connect: async function () {
    // mongodb://mumbai11:study77%23@3.7.66.36
    mongoose.connect('mongodb://localhost:27017/admin', (err) => {
      if (err) {
        console.log('mongo connection error: ' + err)
        this.connect()
      } else {
        console.log('db connected')
      }
    })
    return null
  },

  checkMobileId: async function (id, email) {
    const user = await this.getUser(email)
    if (user.mobileID === id) {
      return true
    } else {
      return true
    }
  },

  getUser: async function (email) {
    const user = await User.findOne({
      email: email
    })
    return user
  },

  signout: async function (email) {
    const user = await this.getUser(email)
    user.mobileID = ''
    await user.save()
    return null
  },

  addMobileID: async function (id, user) {
    user.mobileID = id
    await user.save()
    return null
  },

  getSessionHistory: async function (email) {
    const userTracking = await this.getUserTracking(email)
    return userTracking.sessions.length === 0
      ? []
      : userTracking.sessions.filter((session) => session.status === 'closed')
  },

  getCustomSessionHistory: async function (email) {
    const sessions = await CustomSession.find({ user: email, status: 'closed' })
    return sessions
  },

  getCoveredArea: async function (startTime, currentUser) {
    const startedAt = new Date(startTime ?? timestamp.toISOString())
    const area = []
    await Tracking.find().then((value) =>
      value.forEach((user) => {
        if (currentUser != null) {
          if (user.user === currentUser) {
            const lastSessionTime = user.sessions.at(-1).started
            user.sessions.forEach((session) => {
              if (session.started !== lastSessionTime) {
                area.push(session.coordinates)
              }
            })
          } else {
            user.sessions.forEach((session) => {
              const sessionCoordinates = []
              session.coordinates.forEach((coordinate) => {
                const time = new Date(coordinate.timestamp)
                if (startedAt.getTime() > time.getTime()) {
                  sessionCoordinates.push(coordinate)
                }
              })
              area.push(sessionCoordinates)
            })
          }
        } else {
          user.sessions.forEach((session) => {
            area.push(session.coordinates)
          })
        }
      })
    )
    return area
  },

  getDashBoardData: async function (email) {
    const userTracking = await this.getUserTracking(email)
    return {
      distance: userTracking.cumDistance,
      incentive: userTracking.cumIncentives,
      session: userTracking.sessionsCount
    }
  },

  getActivityData: async function (email) {
    const user = await CustomSession.find({ user: email, status: 'closed' })
    const session = user.length
    let distance = 0
    let data = 0
    user.forEach((v, i) => {
      distance += v.coveredDistance
      data += v.data.length
    })
    return {
      sessions: session,
      distance: distance,
      data: data
    }
  },

  getUserTracking: async function (email) {
    const userTracking = await Tracking.findOne({
      user: email
    }).then((value) => value)
    if (userTracking == null) {
      await this.createTrackingProfile(email)
      return await this.getUserTracking(email)
    } else {
      return userTracking
    }
  },

  getDeviceID: async function (email) {
    return await User.findOne({ email: email }).then((user) => user.deviceID)
  },

  getDeviceStatus: async function (deviceID) {
    return await Device.findOne({ deviceID: deviceID })
  },

  createTrackingProfile: async function (email) {
    await Tracking.create({
      user: email
    })
    await this.getUserTracking(email)
    return null
  },

  addNewSession: async function (userTracking) {
    if (this.isSessionClosed(userTracking)) {
      userTracking.sessions.push(
        Session({
          session: userTracking.sessions.length + 1
        })
      )
      await userTracking.save()
    }
    return null
  },

  updateSession: async function (user, coordinates, deviceID) {
    let updated
    let deviceStatus
    const userTracking = await this.getUserTracking(user)
    const currentSession = userTracking.sessions.at(-1)
    let coveredAreaList = []
    try {
      coveredAreaList = await this.getCoveredArea(
        currentSession.coordinates.at(-1).timestamp,
        user
      )
    } catch {
      coveredAreaList = await this.getCoveredArea(currentSession.started, user)
    }
    const coveredArea = utility.getCoordinatesList(coveredAreaList)
    if (Array.isArray(coordinates)) {
      coordinates.forEach((coordinate) => {
        coordinate.overlap = false
        for (const index in utility.numberRange(0, coveredArea.length)) {
          const overlap = utility.isOverLapping(
            coordinate,
            coveredArea.at(index)
          )
          if (overlap) {
            coordinate.overlap = true
            break
          }
        }
        const currentSessionCoordinates = currentSession.coordinates
        if (
          utility.isOverLapping(
            coordinate,
            currentSessionCoordinates.slice(
              0,
              currentSessionCoordinates.length - 4
            )
          )
        ) {
          coordinate.overlap = true
        }
        currentSession.coordinates.push(coordinate)
      })
    } else {
      coordinates.overlap = false
      for (const index in utility.numberRange(0, coveredArea.length)) {
        const overlap = utility.isOverLapping(
          coordinates,
          coveredArea.at(index)
        )
        if (overlap) {
          coordinates.overlap = true
          break
        }
      }
      currentSession.coordinates.push(coordinates)
    }
    currentSession.coordinates.sort(
      (a, b) =>
        new Date(a.timestamp).getDate() - new Date(b.timestamp).getTime()
    )
    const filteredCoordinates = utility.filterCoordinates(
      currentSession.coordinates
    )
    currentSession.distance = 0.0
    filteredCoordinates.forEach((value) => {
      const distance = utility.computeDistance(value)
      currentSession.totalDistance += distance
      if (!value.at(0).overlap) {
        currentSession.distance += distance
      }
    })
    currentSession.distance = parseFloat(currentSession.distance.toFixed(1))
    currentSession.incentive = currentSession.distance * 10
    currentSession.fuel = currentSession.totalDistance * 3
    try {
      await userTracking.save().then((value) => {
        updated = value.sessions.at(-1)
      })
      if (deviceID != null) {
        deviceStatus = await this.getDeviceStatus(deviceID).then(
          (value) => JSON.parse(JSON.stringify(value)).deviceStatus
        )
      }
      const data = {
        distance: updated.distance,
        incentive: updated.incentive,
        deviceStatus: deviceStatus,
        coveredArea: coveredAreaList,
        coordinates: filteredCoordinates
      }
      return response.dataJson(200, [data])
    } catch (e) {
      console.log(`error saving: ${e}`)
      return await this.updateSession(user, coordinates, deviceID)
    }
  },

  checkEmptySession: async function (userTracking) {
    try {
      const isEmpty = userTracking.sessions.at(-1).coordinates.length === 0
      if (isEmpty) {
        userTracking.sessions.pop()
        await userTracking.save()
      }
    } catch { }
    return null
  },

  isSessionClosed: function (userTracking) {
    try {
      return userTracking.sessions.at(-1).status === 'closed'
    } catch {
      return true
    }
  },

  closeSession: async function (user, coordinates) {
    const userTracking = await this.getUserTracking(user)
    if (!this.isSessionClosed(userTracking)) {
      await this.updateSession(user, coordinates)
      const newTracking = await this.getUserTracking(user)
      newTracking.sessions.at(-1).status = 'closed'
      newTracking.sessions.at(-1).ended = timestamp.toISOString()
      this.updateCumValues(newTracking)
      await newTracking.save()
    }
    return null
  },

  updateCumValues: function (userTracking) {
    let cumDistance = 0
    let cumIncentives = 0
    let sessionsCount = 0
    userTracking.sessions.forEach((session) => {
      sessionsCount++
      cumDistance += parseFloat(session.distance)
      cumIncentives += parseFloat(session.incentive)
    })
    userTracking.cumDistance = parseFloat(cumDistance.toFixed(1))
    userTracking.cumIncentives = parseFloat(cumIncentives.toFixed(1))
    userTracking.sessionsCount = sessionsCount
  },

  getRoutes: async function (user) {
    const res = await User.findOne({ email: user })
    const queryList = []
    for (let index = 0; index < res.routes.length; index++) {
      queryList.push(CustomSession.find({ user: user, status: 'closed', routeID: res.routes[index].features[0].properties.name }).then((value) => { return { session: String(value.length + 1), route: res.routes[index] } }))
    }
    const result = await Promise.all(queryList)
    return result
  },

  addCustomSession: async function (routeID, user, session) {
    const doc = await CustomSession.find({ routeID: routeID, session: session, user: user })
    if (doc.length === 0) {
      try {
        const customSession = CustomSession(
          {
            routeID: routeID,
            user: user,
            session: session,
            coveredDistance: 0,
            routeDistance: 0
          }
        )
        await customSession.save()
      } catch (e) {
        console.log(e)
      }
    }
  },

  addCustomSessionData: async function (routeID, session, data) {
    const customSession = await CustomSession.findOne({ routeID: routeID, session: session })
    customSession.coveredDistance = data.coveredDistance
    customSession.routeDistance = data.routeDistance
    delete data.coveredDistance
    delete data.routeDistance
    customSession.data.push(CustomSessionData(data))
    console.log(data)
    await customSession.save()
  },

  endCustomSession: async function (routeID, session) {
    const customSession = await CustomSession.findOne({ routeID: routeID, session: session })
    customSession.ended = timestamp.toISOString()
    customSession.status = 'closed'
    await customSession.save()
  }

}
