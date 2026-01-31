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
  const [showVolume, setShowVolume] = useState(true)
  const [showMA, setShowMA] = useState(true)
  const [showTrendBands, setShowTrendBands] = useState(true)
  const isIntraday = klineType === "K_RT"

  const chartData = useMemo(() => {
    const dates = data.map((item) => item.date)
    const values = data.map((item) => [item.open, item.close, item.low, item.high])
    const lineValues = data.map((item) => item.close)
    const volumes = data.map((item) => item.volume)
    const turnovers = data.map((item) => item.turnover)
    const vwapValues: (number | null)[] = []
    let cumulativeTurnover = 0
    let cumulativeVolume = 0
    for (let i = 0; i < data.length; i += 1) {
      const turnover = turnovers[i]
      const volume = volumes[i]
      if (typeof turnover === "number" && typeof volume === "number") {
        cumulativeTurnover += turnover
        cumulativeVolume += volume
      }
      vwapValues.push(cumulativeVolume > 0 ? cumulativeTurnover / cumulativeVolume : null)
    }
    const trendBands = calculateTrendBands(data)
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
      ma5: calculateMA(data, 5),
      ma10: calculateMA(data, 10),
      ma20: calculateMA(data, 20),
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
    const zoomStart = isIntraday ? 0 : chartData.dates.length > 80 ? 70 : 0
    const volumeHeight = Math.max(190, Math.round(height * 0.36))
    const zoomHeight = 16
    const zoomBottom = 4
    const volumeBottom = zoomBottom + zoomHeight + 8
    const mainBottom = volumeBottom + volumeHeight + 16

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
          lineWidth: 2,
          opacity: 0.8,
        },
      }
    }

    const mainOption: echarts.EChartsOption = {
      animation: true,
      animationDuration: 200,
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
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
          fontSize: 12,
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
          const refOpen = !isIntraday ? open : (data[dataIndex]?.last_close ?? chartData.lineValues[0])
          const changeValue =
            typeof refOpen === "number" ? priceValue - refOpen : 0
          const changeRate =
            typeof refOpen === "number" && refOpen !== 0
              ? ((priceValue - refOpen) / refOpen * 100).toFixed(2)
              : "0.00"
          const changeColor = priceValue >= (refOpen ?? priceValue) ? colors.up : colors.down
          return `
            <div style="padding: 10px; min-width: 220px;">
              <div style="font-weight: 600; margin-bottom: 10px;">${symbol}</div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="color: ${colors.textMuted}">时间</span>
                <span style="color: ${colors.text}">${date}</span>
              </div>
              ${
                isIntraday
                  ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: ${colors.textMuted}">价格</span>
                <span style="color: ${changeColor}">${Number(priceValue).toFixed(3)}</span>
              </div>
              `
                  : `
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="color: ${colors.textMuted}">开盘价</span>
                <span style="color: ${colors.text}">${open.toFixed(3)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="color: ${colors.textMuted}">最高价</span>
                <span style="color: ${colors.up}">${high.toFixed(3)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="color: ${colors.textMuted}">最低价</span>
                <span style="color: ${colors.down}">${low.toFixed(3)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: ${colors.textMuted}">收盘价</span>
                <span style="color: ${changeColor}">${close.toFixed(3)}</span>
              </div>
              `
              }
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="color: ${colors.textMuted}">涨跌额</span>
                <span style="color: ${changeColor}">${changeValue.toFixed(3)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
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
              right: "40px",
              top: "88px",
              bottom: mainBottom,
              containLabel: false,
            },
            {
              left: "0px",
              right: "40px",
              height: volumeHeight,
              bottom: volumeBottom,
              containLabel: false,
            },
          ]
        : [
            {
              left: "0px",
              right: "40px",
              top: "88px",
              bottom: "40px",
            },
          ],
      xAxis: hasVolume
        ? [
            {
              type: "category",
              data: chartData.dates,
              boundaryGap: false,
              axisLine: { lineStyle: { color: colors.border } },
              axisLabel: { color: colors.textMuted, fontSize: 11, margin: 10, hideOverlap: true },
              splitLine: { show: false },
            },
            {
              type: "category",
              gridIndex: 1,
              data: chartData.dates,
              boundaryGap: false,
              axisLine: { lineStyle: { color: colors.border } },
              axisLabel: { color: colors.textMuted, fontSize: 11, margin: 10, hideOverlap: true },
              splitLine: { show: false },
            },
          ]
        : [
            {
              type: "category",
              data: chartData.dates,
              boundaryGap: false,
              axisLine: { lineStyle: { color: colors.border } },
              axisLabel: { color: colors.textMuted, fontSize: 11 },
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
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
        },
        {
          type: "slider",
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
        },
      ],
      series: [
        ...(isIntraday
          ? [
              {
                name: "分时线",
                type: "line",
                data: chartData.lineValues,
                smooth: true,
                lineStyle: { width: 1.5, color: colors.up },
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
                      lineStyle: { width: 1.5, color: "#E3C46A" },
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
                  borderWidth: 1,
                },
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
                lineStyle: { width: 1.5, color: colors.shortTrendSide },
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
                lineStyle: { width: 1.5, color: colors.shortTrendSide },
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
                lineStyle: { width: 1.5, color: colors.shortTrendUp },
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
                lineStyle: { width: 1.5, color: colors.shortTrendDown },
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
                lineStyle: { width: 1.5, color: colors.shortTrendUp },
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
                lineStyle: { width: 1.5, color: colors.shortTrendDown },
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
                lineStyle: { width: 1.5, color: colors.longTrendSide },
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
                lineStyle: { width: 1.5, color: colors.longTrendSide },
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
                lineStyle: { width: 1.5, color: colors.longTrendUp },
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
                lineStyle: { width: 1.5, color: colors.longTrendDown },
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
                lineStyle: { width: 1.5, color: colors.longTrendUp },
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
                lineStyle: { width: 1.5, color: colors.longTrendDown },
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
                lineStyle: { width: 1, color: colors.ma5 },
                showSymbol: false,
                emphasis: { disabled: true },
                blur: { lineStyle: { opacity: 1 } },
              },
              {
                name: "MA10",
                type: "line",
                data: chartData.ma10,
                smooth: true,
                lineStyle: { width: 1, color: colors.ma10 },
                showSymbol: false,
                emphasis: { disabled: true },
                blur: { lineStyle: { opacity: 1 } },
              },
              {
                name: "MA20",
                type: "line",
                data: chartData.ma20,
                smooth: true,
                lineStyle: { width: 1, color: colors.ma20 },
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
      legend: !isIntraday && showMA
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
              top: "88px",
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
              top: "88px",
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
                fontSize: 11,
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
                fontSize: 11,
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
                fontSize: 11,
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

    const handleResize = () => {
      chartInstance.current?.resize()
      axisInstance.current?.resize()
    }
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [chartData, data.length, showMA, showVolume, showTrendBands, symbol, height])

  return (
    <div className="relative flex w-full flex-col" style={{ height }}>
      <div className="absolute left-3 right-3 top-2 z-10 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 rounded-full border bg-background/90 px-2 py-1 shadow-sm">
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
              className={`rounded-full px-2.5 py-1 text-xs transition ${
                klineType === item.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            type="button"
            onClick={onRefresh}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
            aria-label="刷新"
          >
            ↻
          </button>
        </div>
        <div className="flex items-center gap-2">
          {!isIntraday ? (
            <>
              <button
                type="button"
                onClick={() => setShowMA((prev) => !prev)}
                className={`rounded-md border px-2 py-1 text-xs transition ${
                  showMA ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"
                }`}
              >
                MA
              </button>
              <button
                type="button"
                onClick={() => setShowTrendBands((prev) => !prev)}
                className={`rounded-md border px-2 py-1 text-xs transition ${
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
            className={`rounded-md border px-2 py-1 text-xs transition ${
              showVolume ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"
            }`}
          >
            成交量
          </button>
        </div>
      </div>
      <div className="grid h-full w-full grid-cols-[84px_1fr]">
        <div ref={axisRef} className="h-full w-full pointer-events-none" />
        <div ref={chartRef} className="h-full w-full" />
      </div>
    </div>
  )
}

