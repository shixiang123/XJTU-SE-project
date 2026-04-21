import {
  getScoreListRequest,
  getRawScoreListRequest,
  triggerXjtuScoreCrawlerRequest,
  getXjtuCrawlerStatusRequest
} from '../../api/main'

const app = getApp()
const scoreCacheKey = 'scores'
const rawScoreCacheKey = 'rawScores'
const AUTO_CRAWLER_POLL_INTERVAL_MS = 1500
const AUTO_CRAWLER_TIMEOUT_MS = 5 * 60 * 1000

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

Page({
  data: {
    list: [],
    rawList: [],
    termOptions: [],
    displayList: [],
    termIndex: 0,
    themeMode: 'light',
    pageReady: false,
    showScoreDetail: false,
    activeScoreDetail: null,
    selectedCourseMap: {},
    avgResult: '--',
    loadingScoreSync: false
  },

  onLoad() {
    this.getList()
    this.getRawList()
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

  getList() {
    const cache = wx.getStorageSync(scoreCacheKey)
    if (cache) {
      this.applyScoreList(cache)
      return
    }
    this.applyScoreList([])
  },

  getRawList() {
    const cache = wx.getStorageSync(rawScoreCacheKey)
    if (cache) {
      this.setData({
        rawList: cache
      })
      return
    }
    this.setData({
      rawList: []
    })
  },

  update() {
    this.updateWithCrawler()
  },

  async waitCrawlerIdle(timeoutMs = AUTO_CRAWLER_TIMEOUT_MS) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await getXjtuCrawlerStatusRequest()
        const running = !!(res && res.data && res.data.running)
        if (!running) return true
      } catch (err) {
        console.warn('[score] poll crawler status failed', err)
      }
      await sleep(AUTO_CRAWLER_POLL_INTERVAL_MS)
    }
    return false
  },

  async triggerScoreCrawler() {
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
      this.setData({ loadingScoreSync: true })
      const res = await triggerXjtuScoreCrawlerRequest({ stuId, password })
      const started = !!(res && res.data && (res.data.started || res.data.running))
      if (started) {
        await this.waitCrawlerIdle()
      }
      return true
    } catch (err) {
      console.warn('[score] trigger crawler failed', err)
      wx.showToast({
        title: '触发成绩爬取失败',
        icon: 'none'
      })
      return false
    } finally {
      this.setData({ loadingScoreSync: false })
    }
  },

  async updateWithCrawler() {
    const ok = await this.triggerScoreCrawler()
    if (!ok) return
    Promise.all([this.updateValidScore(), this.updateRawScore()])
      .then(() => {
        wx.showToast({
          title: '更新成功',
          icon: 'success'
        })
      })
      .catch(() => {})
  },

  updateValidScore() {
    return getScoreListRequest()
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : []
        this.applyScoreList(list)
        wx.setStorageSync(scoreCacheKey, list)
        return list
      })
      .catch(() => [])
  },

  updateRawScore() {
    return getRawScoreListRequest()
      .then((res) => {
        const rawList = Array.isArray(res.data) ? res.data : []
        this.setData({
          rawList
        })
        wx.setStorageSync(rawScoreCacheKey, rawList)
        return rawList
      })
      .catch(() => {
        this.setData({
          rawList: []
        })
        wx.removeStorageSync(rawScoreCacheKey)
        return []
      })
  },

  normalizeTermIndex(termIndex, targetList = []) {
    if (!Array.isArray(targetList) || targetList.length === 0) {
      return 0
    }
    const index = Number(termIndex) || 0
    return Math.min(targetList.length - 1, Math.max(0, index))
  },

  buildAllTermRow(list = []) {
    const allScoreList = []
    ;(list || []).forEach((term) => {
      const termName = term && term.termName ? term.termName : '--'
      const scoreList = Array.isArray(term && term.scoreList) ? term.scoreList : []
      scoreList.forEach((item, idx) => {
        allScoreList.push({
          ...item,
          __termName: termName,
          __idx: `${termName}-${idx}`
        })
      })
    })
    return {
      termName: '全部学期',
      scoreList: allScoreList
    }
  },

  buildTermOptions(displayList = []) {
    return displayList.map((item) => item.termName || '--')
  },

  applyScoreList(list = []) {
    const safeList = Array.isArray(list) ? list : []
    const displayList = [this.buildAllTermRow(safeList), ...safeList]
    const termOptions = this.buildTermOptions(displayList)
    const nextTermIndex = this.normalizeTermIndex(this.data.termIndex, displayList)
    this.setData({
      list: safeList,
      displayList,
      termOptions,
      termIndex: nextTermIndex
    })
    this.resetAverageSelection()
  },

  getCurrentTerm() {
    const displayList = Array.isArray(this.data.displayList) ? this.data.displayList : []
    if (!displayList.length) return { termName: '--', scoreList: [] }
    return displayList[this.data.termIndex] || displayList[0]
  },

  getCurrentScoreList() {
    const term = this.getCurrentTerm()
    return Array.isArray(term.scoreList) ? term.scoreList : []
  },

  changeTerm(e) {
    const termIndex = this.normalizeTermIndex(e.detail.value, this.data.displayList)
    this.setData({
      termIndex
    })
    this.resetAverageSelection()
  },

  buildCourseSelectionKey(item = {}, index = 0) {
    return `${item.__termName || ''}|${item.num || ''}|${item.name || ''}|${index}`
  },

  parseScoreNumber(value) {
    const n = Number(value)
    return Number.isFinite(n) ? n : NaN
  },

  parseCreditNumber(item = {}) {
    const raw = item.credit || item.courseCredit || item.xf
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : NaN
  },

  formatCredit(item = {}) {
    const n = this.parseCreditNumber(item)
    if (!Number.isFinite(n)) return '--'
    return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.?0+$/, '')
  },

  resetAverageSelection() {
    const selectedCourseMap = {}
    const scoreList = this.getCurrentScoreList()
    scoreList.forEach((item, index) => {
      const score = this.parseScoreNumber(item && item.score)
      const credit = this.parseCreditNumber(item)
      if (Number.isFinite(score) && Number.isFinite(credit)) {
        const key = this.buildCourseSelectionKey(item, index)
        selectedCourseMap[key] = true
      }
    })
    this.setData({
      selectedCourseMap,
      avgResult: '--'
    })
  },

  toggleCourseSelect(e) {
    const index = Number(e.currentTarget.dataset.index)
    const scoreList = this.getCurrentScoreList()
    const item = scoreList[index]
    if (!item) return
    const key = this.buildCourseSelectionKey(item, index)
    const selectedCourseMap = { ...(this.data.selectedCourseMap || {}) }
    selectedCourseMap[key] = !selectedCourseMap[key]
    this.setData({
      selectedCourseMap
    })
  },

  noop() {},

  isSelected(item = {}, index = 0) {
    const key = this.buildCourseSelectionKey(item, index)
    return !!(this.data.selectedCourseMap && this.data.selectedCourseMap[key])
  },

  calculateAverage() {
    const scoreList = this.getCurrentScoreList()
    let weightedSum = 0
    let totalCredit = 0

    scoreList.forEach((item, index) => {
      if (!this.isSelected(item, index)) return
      const score = this.parseScoreNumber(item && item.score)
      const credit = this.parseCreditNumber(item)
      if (!Number.isFinite(score) || !Number.isFinite(credit)) return
      weightedSum += score * credit
      totalCredit += credit
    })

    if (!Number.isFinite(totalCredit) || totalCredit <= 0) {
      wx.showToast({
        title: '请先勾选有学分的课程',
        icon: 'none'
      })
      this.setData({
        avgResult: '--'
      })
      return
    }

    const avg = weightedSum / totalCredit
    const avgText = avg.toFixed(2).replace(/\.?0+$/, '')
    this.setData({
      avgResult: avgText
    })
    wx.showToast({
      title: `加权均分 ${avgText}`,
      icon: 'none'
    })
  },

  hideScoreDetail() {
    this.setData({
      showScoreDetail: false
    })
  },

  openScoreDetail(e) {
    const index = Number(e.currentTarget.dataset.index)
    const term = this.getCurrentTerm()
    const scoreList = Array.isArray(term.scoreList) ? term.scoreList : []
    const validItem = scoreList[index]

    if (!validItem) {
      return
    }

    const rawItem = this.findRawScoreItem(term.termName, validItem)
    const detailRows = this.buildDetailRows(validItem, rawItem)

    this.setData({
      showScoreDetail: true,
      activeScoreDetail: {
        name: validItem.name || '课程详情',
        termName: validItem.__termName || term.termName || '--',
        finalScore: validItem.score || '--',
        detailRows
      }
    })
  },

  findRawScoreItem(termName = '', validItem = {}) {
    const courseName = validItem && validItem.name
    const courseNum = validItem && validItem.num
    if (!this.data.rawList.length || (!courseName && !courseNum)) {
      return null
    }

    let matchedTerm = null
    if (termName && termName !== '全部学期') {
      matchedTerm = this.data.rawList.find((item) => item.termName === termName) || null
    } else {
      matchedTerm = this.data.rawList.find((item) => {
        const scoreList = Array.isArray(item && item.scoreList) ? item.scoreList : []
        return scoreList.some((s) => (courseNum && s.num === courseNum) || (courseName && s.name === courseName))
      }) || null
    }

    if (!matchedTerm || !Array.isArray(matchedTerm.scoreList)) {
      return null
    }

    if (courseNum) {
      const byNum = matchedTerm.scoreList.find((item) => item.num === courseNum)
      if (byNum) {
        return byNum
      }
    }

    if (courseName) {
      return matchedTerm.scoreList.find((item) => item.name === courseName) || null
    }

    return null
  },

  buildDetailRows(validItem = {}, rawItem = null) {
    const rows = [
      {
        key: 'validScore',
        label: '有效成绩',
        value: this.formatValue(validItem.score)
      },
      {
        key: 'credit',
        label: '学分',
        value: this.formatCredit(validItem)
      }
    ]

    const rawFields = [
      {
        key: 'normalScore',
        label: '平时成绩'
      },
      {
        key: 'midtermScore',
        label: '期中成绩'
      },
      {
        key: 'finalScore',
        label: '期末成绩'
      },
      {
        key: 'skillScore',
        label: '实验/实践成绩'
      },
      {
        key: 'complexScore',
        label: '总评成绩'
      }
    ]

    rawFields.forEach((field) => {
      rows.push({
        key: field.key,
        label: field.label,
        value: this.formatValue(rawItem && rawItem[field.key])
      })
    })

    return rows
  },

  hasValue(value) {
    return value !== undefined && value !== null && value !== ''
  },

  formatValue(value) {
    return this.hasValue(value) ? value : '--'
  }
})
