import {
  getAttendanceListRequest,
  triggerXjtuAttendanceCrawlerRequest,
  getXjtuAttendanceCrawlerStatusRequest
} from '../../api/main'

const cacheKey = 'attendanceList'
const app = getApp()
const AUTO_CRAWLER_POLL_INTERVAL_MS = 1500
const AUTO_CRAWLER_TIMEOUT_MS = 5 * 60 * 1000

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toCount(v, fallback = 0) {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.trunc(v))
  const text = String(v || '').trim()
  if (!text) return fallback
  const match = text.match(/-?\d+/)
  if (!match) return fallback
  const num = Number(match[0])
  return Number.isFinite(num) ? Math.max(0, Math.trunc(num)) : fallback
}

function toRate(v) {
  const text = String(v || '').trim()
  if (!text) return ''
  const match = text.match(/-?\d+(?:\.\d+)?\s*%?/)
  if (!match) return text
  const normalized = String(match[0]).replace(/\s+/g, '')
  return normalized.endsWith('%') ? normalized : `${normalized}%`
}

function normalizeRisk(item = {}) {
  const absences = toCount(item.absences)
  const late = toCount(item.late)
  const leave = toCount(item.leave)
  const score = absences * 2 + late + leave
  if (score >= 6) return 'danger'
  if (score >= 2) return 'warning'
  return 'normal'
}

function normalizeTermText(text) {
  const t = String(text || '').trim()
  if (t.indexOf('本周') > -1) return '本周'
  if (t.indexOf('本月') > -1) return '本月'
  if (t.indexOf('本学期') > -1) return '本学期'
  return '本学期'
}

function normalizeList(input) {
  const list = Array.isArray(input) ? input : []
  return list
    .map((item, idx) => {
      const shouldAttend = toCount(item && item.shouldAttend)
      const actualAttend = toCount(item && item.actualAttend)
      const normalCount = toCount(item && item.normalCount)
      const late = toCount(item && item.late)
      const leave = toCount(item && item.leave)
      const absences = toCount(item && item.absences)
      const attendanceRate = toRate(item && item.attendanceRate)
      const rawTeacher = (item && item.teacher) || ''
      const rawTerm = (item && item.term) || (item && item.termName) || '本学期'
      const teacherLooksLikeTerm = normalizeTermText(rawTeacher) === rawTeacher && (rawTeacher === '本周' || rawTeacher === '本月' || rawTeacher === '本学期')
      const term = normalizeTermText(teacherLooksLikeTerm ? rawTeacher : rawTerm)
      const teacher = teacherLooksLikeTerm ? '' : rawTeacher
      const risk = item && item.risk ? item.risk : normalizeRisk({ absences, late, leave })
      return {
        id: (item && item.id) || `att-${idx + 1}`,
        courseName: (item && item.courseName) || '--',
        teacher,
        term,
        shouldAttend,
        actualAttend,
        normalCount,
        late,
        leave,
        absences,
        attendanceRate,
        risk
      }
    })
    .sort((a, b) => {
      const riskWeight = { danger: 3, warning: 2, normal: 1 }
      const rw = (riskWeight[b.risk] || 0) - (riskWeight[a.risk] || 0)
      if (rw !== 0) return rw
      const aw = b.absences - a.absences
      if (aw !== 0) return aw
      return String(a.courseName).localeCompare(String(b.courseName), 'zh-Hans-CN')
    })
}

function buildByTabFromList(list) {
  const rows = Array.isArray(list) ? list : []
  return {
    week: rows.filter((item) => normalizeTermText(item && item.term) === '本周'),
    month: rows.filter((item) => normalizeTermText(item && item.term) === '本月'),
    term: rows.filter((item) => normalizeTermText(item && item.term) === '本学期')
  }
}

function mergeByTab(byTab, fallbackList) {
  const source = byTab && typeof byTab === 'object' ? byTab : {}
  const direct = {
    week: normalizeList(source.week),
    month: normalizeList(source.month),
    term: normalizeList(source.term)
  }
  const hasDirect = direct.week.length || direct.month.length || direct.term.length
  if (hasDirect) return direct
  return buildByTabFromList(normalizeList(fallbackList))
}

function normalizeSummary(input) {
  const source = input && typeof input === 'object' ? input : {}
  const shouldAttend = toCount(source.shouldAttend)
  const actualAttend =
    toCount(source.actualAttend) ||
    Math.max(0, toCount(source.normalCount) + toCount(source.late) + toCount(source.leave))
  const normalCount = toCount(source.normalCount)
  const late = toCount(source.late)
  const leave = toCount(source.leave)
  const absences = toCount(source.absences)
  const attendanceRate = toRate(source.attendanceRate || (shouldAttend > 0 ? `${((actualAttend / shouldAttend) * 100).toFixed(2)}%` : ''))
  return {
    shouldAttend,
    actualAttend,
    normalCount,
    late,
    leave,
    absences,
    attendanceRate
  }
}

function summarizeFromList(list, fallback = {}) {
  const rows = Array.isArray(list) ? list : []
  if (!rows.length) {
    return normalizeSummary(fallback)
  }
  let shouldAttend = 0
  let actualAttend = 0
  let normalCount = 0
  let late = 0
  let leave = 0
  let absences = 0

  rows.forEach((item) => {
    shouldAttend += toCount(item && item.shouldAttend)
    const actual = toCount(item && item.actualAttend)
    const normal = toCount(item && item.normalCount)
    const l = toCount(item && item.late)
    const lv = toCount(item && item.leave)
    actualAttend += actual || Math.max(0, normal + l + lv)
    normalCount += normal
    late += l
    leave += lv
    absences += toCount(item && item.absences)
  })

  const attendanceRate = shouldAttend > 0 ? `${((actualAttend / shouldAttend) * 100).toFixed(2)}%` : ''
  return {
    shouldAttend,
    actualAttend,
    normalCount,
    late,
    leave,
    absences,
    attendanceRate
  }
}

function pickListByTab(byTab, tab, fallbackList = []) {
  const source = byTab && typeof byTab === 'object' ? byTab : {}
  if (tab === 'week' && Array.isArray(source.week)) return source.week
  if (tab === 'month' && Array.isArray(source.month)) return source.month
  if (tab === 'term' && Array.isArray(source.term)) return source.term
  return Array.isArray(fallbackList) ? fallbackList : []
}

function buildPayload(raw) {
  const responseData = raw && raw.data
  if (Array.isArray(responseData)) {
    const list = normalizeList(responseData)
    const byTab = buildByTabFromList(list)
    return {
      list,
      byTab,
      summary: normalizeSummary({}),
      fetchedAt: '',
      total: list.length
    }
  }

  const data = responseData && typeof responseData === 'object' ? responseData : {}
  const list = normalizeList(data.list)
  const byTab = mergeByTab(data.byTab, list)
  return {
    list,
    byTab,
    summary: normalizeSummary(data.summary),
    fetchedAt: String(data.fetchedAt || '').trim(),
    total: toCount(data.total, list.length)
  }
}

function formatTime(raw) {
  const text = String(raw || '').trim()
  if (!text) return ''
  const d = new Date(text)
  if (Number.isNaN(d.getTime())) return text
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

Page({
  data: {
    list: [],
    listWeek: [],
    listMonth: [],
    listTerm: [],
    termTab: 'term',
    summary: {
      shouldAttend: 0,
      actualAttend: 0,
      normalCount: 0,
      late: 0,
      leave: 0,
      absences: 0,
      attendanceRate: ''
    },
    fetchedAtText: '',
    themeMode: 'light',
    pageReady: false,
    loadingRemote: false,
    loadingAttendanceSync: false
  },

  onLoad() {
    this.loadListFromCache()
  },

  onShow() {
    this.setData({
      themeMode: app.getThemeMode()
    })
    this.runPageEnterAnimation()
  },

  onUnload() {
    clearTimeout(this._pageAnimTimer)
  },

  runPageEnterAnimation() {
    this.setData({
      pageReady: false
    })
    clearTimeout(this._pageAnimTimer)
    this._pageAnimTimer = setTimeout(() => {
      this.setData({
        pageReady: true
      })
    }, 16)
  },

  loadListFromCache() {
    const cache = wx.getStorageSync(cacheKey)
    if (cache && cache.list && Array.isArray(cache.list) && cache.list.length > 0) {
      const termTab = cache.termTab || 'term'
      const listWeek = Array.isArray(cache.listWeek) ? cache.listWeek : []
      const listMonth = Array.isArray(cache.listMonth) ? cache.listMonth : []
      const listTerm = Array.isArray(cache.listTerm) ? cache.listTerm : cache.list
      const byTab = { week: listWeek, month: listMonth, term: listTerm }
      const currentList = pickListByTab(byTab, termTab, cache.list)
      this.setData({
        list: currentList,
        listWeek,
        listMonth,
        listTerm,
        termTab,
        summary: summarizeFromList(currentList, cache.summary || this.data.summary),
        fetchedAtText: cache.fetchedAtText || ''
      })
      return
    }
    if (Array.isArray(cache) && cache.length > 0) {
      this.setData({
        list: cache,
        listTerm: cache
      })
    }
  },

  async fetchAttendanceList(showToast = true) {
    this.setData({
      loadingRemote: true
    })

    try {
      const res = await getAttendanceListRequest()
      const payload = buildPayload(res)
      const termTab = this.data.termTab || 'term'
      const list = pickListByTab(payload.byTab, termTab, payload.list)
      const summary = summarizeFromList(list, payload.summary)

      this.setData({
        list,
        listWeek: payload.byTab.week,
        listMonth: payload.byTab.month,
        listTerm: payload.byTab.term,
        summary,
        fetchedAtText: formatTime(payload.fetchedAt)
      })
      wx.setStorageSync(cacheKey, {
        list,
        listWeek: payload.byTab.week,
        listMonth: payload.byTab.month,
        listTerm: payload.byTab.term,
        summary,
        termTab,
        fetchedAtText: formatTime(payload.fetchedAt)
      })
      if (showToast) {
        wx.showToast({
          title: list.length ? '考勤同步完成' : '暂无考勤数据',
          icon: 'none'
        })
      }
    } catch (err) {
      if (showToast) {
        wx.showToast({
          title: '考勤同步失败',
          icon: 'none'
        })
      }
    } finally {
      this.setData({
        loadingRemote: false
      })
    }
  },

  async waitCrawlerIdle(timeoutMs = AUTO_CRAWLER_TIMEOUT_MS) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await getXjtuAttendanceCrawlerStatusRequest()
        const running = !!(res && res.data && res.data.running)
        if (!running) return true
      } catch (err) {
        console.warn('[attendance] poll crawler status failed', err)
      }
      await sleep(AUTO_CRAWLER_POLL_INTERVAL_MS)
    }
    return false
  },

  async triggerAttendanceCrawler() {
    const account = wx.getStorageSync('account') || {}
    const stuId = String(account.stuId || '').trim()
    const password = String(account.password || '').trim()
    if (!stuId || !password) {
      wx.showToast({
        title: '请先登录后再更新',
        icon: 'none'
      })
      return false
    }
    try {
      this.setData({ loadingAttendanceSync: true })
      const res = await triggerXjtuAttendanceCrawlerRequest({ stuId, password })
      const started = !!(res && res.data && (res.data.started || res.data.running))
      if (started) {
        await this.waitCrawlerIdle()
      }
      return true
    } catch (err) {
      console.warn('[attendance] trigger crawler failed', err)
      wx.showToast({
        title: '触发考勤爬取失败',
        icon: 'none'
      })
      return false
    } finally {
      this.setData({ loadingAttendanceSync: false })
    }
  },

  onTabChange(e) {
    const tab = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.tab : ''
    if (!tab || tab === this.data.termTab) return
    const list = pickListByTab(
      {
        week: this.data.listWeek,
        month: this.data.listMonth,
        term: this.data.listTerm
      },
      tab,
      this.data.list
    )
    const summary = summarizeFromList(list, this.data.summary)
    this.setData({
      termTab: tab,
      list,
      summary
    })
    wx.setStorageSync(cacheKey, {
      list,
      listWeek: this.data.listWeek,
      listMonth: this.data.listMonth,
      listTerm: this.data.listTerm,
      summary,
      termTab: tab,
      fetchedAtText: this.data.fetchedAtText
    })
  },

  async onRefreshTap() {
    if (this.data.loadingAttendanceSync || this.data.loadingRemote) return
    const ok = await this.triggerAttendanceCrawler()
    if (!ok) return
    this.fetchAttendanceList(true)
  }
})
