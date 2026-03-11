/**
 * 敏感信息检测工具
 * 在发送消息前扫描内容，检测 API Key、密码、私钥、手机号、身份证号等敏感信息
 */

/** 敏感信息匹配结果 */
export interface SensitiveMatch {
  /** 敏感信息类型 */
  type: 'api_key' | 'password' | 'private_key' | 'phone' | 'id_card' | 'email_password' | 'token' | 'connection_string'
  /** 人可读的类型名称 */
  label: string
  /** 匹配到的值（部分遮罩后的） */
  value: string
  /** 在原文中的起始位置 */
  startIndex: number
  /** 在原文中的结束位置 */
  endIndex: number
}

/** 检测结果 */
export interface DetectionResult {
  /** 是否检测到敏感信息 */
  detected: boolean
  /** 匹配到的敏感信息列表 */
  matches: SensitiveMatch[]
}

/** 检测规则定义 */
interface DetectionRule {
  type: SensitiveMatch['type']
  label: string
  pattern: RegExp
}

/**
 * 敏感信息检测规则列表
 * 每个规则包含类型、中文标签和正则表达式
 */
const DETECTION_RULES: DetectionRule[] = [
  // === API Key 规则 ===
  {
    type: 'api_key',
    label: 'OpenAI API Key',
    pattern: /sk-[a-zA-Z0-9]{20,}/g,
  },
  {
    type: 'api_key',
    label: 'Anthropic API Key',
    pattern: /sk-ant-[a-zA-Z0-9-]{20,}/g,
  },
  {
    type: 'api_key',
    label: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/g,
  },
  {
    type: 'api_key',
    label: 'GitHub Token',
    pattern: /gh[pours]_[a-zA-Z0-9]{36}/g,
  },

  // === 密码/密钥赋值 ===
  {
    type: 'password',
    label: '密码赋值',
    pattern: /password\s*[=:]\s*['"]?[^\s'"]{8,}/gi,
  },
  {
    type: 'password',
    label: '密钥赋值',
    pattern: /secret\s*[=:]\s*['"]?[^\s'"]{8,}/gi,
  },
  {
    type: 'token',
    label: 'Token 赋值',
    pattern: /token\s*[=:]\s*['"]?[^\s'"]{16,}/gi,
  },

  // === 私钥 ===
  {
    type: 'private_key',
    label: '私钥',
    pattern: /-----BEGIN\s+(?:RSA|EC|DSA|OPENSSH)?\s*PRIVATE KEY-----/g,
  },

  // === 中国手机号 ===
  {
    type: 'phone',
    label: '手机号',
    pattern: /(?<!\d)1[3-9]\d{9}(?!\d)/g,
  },

  // === 中国身份证号 ===
  {
    type: 'id_card',
    label: '身份证号',
    pattern: /(?<!\d)[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/g,
  },

  // === 数据库连接串 ===
  {
    type: 'connection_string',
    label: '数据库连接串',
    pattern: /(?:mongodb|mysql|postgres|redis):\/\/[^\s]+/g,
  },
]

/**
 * 对敏感值进行遮罩处理
 * 保留前3位和后3位，中间用 *** 替换
 * 如果值长度不足7位，则只保留首尾各1位
 */
function maskValue(value: string): string {
  if (value.length <= 6) {
    // 值太短，保留首尾各1位
    if (value.length <= 2) return '***'
    return value[0] + '***' + value[value.length - 1]
  }
  return value.slice(0, 3) + '***' + value.slice(-3)
}

/**
 * 检测文本中的敏感信息
 *
 * @param text - 待检测的文本内容
 * @returns 检测结果，包含是否检测到和匹配列表
 */
export function detectSensitive(text: string): DetectionResult {
  const matches: SensitiveMatch[] = []
  // 用于去重：避免同一位置被多个规则重复匹配
  const seen = new Set<string>()

  for (const rule of DETECTION_RULES) {
    // 重置正则表达式的 lastIndex（因为使用了 /g 标志）
    rule.pattern.lastIndex = 0

    let match: RegExpExecArray | null
    while ((match = rule.pattern.exec(text)) !== null) {
      const startIndex = match.index
      const endIndex = startIndex + match[0].length
      const key = `${startIndex}-${endIndex}`

      // 去重：同一区间只记录一次（优先保留先匹配到的规则）
      if (seen.has(key)) continue
      seen.add(key)

      matches.push({
        type: rule.type,
        label: rule.label,
        value: maskValue(match[0]),
        startIndex,
        endIndex,
      })
    }
  }

  // 按在文本中出现的位置排序
  matches.sort((a, b) => a.startIndex - b.startIndex)

  return {
    detected: matches.length > 0,
    matches,
  }
}

/**
 * 将文本中的敏感信息替换为遮罩后的值
 * 保留前3位和后3位，中间用 *** 替换
 *
 * @param text - 原始文本
 * @param matches - 检测到的敏感信息匹配列表
 * @returns 遮罩后的文本
 */
export function maskSensitive(text: string, matches: SensitiveMatch[]): string {
  if (matches.length === 0) return text

  // 按起始位置降序排列，从后往前替换以保持索引正确
  const sortedMatches = [...matches].sort((a, b) => b.startIndex - a.startIndex)

  let result = text
  for (const match of sortedMatches) {
    const original = result.slice(match.startIndex, match.endIndex)
    const masked = maskValue(original)
    result = result.slice(0, match.startIndex) + masked + result.slice(match.endIndex)
  }

  return result
}
