"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as echarts from "echarts"

export interface CandleData {
  date: string
  open: number | null
  close: number | null
  high: number | null
  low: number | null
  volume: number
  last_close?: number | null
  turnover?: number | null
}

interface KLineChartProps {
  data: CandleData[]
  symbol: string
  height?: number
  klineType: string
  onKlineTypeChange: (type: string) => void
  onRefresh: () => void
}

const getCssVar = (name: string, fallback: string) => {
  if (typeof window === "undefined") return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

const formatNumber = (value: number | null | undefined, digits = 3) =>
  typeof value === "number" ? value.toFixed(digits) : "--"

const calculateMA = (data: CandleData[], period: number): (number | null)[] => {
  const ma: (number | null)[] = []
  for (let i = 0; i < data.length; i += 1) {
    if (i < period - 1) {
      ma.push(null)
      continue
    }
    let sum = 0
    for (let j = 0; j < period; j += 1) {
      sum += data[i - j].close ?? 0
    }
    ma.push(Number((sum / period).toFixed(4)))
  }
  return ma
}

// 计算EMA指数移动平均线（自适应数据量）
const calculateEMA = (values: (number | null)[], period: number): (number | null)[] => {
  const ema: (number | null)[] = []
  const validValues = values.filter(v => v !== null).length
  
  // 如果数据不足，使用实际数据量作为周期（自适应降级）
  const actualPeriod = Math.min(period, validValues)
  
  if (actualPeriod === 0) {
    return values.map(() => null)
  }
  
  const multiplier = 2 / (actualPeriod + 1)
  
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] === null) {
      ema.push(null)
      continue
    }
    
    if (i < actualPeriod - 1) {
      // 数据点不足时，使用已有数据计算简单平均
      let sum = 0
      let count = 0
      for (let j = 0; j <= i; j += 1) {
        if (values[j] !== null) {
          sum += values[j]!
          count++
        }
      }
      ema.push(count > 0 ? sum / count : null)
      continue
    }
    
    if (i === actualPeriod - 1) {
      // 第一个完整EMA值使用简单移动平均
      let sum = 0
      let count = 0
      for (let j = 0; j < actualPeriod; j += 1) {
        if (values[i - j] !== null) {
          sum += values[i - j]!
          count++
        }
      }
      ema.push(count > 0 ? sum / count : null)
    } else {
      // 后续EMA值 = (当前值 - 前一个EMA) * 乘数 + 前一个EMA
      const prevEMA = ema[i - 1]
      if (prevEMA !== null) {
        ema.push((values[i]! - prevEMA) * multiplier + prevEMA)
      } else {
        ema.push(values[i])
      }
    }
  }
  
  return ema
}

// 计算趋势带数据
interface TrendBandData {
  shortA: (number | null)[]  // 短期上轨 EMA(high, 24)
  shortB: (number | null)[]  // 短期下轨 EMA(low, 23)
  longA: (number | null)[]   // 长期上轨 EMA(high, 89)
  longB: (number | null)[]   // 长期下轨 EMA(low, 90)
  shortTrendType: number[]   // 短期趋势类型 1=上升 -1=下降 0=横盘
  longTrendType: number[]    // 长期趋势类型 1=上升 -1=下降 0=横盘
  shortF1: boolean[]
  shortF2: boolean[]
  shortCond1: boolean[]
  shortCond2: boolean[]
  shortCond3: boolean[]
  longF3: boolean[]
  longF4: boolean[]
  longCond4: boolean[]
  longCond5: boolean[]
  longCond6: boolean[]
  hasEnoughDataForShort: boolean  // 是否有足够数据计算短期趋势
  hasEnoughDataForLong: boolean   // 是否有足够数据计算长期趋势
}

const calculateTrendBands = (data: CandleData[]): TrendBandData => {
  const highs = data.map(d => d.high)
  const lows = data.map(d => d.low)
  
  // 检查数据是否充足（用于提示，但不影响计算）
  const hasEnoughDataForShort = data.length >= 24
  const hasEnoughDataForLong = data.length >= 90
  
  const shortA = calculateEMA(highs, 24)
  const shortB = calculateEMA(lows, 23)
  const longA = calculateEMA(highs, 89)
  const longB = calculateEMA(lows, 90)
  
  // 计算趋势类型与条件
  const shortTrendType: number[] = []
  const longTrendType: number[] = []
  const shortF1: boolean[] = []
  const shortF2: boolean[] = []
  const shortCond1: boolean[] = []
  const shortCond2: boolean[] = []
  const shortCond3: boolean[] = []
  const longF3: boolean[] = []
  const longF4: boolean[] = []
  const longCond4: boolean[] = []
  const longCond5: boolean[] = []
  const longCond6: boolean[] = []
  
  for (let i = 0; i < data.length; i += 1) {
    const close = data[i]?.close
    const currShortA = shortA[i]
    const currShortB = shortB[i]
    const prevShortA = i > 0 ? shortA[i - 1] : null
    const prevShortB = i > 0 ? shortB[i - 1] : null
    const hasShort = currShortA !== null && currShortB !== null && close !== null
    
    const f1 = hasShort && currShortA! > currShortB!
    const f2 = hasShort && close! < currShortA! && close! > currShortB!
    const cond1 = hasShort && prevShortA !== null && prevShortB !== null && currShortA! > prevShortA && currShortB! > prevShortB
    const cond2 = hasShort && prevShortA !== null && prevShortB !== null && currShortA! < prevShortA && currShortB! < prevShortB
    const cond3 = hasShort && !(cond1 || cond2)
    
    shortF1.push(Boolean(f1))
    shortF2.push(Boolean(f2))
    shortCond1.push(Boolean(cond1))
    shortCond2.push(Boolean(cond2))
    shortCond3.push(Boolean(cond3))
    if (cond1) shortTrendType.push(1)
    else if (cond2) shortTrendType.push(-1)
    else shortTrendType.push(0)
    
    const currLongA = longA[i]
    const currLongB = longB[i]
    const prevLongA = i > 0 ? longA[i - 1] : null
    const prevLongB = i > 0 ? longB[i - 1] : null
    const hasLong = currLongA !== null && currLongB !== null && close !== null
    
    const f3 = hasLong && currLongA! > currLongB!
    const f4 = hasLong && close! < currLongA! && close! > currLongB!
    const cond4 = hasLong && prevLongA !== null && prevLongB !== null && currLongA! > prevLongA && currLongB! > prevLongB
    const cond5 = hasLong && prevLongA !== null && prevLongB !== null && currLongA! < prevLongA && currLongB! < prevLongB
    const cond6 = hasLong && !(cond4 || cond5)
    
    longF3.push(Boolean(f3))
    longF4.push(Boolean(f4))
    longCond4.push(Boolean(cond4))
    longCond5.push(Boolean(cond5))
    longCond6.push(Boolean(cond6))
    if (cond4) longTrendType.push(1)
    else if (cond5) longTrendType.push(-1)
    else longTrendType.push(0)
  }
  
  return { 
    shortA, 
    shortB, 
    longA, 
    longB, 
    shortTrendType, 
    longTrendType,
    shortF1,
    shortF2,
    shortCond1,
    shortCond2,
    shortCond3,
    longF3,
    longF4,
    longCond4,
    longCond5,
    longCond6,
    hasEnoughDataForShort,
    hasEnoughDataForLong
  }
}

type SticklinePoint = [number, number, number]

const maskValues = (values: (number | null)[], mask: boolean[]) =>
  values.map((value, index) => (mask[index] ? value : null))

const buildSticklineData = (
  topValues: (number | null)[],
  bottomValues: (number | null)[],
  f1Values: boolean[],
  f2Values: boolean[],
  condValues: boolean[]
): SticklinePoint[] => {
  const result: SticklinePoint[] = []
  for (let i = 0; i < topValues.length; i += 1) {
    const top = topValues[i]
    const bottom = bottomValues[i]
    if (!f1Values[i] || f2Values[i] || !condValues[i]) continue
    if (top === null || bottom === null) continue
    result.push([i, top, bottom])
  }
  return result
}

export function KLineChart({
  data,
  symbol,
  height = 420,
  klineType,
  onKlineTypeChange,
  onRefresh,
}: KLineChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const axisRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)
  const axisInstance = useRef<echarts.ECharts | null>(null)
  const zoomWindowRef = useRef({ start: 0, end: 100 })
  const panFrameRef = useRef<number | null>(null)
  const pendingPanPercentRef = useRef(0)
  const touchStateRef = useRef<{
    lastX: number | null
    lastY: number | null
    startX: number | null
    startY: number | null
    pinchDistance: number | null
    pinchCenterRatio: number
    hasMoved: boolean
    directionLock: "undetermined" | "horizontal" | "vertical"
    isInspecting: boolean
    longPressTimer: number | null
  }>({
    lastX: null,
    lastY: null,
    startX: null,
    startY: null,
    pinchDistance: null,
    pinchCenterRatio: 0.5,
    hasMoved: false,
    directionLock: "undetermined",
    isInspecting: false,
    longPressTimer: null,
  })
  const mobileMousePanRef = useRef<{ active: boolean; lastX: number | null; lastY: number | null }>({
    active: false,
    lastX: null,
    lastY: null,
  })
  const touchInputDetectedRef = useRef(false)
  const [showVolume, setShowVolume] = useState(true)
  const [showMA, setShowMA] = useState(true)
  const [showTrendBands, setShowTrendBands] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const isIntraday = klineType === "K_RT"

  useEffect(() => {
    if (typeof window === "undefined") return
    const media = window.matchMedia("(max-width: 640px)")
    const sync = () => setIsMobile(media.matches)
    sync()
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])

  const chartData = useMemo(() => {
    // Some upstream payloads may contain trailing placeholder rows (date exists but
    // no valid OHLC/volume). Trim tail placeholders so the plot can fully use width.
    let lastValidIndex = data.length - 1
    while (lastValidIndex >= 0) {
      const item = data[lastValidIndex]
      const hasPrice =
        (typeof item.open === "number" && item.open > 0) ||
        (typeof item.close === "number" && item.close > 0) ||
        (typeof item.high === "number" && item.high > 0) ||
        (typeof item.low === "number" && item.low > 0)
      const hasVolume = typeof item.volume === "number" && item.volume > 0
      const hasTurnover = typeof item.turnover === "number" && item.turnover > 0
      if (hasPrice || hasVolume || hasTurnover) break
      lastValidIndex -= 1
    }
    const visibleData = lastValidIndex >= 0 ? data.slice(0, lastValidIndex + 1) : data

    const dates = visibleData.map((item) => item.date)
    const values = visibleData.map((item) => [item.open, item.close, item.low, item.high])
    const lineValues = visibleData.map((item) => item.close)
    const volumes = visibleData.map((item) => item.volume)
    const turnovers = visibleData.map((item) => item.turnover)
    const vwapValues: (number | null)[] = []
    let cumulativeTurnover = 0
    let cumulativeVolume = 0
    for (let i = 0; i < visibleData.length; i += 1) {
      const turnover = turnovers[i]
      const volume = volumes[i]
      if (typeof turnover === "number" && typeof volume === "number") {
        cumulativeTurnover += turnover
        cumulativeVolume += volume
      }
      vwapValues.push(cumulativeVolume > 0 ? cumulativeTurnover / cumulativeVolume : null)
    }
    const trendBands = calculateTrendBands(visibleData)
    const trendBandSeries = {
      shortAUp: maskValues(trendBands.shortA, trendBands.shortCond1),
      shortADown: maskValues(trendBands.shortA, trendBands.shortCond2),
      shortBUp: maskValues(trendBands.shortB, trendBands.shortCond1),
      shortBDown: maskValues(trendBands.shortB, trendBands.shortCond2),
      longAUp: maskValues(trendBands.longA, trendBands.longCond4),
      longADown: maskValues(trendBands.longA, trendBands.longCond5),
      longBUp: maskValues(trendBands.longB, trendBands.longCond4),
      longBDown: maskValues(trendBands.longB, trendBands.longCond5),
      shortStickUp: buildSticklineData(
        trendBands.shortA,
        trendBands.shortB,
        trendBands.shortF1,
        trendBands.shortF2,
        trendBands.shortCond1
      ),
      shortStickDown: buildSticklineData(
        trendBands.shortA,
        trendBands.shortB,
        trendBands.shortF1,
        trendBands.shortF2,
        trendBands.shortCond2
      ),
      shortStickSide: buildSticklineData(
        trendBands.shortA,
        trendBands.shortB,
        trendBands.shortF1,
        trendBands.shortF2,
        trendBands.shortCond3
      ),
      longStickUp: buildSticklineData(
        trendBands.longA,
        trendBands.longB,
        trendBands.longF3,
        trendBands.longF4,
        trendBands.longCond4
      ),
      longStickDown: buildSticklineData(
        trendBands.longA,
        trendBands.longB,
        trendBands.longF3,
        trendBands.longF4,
        trendBands.longCond5
      ),
      longStickSide: buildSticklineData(
        trendBands.longA,
        trendBands.longB,
        trendBands.longF3,
        trendBands.longF4,
        trendBands.longCond6
      ),
    }
    return {
      dates,
      values,
      lineValues,
      volumes,
      vwapValues,
      ma5: calculateMA(visibleData, 5),
      ma10: calculateMA(visibleData, 10),
      ma20: calculateMA(visibleData, 20),
      trendBands,
      trendBandSeries,
    }
  }, [data])

  useEffect(() => {
    if (!chartRef.current || !axisRef.current) return
    chartInstance.current?.dispose()
    axisInstance.current?.dispose()
    chartInstance.current = echarts.init(chartRef.current)
    axisInstance.current = echarts.init(axisRef.current)
    return () => {
      chartInstance.current?.dispose()
      axisInstance.current?.dispose()
    }
  }, [])

  useEffect(() => {
    if (!chartInstance.current || !axisInstance.current) return

    if (!data.length) {
      chartInstance.current.setOption({
        title: {
          text: "暂无数据",
          left: "center",
          top: "center",
          textStyle: {
            color: getCssVar("--muted-foreground", "#94a3b8"),
            fontSize: 14,
          },
        },
      })
      axisInstance.current.clear()
      return
    }

    const colors = {
      text: getCssVar("--foreground", "#e5e7eb"),
      textMuted: getCssVar("--muted-foreground", "#94a3b8"),
      border: getCssVar("--border", "#334155"),
      grid: getCssVar("--border", "#334155"),
      up: "#ef4444",
      down: "#10b981",
      ma5: getCssVar("--chart-1", "#6366f1"),
      ma10: getCssVar("--chart-2", "#0ea5e9"),
      ma20: getCssVar("--chart-4", "#a855f7"),
      tooltipBg: getCssVar("--card", "#0f172a"),
      tooltipBorder: getCssVar("--border", "#334155"),
      // 短期趋势带颜色
      shortTrendUp: "#2896FF",      // 短期上升趋势 - 亮蓝色
      shortTrendDown: "#0000FF",    // 短期下降趋势 - 深蓝色
      shortTrendSide: "#87CEEB",    // 短期横盘 - 天蓝色
      // 长期趋势带颜色
      longTrendUp: "#E3C46A",       // 长期上升趋势 - 柔和金黄
      longTrendDown: "#D4A85A",     // 长期下降趋势 - 柔和橙黄
      longTrendSide: "#D8C27A",     // 长期横盘 - 柔和黄
    }

    const hasVolume = showVolume && chartData.volumes.length > 0
    const controlTop = isMobile ? 92 : 88
    const showSliderZoom = false
    const zoomStart = isIntraday ? 0 : chartData.dates.length > 80 ? 70 : 0
    const desiredVolumeHeight = isMobile
      ? Math.max(150, Math.round(height * 0.3))
      : Math.max(190, Math.round(height * 0.36))
    // Prevent volume panel from overflowing when viewport is short.
    const maxVolumeHeight = Math.max(90, height - controlTop - 170)
    const volumeHeight = Math.min(desiredVolumeHeight, maxVolumeHeight)
    const zoomHeight = showSliderZoom ? 16 : 0
    const zoomBottom = showSliderZoom ? 4 : 0
    const volumeBottom = showSliderZoom ? zoomBottom + zoomHeight + 8 : 8
    const mainBottom = volumeBottom + volumeHeight + (isMobile ? 12 : 16)
    const chartRightPadding = isMobile ? "8px" : "40px"
    const xAxisLabelMargin = isMobile ? 6 : 10
    const trendLineWidth = isMobile ? 1.1 : 1.5
    const maLineWidth = isMobile ? 0.8 : 1
    const stickLineWidth = isMobile ? 1.4 : 2

    const priceValues = (isIntraday ? chartData.lineValues : chartData.values.flatMap((item) => item))
      .filter((value) => typeof value === "number") as number[]
    const volumeValues = chartData.volumes.filter((value) => typeof value === "number")
    const priceMin = priceValues.length ? Math.min(...priceValues) : 0
    const priceMax = priceValues.length ? Math.max(...priceValues) : 1
    const pricePadding = (priceMax - priceMin) * 0.1 || 1
    const volumeMax = volumeValues.length ? Math.max(...volumeValues) : 1

    const buildSticklineRenderer = (color: string) => (params: any, api: any) => {
      const index = api.value(0)
      const top = api.value(1)
      const bottom = api.value(2)
      if (top === null || bottom === null) return null
      const pointTop = api.coord([index, top])
      const pointBottom = api.coord([index, bottom])
      return {
        type: "line",
        shape: {
          x1: pointTop[0],
          y1: pointTop[1],
          x2: pointBottom[0],
          y2: pointBottom[1],
        },
        style: {
          stroke: color,
          lineWidth: stickLineWidth,
          opacity: 0.8,
        },
      }
    }

    const mainOption: echarts.EChartsOption = {
      // Keep re-render deterministic during rapid pan/zoom to avoid blank flashes.
      animation: false,
      tooltip: {
        trigger: "axis",
        triggerOn: isMobile ? "none" : "mousemove|click",
        transitionDuration: 0,
        position: (point: number[], _params: any, dom: HTMLElement, _rect: any, size: any) => {
          if (!isMobile) return point
          const [x, y] = point
          const viewWidth = size?.viewSize?.[0] ?? chartRef.current?.clientWidth ?? 0
          const viewHeight = size?.viewSize?.[1] ?? chartRef.current?.clientHeight ?? 0
          const boxWidth = size?.contentSize?.[0] ?? dom?.clientWidth ?? 0
          const boxHeight = size?.contentSize?.[1] ?? dom?.clientHeight ?? 0
          const margin = 8
          const useLeftCorner = x > viewWidth / 2
          const useTopCorner = y > viewHeight / 2
          const posX = useLeftCorner ? margin : Math.max(margin, viewWidth - boxWidth - margin)
          const posY = useTopCorner ? margin : Math.max(margin, viewHeight - boxHeight - margin)
          return [posX, posY]
        },
        axisPointer: {
          type: "cross",
          animation: false,
          lineStyle: {
            color: colors.border,
            width: 1,
            opacity: 0.8,
          },
        },
        backgroundColor: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
        borderWidth: 1,
        textStyle: {
          color: colors.text,
          fontSize: isMobile ? 10 : 12,
        },
        formatter: (params: any) => {
          if (!params || params.length === 0) return ""
          const dataIndex = params[0].dataIndex
          const date = chartData.dates[dataIndex]
          const candleValue = chartData.values[dataIndex]
          const volume = chartData.volumes[dataIndex]
          const [open, close, low, high] = candleValue || []
          const priceValue = isIntraday ? chartData.lineValues[dataIndex] : close
          if (priceValue === null || priceValue === undefined) return ""
          if (!isIntraday && (open === null || close === null || low === null || high === null)) return ""
          const prevClose = !isIntraday && dataIndex > 0 ? data[dataIndex - 1]?.close : null
          const refOpen = isIntraday
            ? (data[dataIndex]?.last_close ?? chartData.lineValues[0])
            : (prevClose ?? open)
          const changeValue =
            typeof refOpen === "number" ? priceValue - refOpen : 0
          const changeRate =
            typeof refOpen === "number" && refOpen !== 0
              ? ((priceValue - refOpen) / refOpen * 100).toFixed(2)
              : "0.00"
          const changeColor = priceValue >= (refOpen ?? priceValue) ? colors.up : colors.down
          const panelPadding = isMobile ? 6 : 10
          const panelMinWidth = isMobile ? 148 : 220
          const titleMarginBottom = isMobile ? 6 : 10
          const rowMarginBottom = isMobile ? 4 : 6
          const sectionMarginBottom = isMobile ? 6 : 8
          const tooltipFontSize = isMobile ? 10 : 12
          return `
            <div style="padding: ${panelPadding}px; min-width: ${panelMinWidth}px; font-size: ${tooltipFontSize}px;">
              <div style="font-weight: 600; margin-bottom: ${titleMarginBottom}px;">${symbol}</div>
              <div style="display: flex; justify-content: space-between; margin-bottom: ${rowMarginBottom}px;">
                <span style="color: ${colors.textMuted}">时间</span>
                <span style="color: ${colors.text}">${date}</span>
              </div>
              ${
                isIntraday
                  ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: ${sectionMarginBottom}px;">
                <span style="color: ${colors.textMuted}">价格</span>
                <span style="color: ${changeColor}">${Number(priceValue).toFixed(3)}</span>
              </div>
              `
                  : `
              <div style="display: flex; justify-content: space-between; margin-bottom: ${rowMarginBottom}px;">
                <span style="color: ${colors.textMuted}">开盘价</span>
                <span style="color: ${colors.text}">${formatNumber(open)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: ${rowMarginBottom}px;">
                <span style="color: ${colors.textMuted}">最高价</span>
                <span style="color: ${colors.up}">${formatNumber(high)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: ${rowMarginBottom}px;">
                <span style="color: ${colors.textMuted}">最低价</span>
                <span style="color: ${colors.down}">${formatNumber(low)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: ${sectionMarginBottom}px;">
                <span style="color: ${colors.textMuted}">收盘价</span>
                <span style="color: ${changeColor}">${formatNumber(close)}</span>
              </div>
              `
              }
              <div style="display: flex; justify-content: space-between; margin-bottom: ${rowMarginBottom}px;">
                <span style="color: ${colors.textMuted}">涨跌额</span>
                <span style="color: ${changeColor}">${changeValue.toFixed(3)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: ${rowMarginBottom}px;">
                <span style="color: ${colors.textMuted}">涨跌幅</span>
                <span style="color: ${changeColor}">${changeRate}%</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: ${colors.textMuted}">成交量</span>
                <span style="color: ${colors.text}">${(volume / 10000).toFixed(1)}万</span>
              </div>
            </div>
          `
        },
      },
      grid: hasVolume
        ? [
            {
              left: "0px",
              right: chartRightPadding,
              top: `${controlTop}px`,
              bottom: mainBottom,
              containLabel: false,
            },
            {
              left: "0px",
              right: chartRightPadding,
              height: volumeHeight,
              bottom: volumeBottom,
              containLabel: true,
            },
          ]
        : [
            {
              left: "0px",
              right: chartRightPadding,
              top: `${controlTop}px`,
              bottom: "40px",
            },
          ],
      xAxis: hasVolume
        ? [
            {
              type: "category",
              data: chartData.dates,
              boundaryGap: false,
              min: "dataMin",
              max: "dataMax",
              axisLine: { lineStyle: { color: colors.border } },
              axisLabel: {
                color: colors.textMuted,
                fontSize: isMobile ? 10 : 11,
                margin: xAxisLabelMargin,
                hideOverlap: true,
                showMinLabel: true,
              },
              splitLine: { show: false },
            },
            {
              type: "category",
              gridIndex: 1,
              data: chartData.dates,
              boundaryGap: false,
              min: "dataMin",
              max: "dataMax",
              axisLine: { lineStyle: { color: colors.border } },
              axisLabel: {
                color: colors.textMuted,
                fontSize: isMobile ? 10 : 11,
                margin: xAxisLabelMargin,
                hideOverlap: true,
                showMinLabel: true,
              },
              splitLine: { show: false },
            },
          ]
        : [
            {
              type: "category",
              data: chartData.dates,
              boundaryGap: false,
              min: "dataMin",
              max: "dataMax",
              axisLine: { lineStyle: { color: colors.border } },
              axisLabel: { color: colors.textMuted, fontSize: isMobile ? 10 : 11 },
              splitLine: { show: false },
            },
          ],
      yAxis: hasVolume
        ? [
            {
              scale: true,
              min: priceMin - pricePadding,
              max: priceMax + pricePadding,
              axisLine: { show: false },
              axisLabel: { show: false },
              splitLine: {
                lineStyle: { color: colors.grid, opacity: 0.3 },
              },
            },
            {
              scale: true,
              gridIndex: 1,
              min: 0,
              max: volumeMax,
              axisLine: { show: false },
              axisLabel: { show: false },
              splitLine: {
                lineStyle: { color: colors.grid, opacity: 0.3 },
              },
            },
          ]
        : [
            {
              scale: true,
              min: priceMin - pricePadding,
              max: priceMax + pricePadding,
              axisLine: { show: false },
              axisLabel: { show: false },
              splitLine: {
                lineStyle: { color: colors.grid, opacity: 0.3 },
              },
            },
          ],
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: hasVolume ? [0, 1] : [0],
          start: zoomStart,
          end: 100,
          zoomOnMouseWheel: false,
          moveOnMouseMove: false,
          moveOnMouseWheel: false,
          filterMode: "none",
          throttle: isMobile ? 10 : 24,
        },
        ...(showSliderZoom
          ? [{
              type: "slider" as const,
              xAxisIndex: hasVolume ? [0, 1] : [0],
              start: zoomStart,
              end: 100,
              height: zoomHeight,
              bottom: zoomBottom,
              borderColor: colors.border,
              fillerColor: "rgba(99, 102, 241, 0.15)",
              handleStyle: {
                color: colors.ma5,
                borderColor: colors.border,
              },
              dataBackground: {
                lineStyle: { color: colors.border },
                areaStyle: { color: "rgba(99, 102, 241, 0.1)" },
              },
              textStyle: {
                color: colors.textMuted,
                fontSize: 10,
              },
            }]
          : []),
      ],
      series: [
        ...(isIntraday
          ? [
              {
                name: "分时线",
                type: "line",
                data: chartData.lineValues,
                smooth: true,
                lineStyle: { width: trendLineWidth, color: colors.up },
                areaStyle: { color: "rgba(239, 68, 68, 0.2)" },
                showSymbol: false,
                emphasis: { disabled: true },
                z: 2,
              },
              ...(showTrendBands
                ? [
                    {
                      name: "分时均线",
                      type: "line",
                      data: chartData.vwapValues,
                      smooth: true,
                      lineStyle: { width: trendLineWidth, color: "#E3C46A" },
                      showSymbol: false,
                      emphasis: { disabled: true },
                      z: 3,
                    },
                  ]
                : []),
            ]
          : [
              {
                type: "candlestick",
                data: chartData.values,
                itemStyle: {
                  color: "transparent",
                  color0: colors.down,
                  borderColor: colors.up,
                  borderColor0: colors.down,
                  borderWidth: isMobile ? 0.8 : 1,
                },
                barMaxWidth: isMobile ? 8 : 14,
              },
            ]),
        ...(!isIntraday && showTrendBands
          ? [
              // 短期趋势带基准线
              {
                name: "短期上轨",
                type: "line",
                data: chartData.trendBands.shortA,
                smooth: true,
                lineStyle: { width: trendLineWidth, color: colors.shortTrendSide },
                showSymbol: false,
                emphasis: { disabled: true },
                blur: { lineStyle: { opacity: 1 } },
                z: 2,
              },
              {
                name: "短期下轨",
                type: "line",
                data: chartData.trendBands.shortB,
                smooth: true,
                lineStyle: { width: trendLineWidth, color: colors.shortTrendSide },
                showSymbol: false,
                emphasis: { disabled: true },
                blur: { lineStyle: { opacity: 1 } },
                z: 2,
              },
              // 短期趋势带高亮线（上升/下降）
              {
                type: "line",
                data: chartData.trendBandSeries.shortAUp,
                smooth: true,
                lineStyle: { width: trendLineWidth, color: colors.shortTrendUp },
                showSymbol: false,
                emphasis: { disabled: true },
                blur: { lineStyle: { opacity: 1 } },
                silent: true,
                z: 3,
              },
              {
                type: "line",
                data: chartData.trendBandSeries.shortADown,
                smooth: true,
                lineStyle: { width: trendLineWidth, color: colors.shortTrendDown },
                showSymbol: false,
                emphasis: { disabled: true },
                blur: { lineStyle: { opacity: 1 } },
                silent: true,
                z: 3,
              },
              {
                type: "line",
                data: chartData.trendBandSeries.shortBUp,
                smooth: true,
                lineStyle: { width: trendLineWidth, color: colors.shortTrendUp },
                showSymbol: false,
                emphasis: { disabled: true },
                blur: { lineStyle: { opacity: 1 } },
                silent: true,
                z: 3,
              },
              {
                type: "line",
                data: chartData.trendBandSeries.shortBDown,
                smooth: true,
                lineStyle: { width: trendLineWidth, color: colors.shortTrendDown },
                showSymbol: false,
                emphasis: { disabled: true },
                blur: { lineStyle: { opacity: 1 } },
                silent: true,
                z: 3,
              },
              // 长期趋势带基准线
              {
                name: "长期上轨",
                type: "line",
                data: chartData.trendBands.longA,
                smooth: true,
                lineStyle: { width: trendLineWidth, color: colors.longTrendSide },
                showSymbol: false,
                emphasis: { disabled: true },
                blur: { lineStyle: { opacity: 1 } },
                z: 2,
              },
              {
                name: "长期下轨",
                type: "line",
                data: chartData.trendBands.longB,
                smooth: true,
                lineStyle: { width: trendLineWidth, color: colors.longTrendSide },
                showSymbol: false,
                emphasis: { disabled: true },
                blur: { lineStyle: { opacity: 1 } },
                z: 2,
              },
              // 长期趋势带高亮线（上升/下降）
              {
                type: "line",
                data: chartData.trendBandSeries.longAUp,
                smooth: true,
                lineStyle: { width: trendLineWidth, color: colors.longTrendUp },
                showSymbol: false,
                emphasis: { disabled: true },
                blur: { lineStyle: { opacity: 1 } },
                silent: true,
                z: 3,
              },
              {
                type: "line",
                data: chartData.trendBandSeries.longADown,
                smooth: true,
                lineStyle: { width: trendLineWidth, color: colors.longTrendDown },
                showSymbol: false,
                emphasis: { disabled: true },
                blur: { lineStyle: { opacity: 1 } },
                silent: true,
                z: 3,
              },
              {
                type: "line",
                data: chartData.trendBandSeries.longBUp,
                smooth: true,
                lineStyle: { width: trendLineWidth, color: colors.longTrendUp },
                showSymbol: false,
                emphasis: { disabled: true },
                blur: { lineStyle: { opacity: 1 } },
                silent: true,
                z: 3,
              },
              {
                type: "line",
                data: chartData.trendBandSeries.longBDown,
                smooth: true,
                lineStyle: { width: trendLineWidth, color: colors.longTrendDown },
                showSymbol: false,
                emphasis: { disabled: true },
                blur: { lineStyle: { opacity: 1 } },
                silent: true,
                z: 3,
              },
              // 短期趋势带柱状线
              {
                type: "custom",
                renderItem: buildSticklineRenderer(colors.shortTrendUp),
                data: chartData.trendBandSeries.shortStickUp,
                silent: true,
                z: 1,
              },
              {
                type: "custom",
                renderItem: buildSticklineRenderer(colors.shortTrendDown),
                data: chartData.trendBandSeries.shortStickDown,
                silent: true,
                z: 1,
              },
              {
                type: "custom",
                renderItem: buildSticklineRenderer(colors.shortTrendSide),
                data: chartData.trendBandSeries.shortStickSide,
                silent: true,
                z: 1,
              },
              // 长期趋势带柱状线
              {
                type: "custom",
                renderItem: buildSticklineRenderer(colors.longTrendUp),
                data: chartData.trendBandSeries.longStickUp,
                silent: true,
                z: 0,
              },
              {
                type: "custom",
                renderItem: buildSticklineRenderer(colors.longTrendDown),
                data: chartData.trendBandSeries.longStickDown,
                silent: true,
                z: 0,
              },
              {
                type: "custom",
                renderItem: buildSticklineRenderer(colors.longTrendSide),
                data: chartData.trendBandSeries.longStickSide,
                silent: true,
                z: 0,
              },
            ]
          : []),
        ...(!isIntraday && showMA
          ? [
              {
                name: "MA5",
                type: "line",
                data: chartData.ma5,
                smooth: true,
                lineStyle: { width: maLineWidth, color: colors.ma5 },
                showSymbol: false,
                emphasis: { disabled: true },
                blur: { lineStyle: { opacity: 1 } },
              },
              {
                name: "MA10",
                type: "line",
                data: chartData.ma10,
                smooth: true,
                lineStyle: { width: maLineWidth, color: colors.ma10 },
                showSymbol: false,
                emphasis: { disabled: true },
                blur: { lineStyle: { opacity: 1 } },
              },
              {
                name: "MA20",
                type: "line",
                data: chartData.ma20,
                smooth: true,
                lineStyle: { width: maLineWidth, color: colors.ma20 },
                showSymbol: false,
                emphasis: { disabled: true },
                blur: { lineStyle: { opacity: 1 } },
              },
            ]
          : []),
        ...(hasVolume
          ? [
              {
                type: "bar",
                xAxisIndex: 1,
                yAxisIndex: 1,
                data: chartData.volumes,
                itemStyle: {
                  color: (params: any) => {
                    if (isIntraday) {
                      const current = chartData.lineValues[params.dataIndex]
                      const prev = chartData.lineValues[params.dataIndex - 1]
                      if (current === null || current === undefined) return colors.textMuted
                      if (prev === null || prev === undefined) return colors.textMuted
                      return current >= prev ? colors.up : colors.down
                    }
                    const candleValue = chartData.values[params.dataIndex]
                    if (!candleValue) return colors.textMuted
                    const [open, close] = candleValue
                    if (open === null || close === null) return colors.textMuted
                    return close >= open ? colors.up : colors.down
                  },
                },
              },
            ]
          : []),
      ] as echarts.SeriesOption[],
      legend: isMobile
        ? undefined
        : !isIntraday && showMA
        ? {
            data: ["MA5", "MA10", "MA20"],
            top: 60,
            left: 12,
            textStyle: { color: colors.textMuted, fontSize: 11 },
            itemWidth: 12,
            itemHeight: 8,
          }
        : isIntraday && showTrendBands
        ? {
            data: ["分时均线"],
            top: 60,
            left: 12,
            textStyle: { color: colors.textMuted, fontSize: 11 },
            itemWidth: 12,
            itemHeight: 8,
          }
        : showTrendBands
        ? {
            data: ["短期上轨", "短期下轨", "长期上轨", "长期下轨"],
            top: 60,
            left: 12,
            textStyle: { color: colors.textMuted, fontSize: 11 },
            itemWidth: 12,
            itemHeight: 8,
          }
        : undefined,
    }

    const axisOption: echarts.EChartsOption = {
      animation: false,
      grid: hasVolume
        ? [
            {
              left: "10px",
              right: "10px",
              top: `${controlTop}px`,
              bottom: mainBottom,
              containLabel: true,
            },
            {
              left: "10px",
              right: "10px",
              height: volumeHeight,
              bottom: volumeBottom,
              containLabel: true,
            },
          ]
        : [
            {
              left: "10px",
              right: "10px",
              top: `${controlTop}px`,
              bottom: "40px",
              containLabel: true,
            },
          ],
      xAxis: hasVolume
        ? [
            { type: "category", data: chartData.dates, show: false },
            { type: "category", gridIndex: 1, data: chartData.dates, show: false },
          ]
        : [{ type: "category", data: chartData.dates, show: false }],
      yAxis: hasVolume
        ? [
            {
              scale: true,
              min: priceMin - pricePadding,
              max: priceMax + pricePadding,
              axisLine: { show: false },
              axisTick: { show: false },
              axisLabel: {
                color: colors.textMuted,
                fontSize: isMobile ? 10 : 11,
                margin: 8,
                align: "right",
                formatter: (value: number) => value.toFixed(2),
              },
              splitLine: { show: false },
            },
            {
              scale: true,
              gridIndex: 1,
              min: 0,
              max: volumeMax,
              axisLine: { show: false },
              axisTick: { show: false },
              axisLabel: {
                color: colors.textMuted,
                fontSize: isMobile ? 10 : 11,
                margin: 8,
                align: "right",
                formatter: (value: number) => (value / 10000).toFixed(0) + "w",
              },
              splitLine: { show: false },
            },
          ]
        : [
            {
              scale: true,
              min: priceMin - pricePadding,
              max: priceMax + pricePadding,
              axisLine: { show: false },
              axisTick: { show: false },
              axisLabel: {
                color: colors.textMuted,
                fontSize: isMobile ? 10 : 11,
                margin: 8,
                align: "right",
                formatter: (value: number) => value.toFixed(2),
              },
              splitLine: { show: false },
            },
          ],
      series: [],
    }

    chartInstance.current.clear()
    axisInstance.current.clear()
    chartInstance.current.setOption(mainOption, true)
    axisInstance.current.setOption(axisOption, true)
    zoomWindowRef.current = { start: zoomStart, end: 100 }

    const handleDataZoom = (event: any) => {
      const payload = Array.isArray(event?.batch) ? event.batch[0] : event
      if (!payload) return
      const nextStart = typeof payload.start === "number" ? payload.start : zoomWindowRef.current.start
      const nextEnd = typeof payload.end === "number" ? payload.end : zoomWindowRef.current.end
      zoomWindowRef.current = { start: nextStart, end: nextEnd }
    }
    chartInstance.current.on("datazoom", handleDataZoom)

    const zr = chartInstance.current.getZr()
    const setCursor = (cursor: string) => zr.setCursorStyle(cursor)
    setCursor(isMobile ? "default" : "crosshair")
    // Mobile drag needs a larger gain so short swipes can move visible window enough.
    const mobilePanGain = 2.4

    const panByPercent = (shiftPercent: number) => {
      if (!chartInstance.current) return
      if (Math.abs(shiftPercent) < 0.01) return
      const span = Math.max(1, zoomWindowRef.current.end - zoomWindowRef.current.start)
      if (span >= 100) return
      const maxStart = Math.max(0, 100 - span)
      const nextStart = Math.max(0, Math.min(maxStart, zoomWindowRef.current.start + shiftPercent))
      const nextEnd = nextStart + span
      zoomWindowRef.current = { start: nextStart, end: nextEnd }
      chartInstance.current.dispatchAction({
        type: "dataZoom",
        dataZoomIndex: 0,
        start: nextStart,
        end: nextEnd,
      })
    }

    const schedulePan = (shiftPercent: number) => {
      pendingPanPercentRef.current += shiftPercent
      if (panFrameRef.current !== null) return
      panFrameRef.current = window.requestAnimationFrame(() => {
        const pending = pendingPanPercentRef.current
        pendingPanPercentRef.current = 0
        panFrameRef.current = null
        panByPercent(pending)
      })
    }

    const zoomByFactor = (factor: number, anchorRatio = 0.5) => {
      if (!chartInstance.current) return
      const span = Math.max(1, zoomWindowRef.current.end - zoomWindowRef.current.start)
      const nextSpan = Math.max(5, Math.min(100, span * factor))
      const clampedAnchorRatio = Math.max(0, Math.min(1, anchorRatio))
      const anchor = zoomWindowRef.current.start + span * clampedAnchorRatio
      const maxStart = Math.max(0, 100 - nextSpan)
      const nextStart = Math.max(0, Math.min(maxStart, anchor - nextSpan * clampedAnchorRatio))
      const nextEnd = nextStart + nextSpan
      zoomWindowRef.current = { start: nextStart, end: nextEnd }
      chartInstance.current.dispatchAction({
        type: "dataZoom",
        dataZoomIndex: 0,
        start: nextStart,
        end: nextEnd,
      })
    }

    const zoomByDelta = (deltaY: number, offsetX?: number) => {
      if (!chartInstance.current) return
      const factor = deltaY < 0 ? 0.88 : 1.14
      const plotWidth = Math.max(1, chartInstance.current.getWidth())
      const rawRatio = typeof offsetX === "number" ? offsetX / plotWidth : 0.5
      zoomByFactor(factor, rawRatio)
    }

    const getMobileShiftPercent = (deltaX: number) => {
      if (!chartInstance.current) return 0
      const plotWidth = Math.max(1, chartInstance.current.getWidth())
      const span = Math.max(1, zoomWindowRef.current.end - zoomWindowRef.current.start)
      const rawShiftPercent = -(deltaX / plotWidth) * span * mobilePanGain
      const minShiftPercent = Math.max(0.28, span * 0.006)
      if (Math.abs(rawShiftPercent) >= minShiftPercent) return rawShiftPercent
      return Math.sign(rawShiftPercent || deltaX) * minShiftPercent
    }

    const handleMouseWheel = (event: any) => {
      if (isMobile || !chartInstance.current) return
      const nativeEvent = event?.event
      const deltaX = typeof nativeEvent?.deltaX === "number" ? nativeEvent.deltaX : 0
      const deltaY = typeof nativeEvent?.deltaY === "number" ? nativeEvent.deltaY : 0
      const offsetX = typeof event?.offsetX === "number" ? event.offsetX : undefined
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 0) {
        const plotWidth = Math.max(1, chartInstance.current.getWidth())
        const span = Math.max(1, zoomWindowRef.current.end - zoomWindowRef.current.start)
        const shiftPercent = (deltaX / plotWidth) * span
        schedulePan(shiftPercent)
      } else if (Math.abs(deltaY) > 0) {
        zoomByDelta(deltaY, offsetX)
      }
      nativeEvent?.preventDefault?.()
      nativeEvent?.stopPropagation?.()
    }

    const hideInspector = () => {
      if (!chartInstance.current) return
      chartInstance.current.dispatchAction({ type: "hideTip" })
      touchStateRef.current.isInspecting = false
    }

    const clearLongPressTimer = () => {
      if (touchStateRef.current.longPressTimer !== null) {
        window.clearTimeout(touchStateRef.current.longPressTimer)
        touchStateRef.current.longPressTimer = null
      }
    }

    const showInspectorAtClient = (clientX: number, clientY: number) => {
      if (!chartInstance.current || !chartRef.current) return
      const rect = chartRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
      const y = Math.max(0, Math.min(rect.height, clientY - rect.top))
      chartInstance.current.dispatchAction({
        type: "showTip",
        x,
        y,
      })
    }

    const handleTouchStart = (event: any) => {
      if (!isMobile || !chartRef.current) return
      const nativeEvent = event?.event as TouchEvent | undefined
      const touches = nativeEvent?.touches
      if (!touches || touches.length === 0) return
      touchInputDetectedRef.current = true
      mobileMousePanRef.current.active = false
      mobileMousePanRef.current.lastX = null
      mobileMousePanRef.current.lastY = null
      clearLongPressTimer()
      if (touches.length >= 2) {
        hideInspector()
        const [a, b] = [touches[0], touches[1]]
        const dx = a.clientX - b.clientX
        const dy = a.clientY - b.clientY
        touchStateRef.current.pinchDistance = Math.hypot(dx, dy)
        const rect = chartRef.current.getBoundingClientRect()
        const centerX = (a.clientX + b.clientX) / 2
        touchStateRef.current.pinchCenterRatio = Math.max(0, Math.min(1, (centerX - rect.left) / Math.max(1, rect.width)))
        touchStateRef.current.lastX = null
        touchStateRef.current.lastY = null
        touchStateRef.current.startX = null
        touchStateRef.current.startY = null
        touchStateRef.current.directionLock = "undetermined"
        return
      }
      const touch = touches[0]
      hideInspector()
      touchStateRef.current.lastX = touch.clientX
      touchStateRef.current.lastY = touch.clientY
      touchStateRef.current.startX = touch.clientX
      touchStateRef.current.startY = touch.clientY
      touchStateRef.current.pinchDistance = null
      touchStateRef.current.hasMoved = false
      touchStateRef.current.directionLock = "undetermined"
      touchStateRef.current.isInspecting = false
      touchStateRef.current.longPressTimer = window.setTimeout(() => {
        touchStateRef.current.longPressTimer = null
        if (touchStateRef.current.hasMoved) return
        const inspectX = touchStateRef.current.lastX
        const inspectY = touchStateRef.current.lastY
        if (inspectX === null || inspectY === null) return
        touchStateRef.current.isInspecting = true
        showInspectorAtClient(inspectX, inspectY)
      }, 180)
    }

    const handleTouchMove = (event: any) => {
      if (!isMobile || !chartInstance.current || !chartRef.current) return
      const nativeEvent = event?.event as TouchEvent | undefined
      const touches = nativeEvent?.touches
      if (!touches || touches.length === 0) return

      if (touches.length >= 2) {
        clearLongPressTimer()
        hideInspector()
        const [a, b] = [touches[0], touches[1]]
        const dx = a.clientX - b.clientX
        const dy = a.clientY - b.clientY
        const distance = Math.hypot(dx, dy)
        if (touchStateRef.current.pinchDistance === null) {
          touchStateRef.current.pinchDistance = distance
          return
        }
        if (distance > 0 && touchStateRef.current.pinchDistance > 0) {
          const scale = distance / touchStateRef.current.pinchDistance
          if (Math.abs(scale - 1) > 0.01) {
            zoomByFactor(1 / scale, touchStateRef.current.pinchCenterRatio)
            touchStateRef.current.pinchDistance = distance
            nativeEvent?.preventDefault?.()
            nativeEvent?.stopPropagation?.()
          }
        }
        return
      }

      const touch = touches[0]
      if (touchStateRef.current.lastX === null || touchStateRef.current.lastY === null) {
        touchStateRef.current.lastX = touch.clientX
        touchStateRef.current.lastY = touch.clientY
        return
      }
      const movedFromStartX = touchStateRef.current.startX === null ? 0 : touch.clientX - touchStateRef.current.startX
      const movedFromStartY = touchStateRef.current.startY === null ? 0 : touch.clientY - touchStateRef.current.startY
      const movedDistance = Math.hypot(movedFromStartX, movedFromStartY)
      const deltaX = touch.clientX - touchStateRef.current.lastX
      touchStateRef.current.lastX = touch.clientX
      touchStateRef.current.lastY = touch.clientY
      if (movedDistance > 4) {
        touchStateRef.current.hasMoved = true
      }
      if (!touchStateRef.current.isInspecting && movedDistance > 6) {
        clearLongPressTimer()
      }
      if (touchStateRef.current.directionLock === "undetermined" && movedDistance > 5) {
        const absX = Math.abs(movedFromStartX)
        const absY = Math.abs(movedFromStartY)
        touchStateRef.current.directionLock = absX >= absY ? "horizontal" : "vertical"
      }
      if (touchStateRef.current.isInspecting) {
        showInspectorAtClient(touch.clientX, touch.clientY)
        nativeEvent?.preventDefault?.()
        nativeEvent?.stopPropagation?.()
        return
      }
      if (touchStateRef.current.directionLock === "vertical") return
      if (Math.abs(deltaX) < 0.35) return
      const shiftPercent = getMobileShiftPercent(deltaX)
      schedulePan(shiftPercent)
      nativeEvent?.preventDefault?.()
      nativeEvent?.stopPropagation?.()
    }

    const handleTouchEnd = (event: any) => {
      if (!isMobile) return
      const nativeEvent = event?.event as TouchEvent | undefined
      const touches = nativeEvent?.touches
      clearLongPressTimer()
      if (touches && touches.length >= 2) {
        const [a, b] = [touches[0], touches[1]]
        const dx = a.clientX - b.clientX
        const dy = a.clientY - b.clientY
        touchStateRef.current.pinchDistance = Math.hypot(dx, dy)
        touchStateRef.current.lastX = null
        touchStateRef.current.lastY = null
        touchStateRef.current.startX = null
        touchStateRef.current.startY = null
        touchStateRef.current.isInspecting = false
        return
      }
      if (touches && touches.length === 1) {
        touchStateRef.current.lastX = touches[0].clientX
        touchStateRef.current.lastY = touches[0].clientY
        touchStateRef.current.startX = touches[0].clientX
        touchStateRef.current.startY = touches[0].clientY
        touchStateRef.current.pinchDistance = null
        touchStateRef.current.hasMoved = false
        touchStateRef.current.directionLock = "undetermined"
        touchStateRef.current.isInspecting = false
        return
      }
      hideInspector()
      touchStateRef.current.lastX = null
      touchStateRef.current.lastY = null
      touchStateRef.current.startX = null
      touchStateRef.current.startY = null
      touchStateRef.current.pinchDistance = null
      touchStateRef.current.hasMoved = false
      touchStateRef.current.directionLock = "undetermined"
      touchStateRef.current.isInspecting = false
    }

    // Fallback for Chrome mobile emulation: mouse drag acts as single-finger pan.
    const handleMobileMouseDown = (event: any) => {
      if (!isMobile) return
      if (event?.event?.button !== 0) return
      if (touchInputDetectedRef.current) return
      mobileMousePanRef.current.active = true
      mobileMousePanRef.current.lastX = typeof event?.offsetX === "number" ? event.offsetX : null
      mobileMousePanRef.current.lastY = typeof event?.offsetY === "number" ? event.offsetY : null
    }

    const handleMobileMouseMove = (event: any) => {
      if (!isMobile || !mobileMousePanRef.current.active || !chartInstance.current) return
      const currentX = typeof event?.offsetX === "number" ? event.offsetX : null
      const currentY = typeof event?.offsetY === "number" ? event.offsetY : null
      if (currentX === null || currentY === null) return
      if (mobileMousePanRef.current.lastX === null || mobileMousePanRef.current.lastY === null) {
        mobileMousePanRef.current.lastX = currentX
        mobileMousePanRef.current.lastY = currentY
        return
      }
      const deltaX = currentX - mobileMousePanRef.current.lastX
      mobileMousePanRef.current.lastX = currentX
      mobileMousePanRef.current.lastY = currentY
      if (Math.abs(deltaX) < 0.35) return
      const shiftPercent = getMobileShiftPercent(deltaX)
      schedulePan(shiftPercent)
    }

    const handleMobileMouseUp = () => {
      mobileMousePanRef.current.active = false
      mobileMousePanRef.current.lastX = null
      mobileMousePanRef.current.lastY = null
    }

    const handleGlobalOut = () => {
      clearLongPressTimer()
      hideInspector()
      pendingPanPercentRef.current = 0
      if (panFrameRef.current !== null) {
        window.cancelAnimationFrame(panFrameRef.current)
        panFrameRef.current = null
      }
      touchStateRef.current.lastX = null
      touchStateRef.current.lastY = null
      touchStateRef.current.startX = null
      touchStateRef.current.startY = null
      touchStateRef.current.pinchDistance = null
      touchStateRef.current.hasMoved = false
      touchStateRef.current.directionLock = "undetermined"
      mobileMousePanRef.current.active = false
      mobileMousePanRef.current.lastX = null
      mobileMousePanRef.current.lastY = null
    }

    zr.on("mousewheel", handleMouseWheel)
    zr.on("mousedown", handleMobileMouseDown)
    zr.on("mousemove", handleMobileMouseMove)
    zr.on("mouseup", handleMobileMouseUp)
    zr.on("touchstart", handleTouchStart)
    zr.on("touchmove", handleTouchMove)
    zr.on("touchend", handleTouchEnd)
    zr.on("globalout", handleGlobalOut)

    const chartElement = chartRef.current
    const handlePointerDown = (event: PointerEvent) => {
      if (!isMobile) return
      const pointerType = event.pointerType || "mouse"
      if (pointerType === "pen") return
      if (pointerType === "touch" && touchInputDetectedRef.current) return
      if (pointerType !== "touch" && pointerType !== "mouse") return
      if (pointerType === "mouse" && touchInputDetectedRef.current) return
      clearLongPressTimer()
      touchStateRef.current.hasMoved = false
      touchStateRef.current.startX = event.clientX
      touchStateRef.current.startY = event.clientY
      touchStateRef.current.lastX = event.clientX
      touchStateRef.current.lastY = event.clientY
      touchStateRef.current.isInspecting = false
      touchStateRef.current.longPressTimer = window.setTimeout(() => {
        touchStateRef.current.longPressTimer = null
        if (touchStateRef.current.hasMoved) return
        touchStateRef.current.isInspecting = true
        showInspectorAtClient(event.clientX, event.clientY)
      }, 180)
      mobileMousePanRef.current.active = true
      mobileMousePanRef.current.lastX = event.clientX
      mobileMousePanRef.current.lastY = event.clientY
    }
    const handlePointerMove = (event: PointerEvent) => {
      if (!isMobile || !mobileMousePanRef.current.active || !chartInstance.current) return
      const pointerType = event.pointerType || "mouse"
      if (pointerType === "pen") return
      if (pointerType === "touch" && touchInputDetectedRef.current) return
      if (pointerType !== "touch" && pointerType !== "mouse") return
      if (pointerType === "mouse" && touchInputDetectedRef.current) return
      if (mobileMousePanRef.current.lastX === null || mobileMousePanRef.current.lastY === null) {
        mobileMousePanRef.current.lastX = event.clientX
        mobileMousePanRef.current.lastY = event.clientY
        return
      }
      const deltaX = event.clientX - mobileMousePanRef.current.lastX
      mobileMousePanRef.current.lastX = event.clientX
      mobileMousePanRef.current.lastY = event.clientY
      const movedFromStartX = touchStateRef.current.startX === null ? 0 : event.clientX - touchStateRef.current.startX
      const movedFromStartY = touchStateRef.current.startY === null ? 0 : event.clientY - touchStateRef.current.startY
      const movedDistance = Math.hypot(movedFromStartX, movedFromStartY)
      if (movedDistance > 4) touchStateRef.current.hasMoved = true
      if (!touchStateRef.current.isInspecting && movedDistance > 6) {
        clearLongPressTimer()
      }
      if (touchStateRef.current.isInspecting) {
        showInspectorAtClient(event.clientX, event.clientY)
        event.preventDefault()
        return
      }
      if (Math.abs(deltaX) < 0.35) return
      const shiftPercent = getMobileShiftPercent(deltaX)
      schedulePan(shiftPercent)
      event.preventDefault()
    }
    const handlePointerUp = () => {
      clearLongPressTimer()
      hideInspector()
      mobileMousePanRef.current.active = false
      mobileMousePanRef.current.lastX = null
      mobileMousePanRef.current.lastY = null
      touchStateRef.current.lastX = null
      touchStateRef.current.lastY = null
      touchStateRef.current.startX = null
      touchStateRef.current.startY = null
      touchStateRef.current.isInspecting = false
      touchStateRef.current.hasMoved = false
    }
    chartElement?.addEventListener("pointerdown", handlePointerDown)
    chartElement?.addEventListener("pointermove", handlePointerMove, { passive: false })
    chartElement?.addEventListener("pointerup", handlePointerUp)
    chartElement?.addEventListener("pointercancel", handlePointerUp)
    chartElement?.addEventListener("pointerleave", handlePointerUp)

    const handleResize = () => {
      chartInstance.current?.resize()
      axisInstance.current?.resize()
    }
    window.addEventListener("resize", handleResize)
    return () => {
      chartInstance.current?.off("datazoom", handleDataZoom)
      zr.off("mousewheel", handleMouseWheel)
      zr.off("mousedown", handleMobileMouseDown)
      zr.off("mousemove", handleMobileMouseMove)
      zr.off("mouseup", handleMobileMouseUp)
      zr.off("touchstart", handleTouchStart)
      zr.off("touchmove", handleTouchMove)
      zr.off("touchend", handleTouchEnd)
      zr.off("globalout", handleGlobalOut)
      if (panFrameRef.current !== null) {
        window.cancelAnimationFrame(panFrameRef.current)
        panFrameRef.current = null
      }
      pendingPanPercentRef.current = 0
      touchStateRef.current.lastX = null
      touchStateRef.current.lastY = null
      touchStateRef.current.startX = null
      touchStateRef.current.startY = null
      touchStateRef.current.pinchDistance = null
      touchStateRef.current.hasMoved = false
      touchStateRef.current.directionLock = "undetermined"
      touchStateRef.current.isInspecting = false
      clearLongPressTimer()
      mobileMousePanRef.current.active = false
      mobileMousePanRef.current.lastX = null
      mobileMousePanRef.current.lastY = null
      chartElement?.removeEventListener("pointerdown", handlePointerDown)
      chartElement?.removeEventListener("pointermove", handlePointerMove)
      chartElement?.removeEventListener("pointerup", handlePointerUp)
      chartElement?.removeEventListener("pointercancel", handlePointerUp)
      chartElement?.removeEventListener("pointerleave", handlePointerUp)
      window.removeEventListener("resize", handleResize)
    }
  }, [chartData, data.length, showMA, showVolume, showTrendBands, symbol, height, isMobile])

  return (
    <div className="relative flex w-full flex-col" style={{ height }}>
      <div className="absolute left-2 right-2 top-2 z-10 flex items-center justify-between gap-1.5 whitespace-nowrap rounded-full border bg-background/90 px-1.5 py-0.5 shadow-sm sm:left-3 sm:right-3 sm:gap-2 sm:px-2 sm:py-1">
        <div className="flex items-center gap-1 shrink-0">
          {[
            { label: "分时", value: "K_RT" },
            { label: "日K", value: "K_DAY" },
            { label: "周K", value: "K_WEEK" },
            { label: "月K", value: "K_MON" },
            { label: "季K", value: "K_QUARTER" },
            { label: "年K", value: "K_YEAR" },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onKlineTypeChange(item.value)}
              className={`shrink-0 rounded-full px-1 py-0.5 text-[9px] sm:px-2 sm:py-1 sm:text-xs transition ${
                klineType === item.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="ml-auto mx-0.5 h-3.5 w-px shrink-0 bg-border sm:mx-1 sm:h-4" />
        <div className="flex items-center gap-1 shrink-0 sm:gap-2">
          {!isIntraday ? (
            <>
              <button
                type="button"
                onClick={() => setShowMA((prev) => !prev)}
                className={`rounded-md border px-1 py-0.5 text-[9px] sm:px-2 sm:py-1 sm:text-xs transition ${
                  showMA ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"
                }`}
              >
                MA
              </button>
              <button
                type="button"
                onClick={() => setShowTrendBands((prev) => !prev)}
                className={`rounded-md border px-1 py-0.5 text-[9px] sm:px-2 sm:py-1 sm:text-xs transition ${
                  showTrendBands ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"
                }`}
              >
                趋势
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setShowVolume((prev) => !prev)}
            className={`rounded-md border px-1 py-0.5 text-[9px] sm:px-2 sm:py-1 sm:text-xs transition ${
              showVolume ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"
            }`}
          >
            成交量
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="flex h-5 w-5 sm:h-7 sm:w-7 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
            aria-label="刷新"
          >
            ↻
          </button>
        </div>
      </div>
      <div className={`grid h-full w-full ${isMobile ? "grid-cols-[56px_1fr]" : "grid-cols-[84px_1fr]"}`}>
        <div ref={axisRef} className="h-full w-full pointer-events-none" />
        <div ref={chartRef} className="h-full w-full [touch-action:none]" />
      </div>
    </div>
  )
}

