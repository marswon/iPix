import type { CSSProperties, HTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../utils/cn'

type NomiBrandProps = {
  markSize?: number
  wordSize?: number
  className?: string
}

type NomiLogoMarkProps = {
  size?: number
  className?: string
}

type NomiLoadingMarkProps = {
  size?: number
  className?: string
  label?: string
}

type NomiAILabelProps = {
  markSize?: number
  wordSize?: number
  className?: string
  suffix?: string
}

type NomiStepperProps = {
  value: 'creation' | 'generation' | 'preview'
  onChange: (mode: 'creation' | 'generation' | 'preview') => void
}

type NomiWordmarkProps = {
  /** 字号 px；缺省则继承父级 font-size（如放进 h1 用 text-display）。 */
  fontSize?: number
  className?: string
} & HTMLAttributes<HTMLSpanElement>

/**
 * iPix 文字标志的唯一真相源：小写 i 保持正文色，Pix 使用品牌强调色。
 * 内部组件名保留 Nomi 前缀以兼容现有调用方；用户可见品牌统一由 i18n 提供。
 */
export function NomiWordmark({ fontSize, className, ...rest }: NomiWordmarkProps): JSX.Element {
  const { t } = useTranslation()
  return (
    <span
      className={cn('nomi-wordmark', 'font-sans font-semibold tracking-normal leading-none', className)}
      style={fontSize ? { fontSize } : undefined}
      {...rest}
    >
      {t('brand.wordStart')}
      <span className={cn('nomi-wordmark__accent', 'text-nomi-accent')}>{t('brand.wordAccent')}</span>
      {t('brand.wordEnd')}
    </span>
  )
}

export function NomiBrand({ markSize = 26, wordSize = 17, className }: NomiBrandProps): JSX.Element {
  const { t } = useTranslation()
  const rx = Math.round((markSize / 28) * 7)

  return (
    <div
      className={cn('nomi-brand', 'inline-flex items-center gap-2 shrink-0', className)}
      aria-label={t('brand.name')}
    >
      <svg width={markSize} height={markSize} viewBox="0 0 28 28" fill="none" aria-hidden="true" className="shrink-0">
        <rect width="28" height="28" rx={rx} fill="var(--nomi-logo-ground)" />
        <path d="M5 10V5h5M18 5h5v5M23 18v5h-5M10 23H5v-5" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="square" />
        <circle cx="14" cy="9" r="1.75" fill="var(--nomi-accent)" />
        <rect x="12.5" y="12" width="3" height="8.5" rx="1" fill="var(--nomi-accent)" />
      </svg>
      <NomiWordmark fontSize={wordSize} className="nomi-brand__word text-nomi-ink" aria-hidden="true" />
    </div>
  )
}

export function NomiLogoMark({ size = 24, className }: NomiLogoMarkProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className={cn('nomi-logo-mark', 'block shrink-0', className)}
    >
      <rect width="28" height="28" rx="7" fill="var(--nomi-logo-ground)" />
      <path d="M5 10V5h5M18 5h5v5M23 18v5h-5M10 23H5v-5" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="square" />
      <circle cx="14" cy="9" r="1.75" fill="var(--nomi-accent)" />
      <rect x="12.5" y="12" width="3" height="8.5" rx="1" fill="var(--nomi-accent)" />
    </svg>
  )
}

export function NomiLoadingMark({ size = 18, className, label }: NomiLoadingMarkProps): JSX.Element {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'nomi-loading-mark',
        'inline-grid place-items-center flex-none leading-none animate-spin motion-reduce:animate-none',
        className,
      )}
      aria-label={label ?? t('common.loading')}
      role="status"
      style={{ '--nomi-loading-size': `${size}px`, width: `${size}px`, height: `${size}px` } as CSSProperties}
    >
      <NomiLogoMark size={size} className={cn('nomi-loading-mark__logo', 'block')} />
    </span>
  )
}

export function NomiAILabel({ markSize = 22, wordSize = 14, className, suffix = 'AI' }: NomiAILabelProps): JSX.Element {
  const { t } = useTranslation()
  return (
    <div
      className={cn('nomi-ai-label', 'inline-flex items-center gap-2 shrink-0', className)}
      aria-label={t('brand.aiLabel', { suffix })}
    >
      <NomiLogoMark size={markSize} />
      <span className={cn('nomi-ai-label__text', 'leading-none')} style={{ fontSize: wordSize }}>
        <NomiWordmark className="nomi-ai-label__word text-nomi-ink" />
        <span className={cn('nomi-ai-label__suffix', 'font-nomi-display text-nomi-ink-60 tracking-[-0.01em]')}>
          {' '}
          {suffix}
        </span>
      </span>
    </div>
  )
}

export function NomiStepper({ value, onChange }: NomiStepperProps): JSX.Element {
  const { t } = useTranslation()
  const tabs: { mode: NomiStepperProps['value']; label: string }[] = [
    { mode: 'creation', label: t('workspace.creationTab') },
    { mode: 'generation', label: t('workspace.generationTab') },
    { mode: 'preview', label: t('workspace.previewTab') },
  ]
  return (
    <nav
      className={cn(
        'nomi-stepper',
        'inline-flex items-center gap-0.5 p-1 border border-nomi-line-soft rounded-full bg-[var(--nomi-ink-05)]',
      )}
      aria-label={t('workspace.switchLabel')}
    >
      {tabs.map((tab) => (
        <button
          key={tab.mode}
          className={cn(
            'nomi-stepper__step',
            'inline-flex items-center px-3.5 py-[5px] border-0 rounded-full bg-transparent text-nomi-ink-60 font-inherit text-body-sm font-medium cursor-pointer',
            'transition-[background,color,box-shadow] ease-nomi-fast',
            'hover:text-nomi-ink',
            'data-[state=active]:bg-nomi-paper data-[state=active]:text-nomi-ink data-[state=active]:shadow-nomi-sm',
          )}
          type="button"
          aria-current={value === tab.mode ? 'page' : undefined}
          data-state={value === tab.mode ? 'active' : 'idle'}
          data-mode={tab.mode}
          onClick={() => onChange(tab.mode)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
