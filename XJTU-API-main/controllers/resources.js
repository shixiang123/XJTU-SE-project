const RESOURCE_LIST = [
  {
    id: "r-1",
    title: "高等数学重点笔记",
    course: "高等数学",
    type: "note",
    uploader: "XJTUhub",
    updatedAt: "2026-04-18",
    desc: "极限、导数、积分核心知识点整理",
  },
  {
    id: "r-2",
    title: "数据结构期中复习题",
    course: "数据结构",
    type: "exam",
    uploader: "XJTUhub",
    updatedAt: "2026-04-17",
    desc: "含链表、树、图典型题",
  },
  {
    id: "r-3",
    title: "离散数学课堂课件",
    course: "离散数学",
    type: "courseware",
    uploader: "XJTUhub",
    updatedAt: "2026-04-16",
    desc: "命题逻辑与集合关系",
  },
  {
    id: "r-4",
    title: "大学英语写作模板",
    course: "大学英语",
    type: "note",
    uploader: "XJTUhub",
    updatedAt: "2026-04-15",
    desc: "常见句型和段落结构模板",
  },
  {
    id: "r-5",
    title: "计算机网络实验指导",
    course: "计算机网络",
    type: "courseware",
    uploader: "XJTUhub",
    updatedAt: "2026-04-14",
    desc: "抓包与协议分析实验步骤",
  },
  {
    id: "r-6",
    title: "操作系统历年真题",
    course: "操作系统",
    type: "exam",
    uploader: "XJTUhub",
    updatedAt: "2026-04-13",
    desc: "进程、内存、文件系统题库",
  },
]

function toPositiveInt(value, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  const i = Math.trunc(n)
  return i > 0 ? i : fallback
}

const getList = async (ctx, next) => {
  const page = toPositiveInt(ctx.query.page, 1)
  const pageSize = toPositiveInt(ctx.query.pageSize, 10)
  const keyword = String(ctx.query.keyword || "")
    .trim()
    .toLowerCase()
  const category = String(ctx.query.category || "").trim().toLowerCase()

  let list = RESOURCE_LIST

  if (category) {
    list = list.filter((item) => String(item.type || "").toLowerCase() === category)
  }

  if (keyword) {
    list = list.filter((item) => {
      const text = `${item.title} ${item.course} ${item.desc} ${item.uploader}`.toLowerCase()
      return text.includes(keyword)
    })
  }

  const total = list.length
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const paged = list.slice(start, end)
  const hasMore = end < total

  ctx.result = {
    list: paged,
    total,
    hasMore,
  }

  return next()
}

module.exports = {
  getList,
}
