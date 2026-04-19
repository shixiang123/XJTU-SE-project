let env = "develop"

// Avoid accidentally using develop config in release build.
const envVersion = wx.getAccountInfoSync().miniProgram.envVersion
if (envVersion === "release" && env !== "production") {
  env = "production"
}

export default {
  env,
  baseUrl: {
    // WeChat DevTools on local machine: use localhost to avoid LAN proxy 502.
    develop: "http://127.0.0.1:3000",
    production: "http://api.xxx.com",
  },
}
