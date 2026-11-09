const { successResponse, errorResponse } = require('../utils/response')
const { COLLECTIONS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = require('../config')

async function saveDraft(data = {}, ctx = {}) {
  const { openid, db: injectedDb, cloud } = ctx
  if (!openid) return errorResponse('Unauthorized', 40100)

  const {
    id,
    title = '未命名图纸',
    width,
    height,
    brand = 'artkal',
    grid_data,
    color_summary = {},
    preview_url = '',
    fork_from_id
  } = data

  if (!width || !height) {
    return errorResponse('width and height are required', 40002)
  }

  const db = injectedDb || (cloud && cloud.database())
  if (!db) {
    return errorResponse('Database connection not available', 50000)
  }

  const now = new Date()

  if (id) {
    // 更新既有图纸
    const ref = db.collection(COLLECTIONS.PATTERNS).doc(id)
    let existingDoc = null
    try {
      const res = await ref.get()
      existingDoc = res.data
    } catch (e) {
      return errorResponse('Pattern not found', 40400)
    }

    if (!existingDoc) {
      return errorResponse('Pattern not found', 40400)
    }

    if (existingDoc._openid && existingDoc._openid !== openid) {
      return errorResponse('Permission denied', 40300)
    }

    await ref.update({
      data: {
        title,
        width,
        height,
        brand,
        grid_data,
        color_summary,
        preview_url,
        updated_at: now
      }
    })
    return successResponse({ id, updated_at: now })
  }

  // 新增图纸
  const patternDoc = {
    _openid: openid,
    title,
    width,
    height,
    brand,
    grid_data,
    color_summary,
    preview_url,
    is_public: false,
    fork_from_id: fork_from_id || null,
    created_at: now,
    updated_at: now
  }

  const res = await db.collection(COLLECTIONS.PATTERNS).add({ data: patternDoc })
  const newId = res._id

  // 累加用户作品数
  try {
    const _ = db.command
    await db.collection(COLLECTIONS.USERS).doc(openid).update({
      data: _ && _.inc ? { pattern_count: _.inc(1) } : { pattern_count: 1 }
    })
  } catch (e) {}

  return successResponse({ id: newId, created_at: now })
}

async function listMine(data = {}, ctx = {}) {
  const { openid, db: injectedDb, cloud } = ctx
  if (!openid) return errorResponse('Unauthorized', 40100)

  const db = injectedDb || (cloud && cloud.database())
  if (!db) {
    return errorResponse('Database connection not available', 50000)
  }

  const page = Math.max(1, Number(data.page) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(data.pageSize) || DEFAULT_PAGE_SIZE))
  const skip = (page - 1) * pageSize

  const res = await db.collection(COLLECTIONS.PATTERNS)
    .where({ _openid: openid })
    .field({ grid_data: false }) // 排除大矩阵，保障列表秒出
    .orderBy('updated_at', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get()

  return successResponse({
    list: (res && res.data) || [],
    page,
    pageSize
  })
}

async function getDetail(data = {}, ctx = {}) {
  const { openid, db: injectedDb, cloud } = ctx
  const { id } = data
  if (!id) return errorResponse('id is required', 40003)

  const db = injectedDb || (cloud && cloud.database())
  if (!db) {
    return errorResponse('Database connection not available', 50000)
  }

  let pattern = null
  try {
    const res = await db.collection(COLLECTIONS.PATTERNS).doc(id).get()
    if (!res || !res.data) {
      return errorResponse('Pattern not found', 40400)
    }
    pattern = res.data
  } catch (e) {
    return errorResponse('Pattern not found', 40400)
  }

  if (!pattern.is_public && pattern._openid && pattern._openid !== openid) {
    return errorResponse('Permission denied', 40300)
  }

  return successResponse(pattern)
}

async function deleteDraft(data = {}, ctx = {}) {
  const { openid, db: injectedDb, cloud } = ctx
  if (!openid) return errorResponse('Unauthorized', 40100)

  const { id } = data
  if (!id) return errorResponse('id is required', 40003)

  const db = injectedDb || (cloud && cloud.database())
  if (!db) {
    return errorResponse('Database connection not available', 50000)
  }

  const docRef = db.collection(COLLECTIONS.PATTERNS).doc(id)
  let patternDoc = null
  try {
    const res = await docRef.get()
    patternDoc = res.data
  } catch (e) {
    return errorResponse('Pattern not found', 40400)
  }

  if (!patternDoc) {
    return errorResponse('Pattern not found', 40400)
  }

  if (patternDoc._openid && patternDoc._openid !== openid) {
    return errorResponse('Permission denied', 40300)
  }

  await docRef.remove()

  // 递减用户作品数
  try {
    const _ = db.command
    await db.collection(COLLECTIONS.USERS).doc(openid).update({
      data: _ && _.inc ? { pattern_count: _.inc(-1) } : { pattern_count: 0 }
    })
  } catch (e) {}

  return successResponse({ id, deleted: true })
}

module.exports = {
  saveDraft,
  listMine,
  getDetail,
  deleteDraft
}
