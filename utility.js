const geometry = require('node-geometry-library')

module.exports = {
  computeDistance: function (coordinatesList) {
    return geometry.SphericalUtil.computeLength(coordinatesList) / 1000
  },

  isOverLapping: function (coordinate, coordinatesList) {
    const latlng = {
      lat: coordinate.lat,
      lng: coordinate.lng
    }
    return geometry.PolyUtil.isLocationOnPath(latlng, coordinatesList, 10)
  },

  filterCoordinates: function (coordinatesList) {
    const filtered = []
    let current = coordinatesList.at(0).overlap
    let position = 0
    let trimList = []

    for (const i in this.numberRange(0, coordinatesList.length)) {
      if (coordinatesList.at(i).overlap !== current) {
        trimList = coordinatesList.slice(position, coordinatesList.length)
        const filter = coordinatesList.slice(
          trimList.findIndex((value) => value.overlap === current) + position,
          i
        )
        filtered.push(filter)
        current = coordinatesList.at(i).overlap
        position = i
      }
    }

    trimList = coordinatesList.slice(position, coordinatesList.length)
    filtered.push(
      coordinatesList.slice(
        trimList.findIndex((value) => value.overlap === current) + position,
        coordinatesList.length
      )
    )
    return filtered
  },

  numberRange: function (start, end) {
    return new Array(end - start).fill().map((_d, i) => i + start)
  },

  getCoordinatesList: function (coveredArea) {
    const coordinatesList = []
    coveredArea.forEach((session) => {
      const sessionCoordinates = []
      session.forEach((element) => {
        sessionCoordinates.push({
          lat: element.lat,
          lng: element.lng
        })
      })
      coordinatesList.push(sessionCoordinates)
    })
    return coordinatesList
  }
}
