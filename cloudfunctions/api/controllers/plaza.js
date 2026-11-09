const { successResponse, errorResponse } = require('../utils/response')
const defaultSecurity = require('../utils/security')
const { COLLECTIONS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = require('../config')

/**
 * 发布作品到灵感广场
 */
async function publish(data = {}, ctx = {}) {
  const { openid, db: injectedDb, cloud, security = defaultSecurity } = ctx
  if (!openid) return errorResponse('Unauthorized', 40100)

  const {
    pattern_id,
    title = '',
    tag = '全部',
    preview_url = '',
    size_desc = '标准',
    colors_count = 0
  } = data

  if (!title) return errorResponse('title is required', 40001)

  // 微信安全审核前置
  const secResult = await security.checkText(`${title} ${tag}`, cloud)
  if (!secResult.pass) {
    return errorResponse(secResult.reason || '内容存在不合规字符，请修改后重试', 40001)
  }

  const db = injectedDb || (cloud && cloud.database())
  if (!db) return errorResponse('Database connection not available', 50000)

  // 校验关联图纸所有权 (IDOR 防护)
  if (pattern_id) {
    let pat = null
    try {
      pat = await db.collection(COLLECTIONS.PATTERNS).doc(pattern_id).get()
    } catch (e) {
      return errorResponse('Pattern not found', 40400)
    }

    if (!pat || !pat.data) {
      return errorResponse('Pattern not found', 40400)
    }

    if (pat.data._openid && pat.data._openid !== openid) {
      return errorResponse('Permission denied', 40300)
    }

    try {
      await db.collection(COLLECTIONS.PATTERNS).doc(pattern_id).update({
        data: { is_public: true }
      })
    } catch (e) {}
  }

  const now = new Date()

  // 读取用户昵称与头像作为冗余字段
  let authorNickname = '手作达人'
  let authorAvatar = ''
  try {
    const user = await db.collection(COLLECTIONS.USERS).doc(openid).get()
    if (user && user.data) {
      authorNickname = user.data.nickname || authorNickname
      authorAvatar = user.data.avatar_url || ''
    }
  } catch (e) {}

  const postDoc = {
    pattern_id,
    author_openid: openid,
    author_nickname: authorNickname,
    author_avatar: authorAvatar,
    title,
    tag,
    size_desc,
    colors_count,
    preview_url,
    like_count: 0,
    fork_count: 0,
    audit_status: 'approved',
    created_at: now
  }

  const res = await db.collection(COLLECTIONS.PLAZA_POSTS).add({ data: postDoc })

  return successResponse({ id: res._id, created_at: now })
}

/**
 * 获取灵感广场作品列表
 */
async function list(data = {}, ctx = {}) {
  const { openid, db: injectedDb, cloud } = ctx
  const db = injectedDb || (cloud && cloud.database())
  if (!db) return errorResponse('Database connection not available', 50000)

  const { category } = data
  const page = Math.max(1, Number(data.page) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(data.pageSize) || DEFAULT_PAGE_SIZE))
  const skip = (page - 1) * pageSize

  let query = db.collection(COLLECTIONS.PLAZA_POSTS)
  if (category && category !== '全部') {
    query = query.where({ tag: category })
  }

  const res = await query.orderBy('created_at', 'desc').skip(skip).limit(pageSize).get()
  const items = (res && res.data) || []

  // 批量补充 hasLiked 状态
  const listWithLikes = await Promise.all(items.map(async (item) => {
    let hasLiked = false
    if (openid) {
      try {
        const likeKey = `${openid}_${item._id}`
        const lk = await db.collection(COLLECTIONS.LIKES).doc(likeKey).get()
        if (lk && lk.data) hasLiked = true
      } catch (e) {}
    }
    return { ...item, hasLiked }
  }))

  return successResponse({
    list: listWithLikes,
    page,
    pageSize
  })
}

/**
 * 点赞 / 取消点赞作品
 */
async function toggleLike(data = {}, ctx = {}) {
  const { openid, db: injectedDb, cloud } = ctx
  if (!openid) return errorResponse('Unauthorized', 40100)

  const { post_id } = data
  if (!post_id) return errorResponse('post_id is required', 40003)

  const db = injectedDb || (cloud && cloud.database())
  if (!db) return errorResponse('Database connection not available', 50000)

  const _ = db.command
  const inc = (_ && typeof _.inc === 'function') ? _.inc.bind(_) : (n) => ({ $inc: n })

  const likeKey = `${openid}_${post_id}`
  const likeRef = db.collection(COLLECTIONS.LIKES).doc(likeKey)

  let liked = false
  let isExisting = false
  try {
    const existing = await likeRef.get()
    if (existing && existing.data) {
      isExisting = true
    }
  } catch (e) {
    isExisting = false
  }

  if (isExisting) {
    // 已点赞 -> 取消
    await likeRef.remove()
    await db.collection(COLLECTIONS.PLAZA_POSTS).doc(post_id).update({
      data: { like_count: inc(-1) }
    })
    liked = false
  } else {
    // 未点赞 -> 新增点赞
    await likeRef.set({
      data: {
        post_id,
        user_openid: openid,
        created_at: new Date()
      }
    })
    await db.collection(COLLECTIONS.PLAZA_POSTS).doc(post_id).update({
      data: { like_count: inc(1) }
    })
    liked = true
  }

  return successResponse({ liked, post_id })
}

/**
 * 复刻（克隆）图纸到个人创作列表
 */
async function fork(data = {}, ctx = {}) {
  const { openid, db: injectedDb, cloud } = ctx
  if (!openid) return errorResponse('Unauthorized', 40100)

  const { post_id } = data
  if (!post_id) return errorResponse('post_id is required', 40003)

  const db = injectedDb || (cloud && cloud.database())
  if (!db) return errorResponse('Database connection not available', 50000)

  const _ = db.command
  const inc = (_ && typeof _.inc === 'function') ? _.inc.bind(_) : (n) => ({ $inc: n })

  let post
  try {
    post = await db.collection(COLLECTIONS.PLAZA_POSTS).doc(post_id).get()
  } catch (e) {
    return errorResponse('Plaza post not found', 40401)
  }

  const patternId = post && post.data && post.data.pattern_id
  if (!patternId) return errorResponse('Source pattern not found', 40401)

  let sourcePattern
  try {
    sourcePattern = await db.collection(COLLECTIONS.PATTERNS).doc(patternId).get()
  } catch (e) {
    return errorResponse('Source pattern not found', 40401)
  }

  const source = sourcePattern && sourcePattern.data
  if (!source) return errorResponse('Source pattern not found', 40401)

  // 累加帖子的 fork_count
  try {
    await db.collection(COLLECTIONS.PLAZA_POSTS).doc(post_id).update({
      data: { fork_count: inc(1) }
    })
  } catch (e) {}

  // 克隆到当前用户名下
  const newPattern = {
    ...source,
    _openid: openid,
    title: `${source.title || '未命名图纸'} (副本)`,
    fork_from_id: patternId,
    is_public: false,
    created_at: new Date(),
    updated_at: new Date()
  }
  delete newPattern._id

  const addRes = await db.collection(COLLECTIONS.PATTERNS).add({ data: newPattern })

  // 累加用户作品数
  try {
    await db.collection(COLLECTIONS.USERS).doc(openid).update({
      data: { pattern_count: inc(1) }
    })
  } catch (e) {}

  return successResponse({
    new_pattern_id: addRes._id,
    pattern: newPattern
  })
}

module.exports = {
  publish,
  list,
  toggleLike,
  fork
}
