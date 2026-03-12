import { Pause, Play, Square, Gauge } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'

interface TtsControlBarProps {
  onPause: () => void
  onResume: () => void
  onStop: () => void
  isPaused: boolean
  rate: number
  onRateChange: (rate: number) => void
}

/** 语速预设步进值 */
const RATE_MIN = 0.5
const RATE_MAX = 2.0
const RATE_STEP = 0.25

/**
 * TTS 朗读控制条
 * 固定在消息列表底部，朗读时显示。
 * 包含：暂停/继续、停止、语速滑块 + 当前语速显示。
 */
export default function TtsControlBar({
  onPause,
  onResume,
  onStop,
  isPaused,
  rate,
  onRateChange,
}: TtsControlBarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 z-40",
          "bg-card border-t border-border px-4 py-2",
          "flex items-center gap-3",
          "animate-in slide-in-from-bottom-2 duration-200"
        )}
      >
        {/* 朗读状态指示 */}
        <div className="flex items-center gap-1.5 text-[12px] text-primary font-medium select-none">
          <span className={cn(
            "w-1.5 h-1.5 rounded-full bg-primary",
            !isPaused && "animate-pulse"
          )} />
          {isPaused ? '已暂停' : '朗读中'}
        </div>

        {/* 分隔线 */}
        <div className="w-px h-4 bg-border" />

        {/* 暂停 / 继续 按钮 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={isPaused ? onResume : onPause}
              className="h-7 w-7 text-foreground"
            >
              {isPaused ? <Play size={14} /> : <Pause size={14} />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {isPaused ? '继续朗读' : '暂停朗读'}
          </TooltipContent>
        </Tooltip>

        {/* 停止按钮 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onStop}
              className="h-7 w-7 text-foreground"
            >
              <Square size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">停止朗读</TooltipContent>
        </Tooltip>

        {/* 分隔线 */}
        <div className="w-px h-4 bg-border" />

        {/* 语速控制 */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground">
                <Gauge size={14} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">语速调节</TooltipContent>
          </Tooltip>

          <input
            type="range"
            min={RATE_MIN}
            max={RATE_MAX}
            step={RATE_STEP}
            value={rate}
            onChange={(e) => onRateChange(parseFloat(e.target.value))}
            className={cn(
              "w-20 h-1 appearance-none rounded-full cursor-pointer",
              "bg-border",
              "[&::-webkit-slider-thumb]:appearance-none",
              "[&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3",
              "[&::-webkit-slider-thumb]:rounded-full",
              "[&::-webkit-slider-thumb]:bg-primary",
              "[&::-webkit-slider-thumb]:cursor-pointer",
              "[&::-webkit-slider-thumb]:shadow-sm",
              "[&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3",
              "[&::-moz-range-thumb]:rounded-full",
              "[&::-moz-range-thumb]:bg-primary",
              "[&::-moz-range-thumb]:border-none",
              "[&::-moz-range-thumb]:cursor-pointer"
            )}
          />

          <span className="text-[11px] text-muted-foreground font-mono min-w-[32px] text-center select-none">
            {rate.toFixed(2).replace(/0$/, '')}x
          </span>
        </div>
      </div>
    </TooltipProvider>
  )
}
