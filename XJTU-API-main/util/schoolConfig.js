const schools = require("../public/schools.json")

const DEFAULT_XJTU_SCHOOL_CODE = "13558"

function resolveSchoolCode() {
  return process.env.XJTU_SCHOOL_CODE || process.env.SCHOOL_CODE || DEFAULT_XJTU_SCHOOL_CODE
}

const getSchoolConfig = (key = "") => {
  const schoolCode = resolveSchoolCode()
  const config = schools[schoolCode]
  if (!config) {
    throw new Error(`Unsupported school code: ${schoolCode}`)
  }
  return key === "" ? config : config[key]
}

module.exports = getSchoolConfig
