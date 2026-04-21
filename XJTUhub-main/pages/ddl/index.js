import {
  triggerSyxtDdlCrawlerRequest,
  getSyxtDdlCrawlerStatusRequest,
  getDdlListRequest
} from '../../api/main'

const cacheKey = 'ddlList'
const app = getApp()

function text(v) {
  return String(v || '').replace(/\s+/g, ' ').trim()
}

function parseMixedDdlText(raw) {
  const s = text(raw)
  if (!s || !/课程[:：]/.test(s) || !/截止时间[:：]/.test(s)) return null

  // 规则：课程前=作业名称；课程与截止时间之间=课程名称；截止时间后=截止时间
  const strict = s.match(
    /^(.*?)\s*课程[:：]\s*(.*?)\s*截止时间[:：]\s*([0-9]{4}[./-][0-9]{1,2}[./-][0-9]{1,2}(?:\s+[0-9]{1,2}:[0-9]{2})?)\s*$/
  )
  if (strict) {
    return {
      title: text(strict[1]),
      course: text(strict[2]),
      deadline: text(strict[3])
    }
  }

  const fallback = s.match(/^(.*?)\s*课程[:：]\s*(.*?)\s*截止时间[:：]\s*(.+)$/)
  if (!fallback) return null

  return {
    title: text(fallback[1]),
    course: text(fallback[2]),
    deadline: text(fallback[3])
  }
}

function splitMixedDdlFields(item = {}) {
  const clean = {
    title: text(item.title),
    course: text(item.course),
    deadline: text(item.deadline)
  }

  const candidates = [
    clean.title,
    clean.course,
    clean.deadline,
    [clean.title, clean.course, clean.deadline].filter(Boolean).join(' ')
  ].filter(Boolean)

  let parsed = null
  for (const c of candidates) {
    parsed = parseMixedDdlText(c)
    if (parsed) break
  }

  let title = parsed ? parsed.title : clean.title
  let course = parsed ? parsed.course : clean.course
  let deadline = parsed ? parsed.deadline : clean.deadline

  title = text(title).replace(/^(作业名称|作业|任务)[:：]\s*/i, '')
  course = text(course).replace(/^(课程名称|课程|course)[:：]\s*/i, '')
  deadline = text(deadline).replace(/^(截止时间|截止|deadline|due)[:：]\s*/i, '')

  return {
    id: item.id,
    title: title || clean.title,
    course: course || clean.course,
    deadline: deadline || clean.deadline,
    done: !!item.done
  }
}

function normalizeDdlList(list = []) {
  return list.map(splitMixedDdlFields)
}

function buildDefaultList() {
  return [
    {
      id: 'ddl-1',
      title: '软件工程立项报告提交',
      course: '软件工程',
      deadline: '2026-04-20 23:59',
      done: false
    },
    {
      id: 'ddl-2',
      title: '计算机网络实验二',
      course: '计算机网络',
      deadline: '2026-04-23 18:00',
      done: false
    },
    {
      id: 'ddl-3',
      title: '高等数学作业第三章',
      course: '高等数学',
      deadline: '2026-04-18 22:00',
      done: true
    }
  ]
}

Page({
  data: {
    list: [],
    themeMode: 'light',
    pageReady: false,
    loadingRemote: false
  },

  onLoad() {
    this.loadList()
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

  loadList() {
    const cache = wx.getStorageSync(cacheKey)
    if (cache && Array.isArray(cache) && cache.length > 0) {
      this.setData({
        list: normalizeDdlList(cache)
      })
      return
    }
    const list = normalizeDdlList(buildDefaultList())
    this.setData({
      list
    })
    wx.setStorageSync(cacheKey, list)
  },

  async pullSyxtDdl(showToast = true) {
    const account = wx.getStorageSync('account') || {}
    const stuId = String(account.stuId || '').trim()
    const password = String(account.password || '').trim()
    if (!stuId || !password) {
      if (showToast) {
        wx.showToast({
          title: '请先登录后再拉取DDL',
          icon: 'none'
        })
      }
      return
    }

    this.setData({ loadingRemote: true })
    try {
      await triggerSyxtDdlCrawlerRequest({ stuId, password })
    } catch (err) {
      console.warn('[ddl] trigger syxt crawler failed', err)
    }

    const start = Date.now()
    let fetched = false
    while (Date.now() - start < 120000) {
      let running = false
      let statusErr = ''
      try {
        const statusRes = await getSyxtDdlCrawlerStatusRequest()
        running = !!(statusRes && statusRes.data && statusRes.data.running)
        statusErr = (statusRes && statusRes.data && statusRes.data.lastError) || ''
      } catch (_) {
        // ignore status polling errors
      }

      if (!running) {
        const listRes = await getDdlListRequest()
        const remoteList = (listRes && listRes.data) || []
        if (Array.isArray(remoteList) && remoteList.length) {
          const localDoneMap = new Map(this.data.list.map((entry) => [entry.id, !!entry.done]))
          const mergedList = normalizeDdlList(remoteList).map((entry) => ({
            ...entry,
            done: localDoneMap.has(entry.id) ? localDoneMap.get(entry.id) : !!entry.done
          }))
          this.setData({ list: mergedList })
          wx.setStorageSync(cacheKey, mergedList)
          fetched = true
        }
        if (!fetched && statusErr && showToast) {
          wx.showToast({
            title: `DDL抓取失败: ${statusErr}`,
            icon: 'none'
          })
        }
        break
      }

      await new Promise((resolve) => setTimeout(resolve, 1500))
    }

    if (showToast) {
      wx.showToast({
        title: fetched ? 'DDL已更新' : '未抓取到DDL，保留本地数据',
        icon: 'none'
      })
    }
    this.setData({ loadingRemote: false })
  },

  toggleDone(e) {
    const id = e.currentTarget.dataset.id
    const list = this.data.list.map((entry) => {
      if (entry.id === id) {
        return {
          ...entry,
          done: !entry.done
        }
      }
      return entry
    })
    this.setData({ list })
    wx.setStorageSync(cacheKey, list)
  },

  resetDemoData() {
    const list = buildDefaultList()
    const normalized = normalizeDdlList(list)
    this.setData({ list: normalized })
    wx.setStorageSync(cacheKey, normalized)
    wx.showToast({
      title: '已恢复默认DDL',
      icon: 'none'
    })
  }
})
