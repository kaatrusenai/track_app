const statusMessages = {
  200: "ok",
  400: "Bad request",
  401: "The password you entered is incorrect. Please try again.",
  402: "You cannot sign in on multiple devices. Please sign out and try again.",
  404: "You are not registered. Sorry for the inconvenience.",
  500: "It looks like the server is temporarily down. Please try again later.",
};

module.exports = {
  authJson: function (code) {
    return {
      status: code,
      message: statusMessages[code],
    };
  },

  dataJson: function (code, data) {
    return {
      status: code,
      message: statusMessages[code],
      data: data == null ? [] : data,
    };
  },
};
