const app = getApp()
import {
  getResourceListRequest,
  uploadResourceFileRequest,
  deleteResourceFileRequest
} from '../../api/main'

const REQUEST_FALLBACK_TIMEOUT = 8000
const DEFAULT_PAGE_SIZE = 10

function getRuntimeBaseUrl() {
  const appBaseUrl = String((app && app.getConfig && app.getConfig('baseUrl')) || '')
  const lanBaseUrl = String(wx.getStorageSync('lanBaseUrl') || '').trim()
  return lanBaseUrl || appBaseUrl
}

Page({
  data: {
    themeMode: 'light',
    pageReady: false,
    categoryList: [
      { label: '全部', value: '' },
      { label: '课件', value: 'courseware' },
      { label: '笔记', value: 'note' },
      { label: '试题', value: 'exam' }
    ],
    activeCategory: '',
    keywordInput: '',
    keyword: '',
    uploadCourse: '',
    resourceList: [],
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    hasMore: true,
    isLoading: false,
    isInitLoading: true,
    isUploading: false,
    downloadTipVisible: false,
    downloadTipTitle: '',
    downloadTipPath: '',
    downloadTipHint: ''
  },

  onLoad() {
    this.fetchResources({ reset: true })
  },

  onShow() {
    this.setData({
      themeMode: app.getThemeMode()
    })
    this.syncTabBar()
    this.runPageEnterAnimation()
  },

  syncTabBar() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar && tabBar.setSelectedByPath) {
      tabBar.setSelectedByPath('/pages/index/index')
      if (tabBar.syncTheme) tabBar.syncTheme()
    }
  },

  runPageEnterAnimation() {
    this.setData({ pageReady: false })
    clearTimeout(this._pageAnimTimer)
    this._pageAnimTimer = setTimeout(() => {
      this.setData({ pageReady: true })
    }, 16)
  },

  onUnload() {
    clearTimeout(this._pageAnimTimer)
    clearTimeout(this._requestFallbackTimer)
  },

  onPullDownRefresh() {
    this.fetchResources({
      reset: true,
      fromPullDown: true
    })
  },

  onReachBottom() {
    if (!this.data.isLoading && this.data.hasMore) {
      this.fetchResources()
    }
  },

  onKeywordInput(e) {
    this.setData({
      keywordInput: e.detail.value || ''
    })
  },

  onUploadCourseInput(e) {
    this.setData({
      uploadCourse: (e.detail.value || '').trim()
    })
  },

  doSearch() {
    this.setData({
      keyword: (this.data.keywordInput || '').trim()
    })
    this.fetchResources({ reset: true })
  },

  clearSearch() {
    this.setData({
      keywordInput: '',
      keyword: ''
    })
    this.fetchResources({ reset: true })
  },

  switchCategory(e) {
    const category = e.currentTarget.dataset.category || ''
    if (category === this.data.activeCategory) return
    this.setData({ activeCategory: category })
    this.fetchResources({ reset: true })
  },

  getTypeText(type = '') {
    const mapping = {
      courseware: '课件',
      note: '笔记',
      exam: '试题'
    }
    return mapping[type] || '资料'
  },

  normalizeResourceItem(item = {}, index = 0) {
    const type = item.type || item.category || item.kind || 'courseware'
    return {
      id: item.id || item.resourceId || `${Date.now()}-${index}`,
      title: item.title || item.name || '未命名资料',
      course: item.course || item.courseName || '未分类课程',
      type,
      typeText: item.typeText || this.getTypeText(type),
      uploader: item.uploader || item.author || '匿名上传',
      updatedAt: item.updatedAt || item.updateTime || item.publishTime || '--',
      desc: item.desc || item.description || '暂无简介',
      url: item.url || item.link || '',
      fileName: item.fileName || item.name || '',
      canDelete: !!item.canDelete
    }
  },

  parseResourceResponse(payload = {}, page = 1) {
    if (Array.isArray(payload)) {
      return {
        list: payload,
        total: payload.length,
        hasMore: payload.length >= this.data.pageSize
      }
    }
    const list = Array.isArray(payload.list) ? payload.list : []
    const total = Number(payload.total) || (page === 1 ? list.length : this.data.total)
    const hasMore = payload.hasMore !== undefined ? !!payload.hasMore : page * this.data.pageSize < total
    return {
      list,
      total,
      hasMore
    }
  },

  applyFallbackData() {
    this.setData({
      resourceList: [],
      total: 0,
      page: 1,
      hasMore: false,
      isInitLoading: false,
      isLoading: false
    })
  },

  fetchResources(options = {}) {
    const { reset = false, fromPullDown = false } = options
    if (this.data.isLoading) return
    if (!reset && !this.data.hasMore) return

    const nextPage = reset ? 1 : this.data.page + 1
    const query = {
      page: nextPage,
      pageSize: this.data.pageSize
    }

    if (this.data.activeCategory) query.category = this.data.activeCategory
    if (this.data.keyword) query.keyword = this.data.keyword

    this.setData({
      isLoading: true,
      isInitLoading: reset
    })

    clearTimeout(this._requestFallbackTimer)
    this._requestFallbackTimer = setTimeout(() => {
      if (!this.data.isLoading) return
      this.applyFallbackData()
      if (fromPullDown) wx.stopPullDownRefresh()
      wx.showToast({
        title: '获取资料失败',
        icon: 'none'
      })
    }, REQUEST_FALLBACK_TIMEOUT)

    getResourceListRequest(query)
      .then((res) => {
        clearTimeout(this._requestFallbackTimer)
        const parsed = this.parseResourceResponse(res.data, nextPage)
        const normalizedList = parsed.list.map((item, index) => this.normalizeResourceItem(item, index))
        const resourceList = reset ? normalizedList : this.data.resourceList.concat(normalizedList)
        this.setData({
          resourceList,
          page: nextPage,
          total: parsed.total,
          hasMore: parsed.hasMore,
          isLoading: false,
          isInitLoading: false
        })
        if (fromPullDown) wx.stopPullDownRefresh()
      })
      .catch(() => {
        clearTimeout(this._requestFallbackTimer)
        if (this.data.isLoading) this.applyFallbackData()
        if (fromPullDown) wx.stopPullDownRefresh()
      })
  },

  async chooseAndUploadResource() {
    if (this.data.isUploading) return

    const chooseFile = () =>
      new Promise((resolve, reject) => {
        wx.chooseMessageFile({
          count: 1,
          type: 'file',
          success: resolve,
          fail: reject
        })
      })

    try {
      const fileRes = await chooseFile()
      const file = fileRes && Array.isArray(fileRes.tempFiles) ? fileRes.tempFiles[0] : null
      if (!file || !file.path) {
        wx.showToast({
          title: '未选择文件',
          icon: 'none'
        })
        return
      }

      const course = (this.data.uploadCourse || '').trim() || '未分类课程'
      this.setData({ isUploading: true })
      wx.showLoading({
        title: '上传中...',
        mask: true
      })

      await uploadResourceFileRequest({
        filePath: file.path,
        course,
        name: 'file',
        displayName: file.name || ''
      })

      wx.showToast({
        title: '上传成功',
        icon: 'success'
      })
      this.fetchResources({ reset: true })
    } catch (err) {
      console.warn('[resource] upload failed', err)
      wx.showToast({
        title: '上传失败',
        icon: 'none'
      })
    } finally {
      this.setData({ isUploading: false })
      wx.hideLoading()
    }
  },

  showDownloadTip({ title = '', path = '', hint = '' } = {}) {
    this.setData({
      downloadTipVisible: true,
      downloadTipTitle: title || '下载完成',
      downloadTipPath: path || '',
      downloadTipHint: hint || ''
    })
  },

  closeDownloadTip() {
    this.setData({
      downloadTipVisible: false
    })
  },

  copyDownloadPath() {
    const text = String(this.data.downloadTipPath || '').trim()
    if (!text) {
      wx.showToast({
        title: '没有可复制路径',
        icon: 'none'
      })
      return
    }
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({
          title: '路径已复制',
          icon: 'success'
        })
      },
      fail: (err) => {
        console.warn('[resource] copy path failed', err)
        wx.showToast({
          title: '复制失败',
          icon: 'none'
        })
      }
    })
  },

  openResource(e) {
    const id = e.currentTarget.dataset.id
    const resource = this.data.resourceList.find((item) => item.id === id)
    if (!resource) return

    if (!resource.url) {
      wx.showToast({
        title: '该资料暂不支持下载',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '下载资料',
      content: `是否下载《${resource.title}》？`,
      confirmText: '下载',
      cancelText: '取消',
      success: (modalRes) => {
        if (!modalRes.confirm) return

        const baseUrl = getRuntimeBaseUrl()
        const downloadUrl = /^https?:\/\//i.test(resource.url)
          ? resource.url
          : `${baseUrl}${resource.url}`

        wx.showLoading({
          title: '下载中...',
          mask: true
        })

        wx.downloadFile({
          url: downloadUrl,
          success: (dlRes) => {
            if (dlRes.statusCode !== 200 || !dlRes.tempFilePath) {
              wx.showToast({
                title: '下载失败',
                icon: 'none'
              })
              return
            }

            const onSaveFailed = (err) => {
              console.warn('[resource] save file failed', err)
              wx.showToast({
                title: '保存失败',
                icon: 'none'
              })
            }

            if (typeof wx.saveFileToDisk === 'function') {
              wx.saveFileToDisk({
                filePath: dlRes.tempFilePath,
                success: (saveRes) => {
                  const savedPath = (saveRes && saveRes.savedFilePath) || ''
                  console.log('[resource] saved via picker', {
                    title: resource.title,
                    path: savedPath
                  })
                  this.showDownloadTip({
                    title: '下载完成',
                    path: savedPath,
                    hint: savedPath
                      ? '可鼠标选中路径进行复制，或点击下方按钮复制。'
                      : '文件已保存，路径由你在保存窗口中选择。'
                  })
                },
                fail: (pickerErr) => {
                  console.warn('[resource] saveFileToDisk failed, fallback saveFile', pickerErr)
                  wx.saveFile({
                    tempFilePath: dlRes.tempFilePath,
                    success: (saveRes) => {
                      console.log('[resource] saved fallback', {
                        title: resource.title,
                        path: saveRes.savedFilePath
                      })
                      this.showDownloadTip({
                        title: '下载完成',
                        path: saveRes.savedFilePath,
                        hint: '当前环境不支持路径选择，已保存到小程序目录。可复制此路径。'
                      })
                    },
                    fail: onSaveFailed
                  })
                }
              })
              return
            }

            wx.saveFile({
              tempFilePath: dlRes.tempFilePath,
              success: (saveRes) => {
                console.log('[resource] saved fallback', {
                  title: resource.title,
                  path: saveRes.savedFilePath
                })
                this.showDownloadTip({
                  title: '下载完成',
                  path: saveRes.savedFilePath,
                  hint: '当前环境不支持路径选择，已保存到小程序目录。可复制此路径。'
                })
              },
              fail: onSaveFailed
            })
          },
          fail: (err) => {
            console.warn('[resource] download failed', err)
            wx.showToast({
              title: '下载失败',
              icon: 'none'
            })
          },
          complete: () => {
            wx.hideLoading()
          }
        })
      }
    })
  },

  deleteResource(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.showModal({
      title: '删除文件',
      content: '确认删除该文件？删除后所有用户都不可见。',
      confirmText: '删除',
      confirmColor: '#dc2626',
      cancelText: '取消',
      success: async (res) => {
        if (!res.confirm) return
        try {
          wx.showLoading({ title: '删除中...', mask: true })
          await deleteResourceFileRequest(id)
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          })
          this.fetchResources({ reset: true })
        } catch (err) {
          console.warn('[resource] delete failed', err)
          wx.showToast({
            title: '删除失败',
            icon: 'none'
          })
        } finally {
          wx.hideLoading()
        }
      }
    })
  }
})
