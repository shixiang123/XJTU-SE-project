import createRequest from '../utils/request'

function getBaseUrl() {
  const appBaseUrl = String((getApp() && getApp().getConfig('baseUrl')) || '')
  const lanBaseUrl = String(wx.getStorageSync('lanBaseUrl') || '').trim()
  return lanBaseUrl || appBaseUrl
}

export function loginRequest(data) {
  return createRequest({
    url: '/login',
    method: 'POST',
    data,
    needLogin: false,
    loading: false
  })
}

export function getScoreListRequest(data) {
  return createRequest({
    url: '/scores',
    data
  })
}

export function getRawScoreListRequest(data) {
  return createRequest({
    url: '/raw-scores',
    data
  })
}

export function getAttendanceListRequest(data) {
  return createRequest({
    url: '/attendance',
    data
  })
}

export function getCourseListRequest(data) {
  return createRequest({
    url: '/courses',
    data
  })
}

export function getResourceListRequest(data) {
  return createRequest({
    url: '/resources',
    data,
    needLogin: false,
    loading: false
  })
}

export function uploadResourceFileRequest({
  filePath = '',
  course = '未分类课程',
  name = 'file',
  displayName = ''
} = {}) {
  return new Promise((resolve, reject) => {
    const baseUrl = getBaseUrl()
    const token = wx.getStorageSync('token') || ''
    wx.uploadFile({
      url: `${baseUrl}/resources/upload`,
      filePath,
      name,
      formData: { course, displayName },
      header: {
        token
      },
      success: (res) => {
        try {
          const data = JSON.parse(res.data || '{}')
          if (data && Number(data.code) === 0) {
            resolve(data)
            return
          }
          reject(new Error((data && data.msg) || 'UPLOAD_FAILED'))
        } catch (err) {
          reject(err)
        }
      },
      fail: (err) => reject(err)
    })
  })
}

export function deleteResourceFileRequest(id) {
  return createRequest({
    url: `/resources/${encodeURIComponent(id)}`,
    method: 'DELETE'
  })
}

export function triggerXjtuCrawlerRequest(data) {
  return createRequest({
    url: '/crawl/xjtu/trigger',
    method: 'POST',
    data,
    loading: false
  })
}

export function triggerXjtuCourseCrawlerRequest(data) {
  return createRequest({
    url: '/crawl/xjtu/course/trigger',
    method: 'POST',
    data,
    loading: false
  })
}

export function triggerXjtuScoreCrawlerRequest(data) {
  return createRequest({
    url: '/crawl/xjtu/score/trigger',
    method: 'POST',
    data,
    loading: false
  })
}

export function getXjtuCrawlerStatusRequest(data) {
  return createRequest({
    url: '/crawl/xjtu/status',
    data,
    loading: false
  })
}

export function triggerSyxtDdlCrawlerRequest(data) {
  return createRequest({
    url: '/crawl/syxt/ddl/trigger',
    method: 'POST',
    data,
    loading: false
  })
}

export function getSyxtDdlCrawlerStatusRequest(data) {
  return createRequest({
    url: '/crawl/syxt/ddl/status',
    data,
    loading: false
  })
}

export function triggerXjtuAttendanceCrawlerRequest(data) {
  return createRequest({
    url: '/crawl/xjtu/attendance/trigger',
    method: 'POST',
    data,
    loading: false
  })
}

export function getXjtuAttendanceCrawlerStatusRequest(data) {
  return createRequest({
    url: '/crawl/xjtu/attendance/status',
    data,
    loading: false
  })
}

export function getDdlListRequest(data) {
  return createRequest({
    url: '/ddl',
    data
  })
}

export function initLoginRequest(data) {
  return createRequest({
    url: '/login-init',
    data,
    needLogin: false
  })
}

export function loginWithVerifyRequest(data) {
  return createRequest({
    url: '/login-verify',
    method: 'POST',
    data,
    needLogin: false,
    loading: false
  })
}
