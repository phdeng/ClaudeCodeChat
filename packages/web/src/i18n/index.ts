/**
 * i18n 国际化模块
 * - Zustand store 管理当前语言
 * - useTranslation() hook 返回 t() 函数
 * - 支持嵌套 key 访问: t('sidebar.newChat')
 * - 支持模板变量: t('time.minutesAgo', { m: 5 }) → "5 分钟前"
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import zh from './zh'
import en from './en'
import type { Locale } from './zh'

export type LangCode = 'zh' | 'en'

const locales: Record<LangCode, Locale> = { zh, en }

export const langNames: Record<LangCode, string> = {
  zh: '中文',
  en: 'English',
}

interface I18nState {
  lang: LangCode
  setLang: (lang: LangCode) => void
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      lang: 'zh',
      setLang: (lang) => set({ lang }),
    }),
    { name: 'i18n-lang' }
  )
)

type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? `${K}.${NestedKeyOf<T[K]>}`
        : K
    }[keyof T & string]
  : never

export type TranslationKey = NestedKeyOf<Locale>

/**
 * 按点号路径取值
 */
function getByPath(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return path
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === 'string' ? current : path
}

/**
 * 翻译函数类型
 */
export type TFunction = (key: TranslationKey, vars?: Record<string, string | number>) => string

/**
 * useTranslation hook
 * @returns { t, lang, setLang }
 */
export function useTranslation() {
  const { lang, setLang } = useI18nStore()
  const locale = locales[lang]

  const t: TFunction = (key, vars) => {
    let text = getByPath(locale as unknown as Record<string, unknown>, key)
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      }
    }
    return text
  }

  return { t, lang, setLang }
}

export { zh, en }
export type { Locale }
