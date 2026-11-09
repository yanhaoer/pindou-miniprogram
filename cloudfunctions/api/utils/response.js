function successResponse(data = null, message = 'success') {
  return {
    code: 0,
    message,
    data
  }
}

function errorResponse(message = 'fail', code = -1, data = null) {
  return {
    code,
    message,
    data
  }
}

module.exports = {
  successResponse,
  errorResponse
}
