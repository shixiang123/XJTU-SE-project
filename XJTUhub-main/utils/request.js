const app = getApp()
import { toLogin } from "./auth"

function normalizeCode(rawCode) {
  if (typeof rawCode === "number") return rawCode
  if (typeof rawCode === "string" && rawCode.trim() !== "") {
    const n = Number(rawCode)
    if (!Number.isNaN(n)) return n
  }
  return NaN
}

function shouldRetryWithLocalhost(baseUrl, res, payload) {
  const statusCode = res ? Number(res.statusCode || 0) : 0
  const isBadGateway = statusCode === 502
  const isEmptyPayload =
    payload === "" || payload === null || payload === undefined || typeof payload !== "object"
  const isLanHost = /^http:\/\/192\.168\./i.test(String(baseUrl || ""))
  return isLanHost && isBadGateway && isEmptyPayload
}

function withLocalhost(baseUrl) {
  return String(baseUrl || "").replace(/^http:\/\/192\.168\.\d+\.\d+/i, "http://127.0.0.1")
}

function runRequest({
  url,
  method,
  timeout,
  header,
  data,
  onSuccess,
  onFail,
  onComplete,
}) {
  wx.request({
    url,
    method,
    timeout,
    header,
    data,
    success: onSuccess,
    fail: onFail,
    complete: onComplete,
  })
}

export default function createRequest(options = {}) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync("token")
    if (options.needLogin !== false && !token) {
      wx.showToast({
        title: "请先登录",
        icon: "none",
      })
      setTimeout(() => {
        toLogin()
      }, 1500)
      reject(new Error("UNAUTHORIZED"))
      return
    }

    const baseUrl = app.getConfig("baseUrl")
    const originUrl = `${baseUrl}${options.url}`
    const method = options.method || "GET"
    const timeout = options.timeout || 20000
    const data = options.data || {}
    const header = {
      "content-type": "application/json",
      token,
    }

    let showLoading = false
    if (options.loading !== false) {
      showLoading = true
      wx.showLoading({
        title: "正在加载",
        mask: true,
      })
    }

    const finalizeComplete = () => {
      if (showLoading) {
        wx.hideLoading()
      }
    }

    const handlePayload = (res) => {
      const payload =
        res && typeof res.data === "object" && res.data !== null ? res.data : res ? res.data : {}
      const code = normalizeCode(payload && payload.code)

      switch (code) {
        case 0:
          resolve(payload)
          return true
        case -1:
          wx.showToast({
            title: (payload && payload.msg) || "请求失败",
            icon: "none",
          })
          reject(new Error((payload && payload.msg) || "REQUEST_FAILED"))
          return true
        case 401:
        case 403:
          wx.showToast({
            title: "登录已失效，请重新登录",
            icon: "none",
          })
          setTimeout(() => {
            toLogin()
          }, 1000)
          reject(new Error("AUTH_EXPIRED"))
          return true
        default:
          return false
      }
    }

    const requestOnce = (requestUrl, allowFallback) => {
      runRequest({
        url: requestUrl,
        method,
        timeout,
        header,
        data,
        onSuccess: (res) => {
          const handled = handlePayload(res)
          if (handled) return

          if (allowFallback && shouldRetryWithLocalhost(baseUrl, res, res ? res.data : null)) {
            if (options.url === "/resources") {
              console.warn("[request] 502 on /resources, use local empty fallback data", {
                from: requestUrl,
                method,
              })
              resolve({
                code: 0,
                msg: "请求成功",
                data: {
                  list: [],
                  total: 0,
                  hasMore: false,
                },
              })
              return
            }

            const fallbackUrl = `${withLocalhost(baseUrl)}${options.url}`
            console.warn("[request] 502 empty payload, fallback to localhost", {
              from: requestUrl,
              to: fallbackUrl,
              method,
            })
            requestOnce(fallbackUrl, false)
            return
          }

          console.error("[request] unexpected response payload", {
            url: requestUrl,
            method,
            statusCode: res ? res.statusCode : "",
            payload: res ? res.data : null,
          })
          const msg =
            res &&
            res.data &&
            typeof res.data === "object" &&
            res.data.msg &&
            String(res.data.msg).trim()
              ? String(res.data.msg).trim()
              : "服务返回异常"
          wx.showToast({
            title: msg,
            icon: "none",
          })
          reject(new Error(msg || "UNKNOWN_ERROR"))
        },
        onFail: (err) => {
          const errMsg = err && err.errMsg ? String(err.errMsg) : ""
          const isDomainBlocked = errMsg.includes("url not in domain list")
          console.error("[request] wx.request fail", {
            url: requestUrl,
            method,
            errMsg,
            errCode: err && err.errCode !== undefined ? err.errCode : "",
          })
          if (!isDomainBlocked) {
            wx.showToast({
              title: "网络异常，请检查后端和域名配置",
              icon: "none",
            })
          }
          reject(new Error("NETWORK_ERROR"))
        },
        onComplete: finalizeComplete,
      })
    }

    requestOnce(originUrl, true)
  })
}
