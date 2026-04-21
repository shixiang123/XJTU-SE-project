import {
  initLoginRequest,
  loginWithVerifyRequest
} from "../../api/main"
import { redirectAfterLogin } from "../../utils/auth"

const app = getApp()

function getRuntimeBaseUrl() {
  const appBaseUrl = String((app && app.getConfig && app.getConfig("baseUrl")) || "")
  const lanBaseUrl = String(wx.getStorageSync("lanBaseUrl") || "").trim()
  return lanBaseUrl || appBaseUrl
}

function showSyncLoading(title = "同步中...") {
  wx.showLoading({
    title,
    mask: true
  })
}

function hideSyncLoading() {
  wx.hideLoading()
}

Page({
  data: {
    stuId: "",
    password: "",
    saveCount: true,
    verifyCode: "",
    showVerify: false,
    redirect: "",
    themeMode: "light",
    pageReady: false
  },

  onLoad(options) {
    const baseUrl = getRuntimeBaseUrl()
    this.setData({
      baseUrl,
      redirect: options.redirect ? decodeURIComponent(options.redirect) : ""
    })
    this.initAccount()
    this.initLogin()
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
    this.setData({ pageReady: false })
    clearTimeout(this._pageAnimTimer)
    this._pageAnimTimer = setTimeout(() => {
      this.setData({ pageReady: true })
    }, 16)
  },

  initAccount() {
    const accountCache = wx.getStorageSync("account")
    if (accountCache) {
      this.setData({
        ...accountCache
      })
    }
  },

  onStuIdInput(e) {
    this.setData({
      stuId: e.detail.value || ""
    })
  },

  onPasswordInput(e) {
    this.setData({
      password: e.detail.value || ""
    })
  },

  onVerifyCodeInput(e) {
    this.setData({
      verifyCode: e.detail.value || ""
    })
  },

  initLogin() {
    initLoginRequest()
      .then((res) => {
        this.setData({
          initData: res.data,
          showVerify: true
        })
        this.downloadVerifyImg()
      })
      .catch((err) => {
        console.warn("[login-verify] initLogin failed", err)
      })
  },

  downloadVerifyImg() {
    if (!this.data.initData || !this.data.initData.cookie) return
    const url = `${this.data.baseUrl}/login-code?cookie=${this.data.initData.cookie}`
    wx.downloadFile({
      url,
      success: (res) => {
        this.setData({
          verifyImageUrl: res.tempFilePath
        })
      },
      fail: (err) => {
        console.warn("[login-verify] download captcha failed", err)
      }
    })
  },

  async login() {
    const stuId = String(this.data.stuId || "").trim()
    const password = String(this.data.password || "").trim()
    const verifyCode = String(this.data.verifyCode || "").trim()

    if (!stuId) {
      wx.showToast({
        title: "请输入学号",
        icon: "none"
      })
      return
    }
    if (!password) {
      wx.showToast({
        title: "请输入密码",
        icon: "none"
      })
      return
    }
    if (this.data.showVerify && !verifyCode) {
      wx.showToast({
        title: "请输入验证码",
        icon: "none"
      })
      return
    }

    const postData = {
      stuId,
      password,
      verifyCode,
      cookie: this.data.initData && this.data.initData.cookie,
      formData: JSON.stringify((this.data.initData && this.data.initData.formData) || {})
    }

    showSyncLoading("登录中...")

    try {
      const res = await loginWithVerifyRequest(postData)
      if (res.code == -1) {
        hideSyncLoading()
        wx.showToast({
          title: res.msg,
          icon: "none"
        })
        return
      }

      wx.setStorageSync("token", res.data.cookie)
      if (this.data.saveCount) {
        wx.setStorageSync("account", {
          stuId,
          password
        })
      } else {
        wx.removeStorageSync("account")
      }
      hideSyncLoading()

      wx.showToast({
        title: "登录成功",
        icon: "none"
      })
      setTimeout(() => {
        redirectAfterLogin(this.data.redirect)
      }, 500)
    } catch (err) {
      hideSyncLoading()
      wx.showToast({
        title: `登录失败: ${err && err.message ? err.message : "UNKNOWN_ERROR"}`,
        icon: "none"
      })
    }
  },

  switchStatus() {
    this.setData({
      saveCount: !this.data.saveCount
    })
  },

  skipLogin() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({
        delta: 1
      })
      return
    }
    wx.switchTab({
      url: "/pages/index/index"
    })
  }
})
