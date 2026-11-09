const { successResponse, errorResponse } = require('../utils/response')
const { COLLECTIONS } = require('../config')

async function syncProfile(data = {}, ctx = {}) {
  const { openid, db: injectedDb, cloud } = ctx
  if (!openid) {
    return errorResponse('User unauthorized: missing OPENID', 40100)
  }

  const db = injectedDb || (cloud && cloud.database())
  if (!db) {
    return errorResponse('Database connection not available', 50000)
  }

  const userRef = db.collection(COLLECTIONS.USERS).doc(openid)
  const now = new Date()

  let current = null
  try {
    const res = await userRef.get()
    current = res.data
  } catch (e) {
    // 首次注册无记录
  }

  const profileData = {
    nickname: data.nickname || (current && current.nickname) || '拼豆手作人',
    avatar_url: data.avatar_url || (current && current.avatar_url) || '',
    vip_level: (current && current.vip_level) || 'pro',
    pattern_count: (current && current.pattern_count) || 0,
    created_at: (current && current.created_at) || now,
    updated_at: now
  }

  await userRef.set({ data: profileData })

  return successResponse({
    openid,
    ...profileData
  })
}

async function getProfile(data = {}, ctx = {}) {
  const { openid, db: injectedDb, cloud } = ctx
  if (!openid) {
    return errorResponse('User unauthorized', 40100)
  }

  const db = injectedDb || (cloud && cloud.database())
  if (!db) {
    return errorResponse('Database connection not available', 50000)
  }

  const userRef = db.collection(COLLECTIONS.USERS).doc(openid)

  try {
    const res = await userRef.get()
    return successResponse({
      openid,
      ...res.data
    })
  } catch (err) {
    return syncProfile({}, ctx)
  }
}

module.exports = {
  syncProfile,
  getProfile
}
