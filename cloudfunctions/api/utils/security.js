/**
 * 微信内容合规安全审核工具
 */

async function checkText(content, cloud) {
  if (!content || !cloud || !cloud.openapi || !cloud.openapi.security) {
    return { pass: true }
  }
  try {
    const res = await cloud.openapi.security.msgSecCheck({
      content
    })
    if (res && res.errCode === 0) {
      return { pass: true }
    }
    return { pass: false, reason: '内容包含敏感或不合规信息' }
  } catch (err) {
    if (err && err.errCode === 87014) {
      return { pass: false, reason: '内容包含敏感或不合规信息' }
    }
    return { pass: true } // 网络故障兜底
  }
}

module.exports = {
  checkText
}
