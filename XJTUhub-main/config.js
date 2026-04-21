let env = "develop"

// Avoid accidentally using develop config in release build.
const envVersion = wx.getAccountInfoSync().miniProgram.envVersion
if (envVersion === "release" && env !== "production") {
  env = "production"
}

// Default LAN backend for real device debugging (can still be overridden by storage lanBaseUrl).
const fallbackDevelopUrl = "http://192.168.1.107:3000"

export default {
  env,
  baseUrl: {
    develop: fallbackDevelopUrl,
    production: "http://api.xxx.com",
  },
}
