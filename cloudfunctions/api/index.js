const { successResponse, errorResponse } = require('./utils/response')
const userController = require('./controllers/user')
const patternController = require('./controllers/pattern')
const plazaController = require('./controllers/plaza')

let cloud = null
try {
  cloud = require('wx-server-sdk')
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
} catch (e) {
  // Mock fallback for test environment
}

const routes = {
  'system.ping': async (data, context) => {
    return successResponse({ echo: data && data.echo, openid: context.openid })
  },
  'user.syncProfile': userController.syncProfile,
  'user.getProfile': userController.getProfile,
  'pattern.saveDraft': patternController.saveDraft,
  'pattern.listMine': patternController.listMine,
  'pattern.getDetail': patternController.getDetail,
  'pattern.delete': patternController.deleteDraft,
  'plaza.publish': plazaController.publish,
  'plaza.list': plazaController.list,
  'plaza.toggleLike': plazaController.toggleLike,
  'plaza.fork': plazaController.fork
}

function registerRoute(action, handler) {
  routes[action] = handler
}

async function main(event = {}, context = {}) {
  const action = event && event.action
  const data = (event && event.data) != null ? event.data : {}
  if (!action || typeof action !== 'string') {
    return errorResponse('action is required and must be a string', 40000)
  }

  // 获取微信上下文 OPENID
  let wxContext = {}
  if (cloud && typeof cloud.getWXContext === 'function') {
    wxContext = cloud.getWXContext() || {}
  }
  const openid = wxContext.OPENID || context.OPENID || ''

  const handler = routes[action]
  if (!handler || typeof handler !== 'function') {
    return errorResponse(`Unknown action: ${action}`, 40400)
  }

  try {
    return await handler(data, { ...context, ...wxContext, openid, cloud })
  } catch (err) {
    console.error(`[API Error] action=${action}:`, err)
    return errorResponse(err.message || 'Internal server error', 50000)
  }
}

module.exports = {
  main,
  registerRoute,
  routes
}
