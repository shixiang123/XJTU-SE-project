const getConfig = (key) => {
  const defaultConfig = {
    XJTU_SCHOOL_CODE: "13558",
    PORT: 3000,
  }

  const legacyMap = {
    SCHOOL_CODE: "XJTU_SCHOOL_CODE",
  }

  if (process.env[key] !== undefined) {
    return process.env[key]
  }

  const mappedKey = legacyMap[key]
  if (mappedKey && process.env[mappedKey] !== undefined) {
    return process.env[mappedKey]
  }

  if (defaultConfig[key] !== undefined) {
    return defaultConfig[key]
  }

  if (mappedKey && defaultConfig[mappedKey] !== undefined) {
    return defaultConfig[mappedKey]
  }

  return undefined
}

module.exports = getConfig
