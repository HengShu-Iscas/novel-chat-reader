import type { NovelSource, TopicDisguiseTheme } from "./types";

export const topicDisguiseThemeLabels: Record<TopicDisguiseTheme, string> = {
  work: "职场办公",
  research: "论文研究",
  coding: "编程开发",
  product: "产品方案",
  operations: "运营增长",
  learning: "学习备考",
  finance: "财务报表",
  design: "设计评审",
  meetings: "会议协作",
  daily: "日常事务",
};

export const topicDisguiseTopics: Record<TopicDisguiseTheme, string[]> = {
  work: [
    "季度目标拆解",
    "项目排期同步",
    "跨部门流程整理",
    "客户反馈归纳",
    "周报素材汇总",
    "风险事项跟进",
    "岗位职责说明",
    "绩效口径确认",
    "部门预算沟通",
    "排班规则确认",
    "供应商进度跟进",
    "流程节点复盘",
    "月度重点汇总",
    "审批材料整理",
    "交付清单核对",
    "协作边界确认",
    "资源占用说明",
    "阶段风险复核",
    "外部反馈同步",
    "例行数据备注",
    "需求变更记录",
    "任务看板清理",
  ],
  research: [
    "实验设置复核",
    "相关工作梳理",
    "图表结论整理",
    "审稿意见归类",
    "消融实验说明",
    "数据集说明补全",
    "摘要措辞优化",
    "方法结构检查",
    "指标口径对齐",
    "引用格式核查",
    "模型结果汇总",
    "基线方法备注",
    "实验日志整理",
    "附录材料补充",
    "结论边界说明",
    "评测脚本检查",
    "消融表格核对",
    "投稿清单整理",
    "论文结构复盘",
    "复现实验记录",
    "开题材料准备",
    "研究计划同步",
  ],
  coding: [
    "接口联调记录",
    "异常日志定位",
    "数据库迁移检查",
    "前端状态同步",
    "测试用例补充",
    "构建脚本排查",
    "代码评审意见",
    "缓存策略确认",
    "鉴权流程排查",
    "依赖版本核对",
    "发布脚本检查",
    "灰度开关确认",
    "前端样式回归",
    "接口字段对齐",
    "错误边界补充",
    "性能指标记录",
    "任务队列观察",
    "配置项复核",
    "监控告警备注",
    "回滚方案整理",
    "分支合并清单",
    "缺陷复现记录",
  ],
  product: [
    "需求优先级排序",
    "用户路径梳理",
    "竞品功能记录",
    "版本范围确认",
    "埋点事件设计",
    "灰度方案草稿",
    "验收标准整理",
    "反馈入口优化",
    "版本节奏确认",
    "核心场景拆解",
    "需求边界说明",
    "用户反馈复盘",
    "竞品页面走查",
    "指标看板整理",
    "发布说明草稿",
    "功能范围收敛",
    "用户分层记录",
    "试点计划同步",
    "问题闭环跟进",
    "交互文案确认",
    "配置入口梳理",
    "体验路径复核",
  ],
  operations: [
    "活动复盘提纲",
    "渠道投放记录",
    "用户分层分析",
    "内容选题计划",
    "转化漏斗观察",
    "社群话术整理",
    "增长实验记录",
    "留存数据备注",
    "投放素材整理",
    "节奏日历更新",
    "人群标签核对",
    "数据波动记录",
    "渠道反馈同步",
    "转化节点复盘",
    "活动预算备注",
    "内容排期确认",
    "用户访谈摘要",
    "运营指标巡检",
    "增长假设整理",
    "触达策略复核",
    "报名数据核查",
    "复盘结论归档",
  ],
  learning: [
    "错题归因整理",
    "复习计划调整",
    "知识点清单",
    "资料目录归档",
    "课程笔记补全",
    "模拟题记录",
    "资料任务安排",
    "阶段总结提纲",
    "考试节点规划",
    "资料版本核对",
    "课程目录整理",
    "重点模块复盘",
    "练习进度统计",
    "公式清单补充",
    "案例材料归类",
    "备考时间表",
    "知识框架梳理",
    "题型变化记录",
    "模拟结果分析",
    "笔记结构调整",
    "复习提醒清单",
    "薄弱项跟踪",
  ],
  finance: [
    "预算科目核对",
    "报销凭证整理",
    "成本变动说明",
    "现金流备注",
    "合同付款跟进",
    "月度报表复核",
    "税务材料清单",
    "费用口径统一",
    "收支明细复核",
    "发票状态跟进",
    "采购预算备注",
    "合同金额核查",
    "付款节点记录",
    "成本中心确认",
    "资产台账整理",
    "往来账目核对",
    "预算执行分析",
    "审批单据清点",
    "财务口径备忘",
    "月结事项跟进",
    "费用分类复盘",
    "报表差异说明",
  ],
  design: [
    "交互细节评审",
    "视觉规范整理",
    "组件状态补充",
    "移动端适配检查",
    "图标使用记录",
    "信息层级调整",
    "原型反馈汇总",
    "设计走查清单",
    "页面状态梳理",
    "颜色规范复核",
    "字号层级确认",
    "组件间距检查",
    "动效节奏备注",
    "空状态方案整理",
    "表单体验复盘",
    "导航结构评审",
    "视觉还原记录",
    "设计令牌核对",
    "可用性问题清单",
    "多端适配备注",
    "图文比例调整",
    "验收截图整理",
  ],
  meetings: [
    "会议纪要整理",
    "待办事项追踪",
    "议题优先级确认",
    "参会材料准备",
    "决策记录归档",
    "同步会问题清单",
    "负责人分工确认",
    "下次会议安排",
    "晨会事项跟进",
    "评审结论同步",
    "例会议题收集",
    "行动项闭环",
    "会议材料归档",
    "排期冲突确认",
    "跨组同步备忘",
    "决策风险备注",
    "会前问题整理",
    "会后进度更新",
    "讨论范围收敛",
    "参会名单核对",
    "纪要重点提炼",
    "沟通口径统一",
  ],
  daily: [
    "行程安排确认",
    "文件归档清单",
    "资料备份提醒",
    "设备问题记录",
    "待处理邮件整理",
    "采购清单更新",
    "联系人信息核对",
    "时间安排复盘",
    "快递信息整理",
    "证件材料核对",
    "办公用品记录",
    "待办优先级调整",
    "临时事项备忘",
    "电话回访清单",
    "文档命名整理",
    "日程冲突处理",
    "资料领取登记",
    "设备借用记录",
    "消息提醒清理",
    "出行票据归类",
    "待回复事项",
    "常用链接备份",
  ],
};

export function getDisguisedTopic(book: NovelSource, theme: TopicDisguiseTheme): string {
  const topics = topicDisguiseTopics[theme] ?? topicDisguiseTopics.work;
  return topics[getDisguisedTopicStartIndex(book, theme, topics.length)];
}

export function getDisguisedTopicsForBooks(
  books: NovelSource[],
  theme: TopicDisguiseTheme,
): Record<string, string> {
  const topics = topicDisguiseTopics[theme] ?? topicDisguiseTopics.work;
  const usedTopics = new Set<string>();
  const assigned: Record<string, string> = {};

  for (const book of books) {
    const startIndex = getDisguisedTopicStartIndex(book, theme, topics.length);
    let selected = topics[startIndex];

    for (let offset = 0; offset < topics.length; offset += 1) {
      const candidate = topics[(startIndex + offset) % topics.length];
      if (!usedTopics.has(candidate)) {
        selected = candidate;
        break;
      }
    }

    usedTopics.add(selected);
    assigned[book.id] = selected;
  }

  return assigned;
}

function getDisguisedTopicStartIndex(book: NovelSource, theme: TopicDisguiseTheme, topicCount: number): number {
  return stableHash(`${theme}:${book.id}:${book.title}`) % topicCount;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
