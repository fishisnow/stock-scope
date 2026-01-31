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

  const chartData = useMemo(() => {
    const dates = data.map((item) => item.date)
    const values = data.map((item) => [item.open, item.close, item.low, item.high])
    const volumes = data.map((item) => item.volume)
    return {
      dates,
      values,
      volumes,
      ma5: calculateMA(data, 5),
      ma10: calculateMA(data, 10),
      ma20: calculateMA(data, 20),
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
    }

    const hasVolume = showVolume && chartData.volumes.length > 0
    const zoomStart = chartData.dates.length > 80 ? 70 : 0
    const volumeHeight = Math.max(190, Math.round(height * 0.36))
    const zoomHeight = 16
    const zoomBottom = 4
    const volumeBottom = zoomBottom + zoomHeight + 8
    const mainBottom = volumeBottom + volumeHeight + 16

    const priceValues = chartData.values
      .flatMap((item) => item)
      .filter((value) => typeof value === "number") as number[]
    const volumeValues = chartData.volumes.filter((value) => typeof value === "number")
    const priceMin = priceValues.length ? Math.min(...priceValues) : 0
    const priceMax = priceValues.length ? Math.max(...priceValues) : 1
    const pricePadding = (priceMax - priceMin) * 0.1 || 1
    const volumeMax = volumeValues.length ? Math.max(...volumeValues) : 1

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
          if (!candleValue) return ""
          const [open, close, low, high] = candleValue
          if (open === null || close === null || low === null || high === null) return ""
          const changeValue = close - open
          const changeRate = ((close - open) / open * 100).toFixed(2)
          const changeColor = close >= open ? colors.up : colors.down
          return `
            <div style="padding: 10px; min-width: 220px;">
              <div style="font-weight: 600; margin-bottom: 10px;">${symbol}</div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="color: ${colors.textMuted}">时间</span>
                <span style="color: ${colors.text}">${date}</span>
              </div>
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
        {
          type: "candlestick",
          data: chartData.values,
          itemStyle: {
            color: colors.up,
            color0: colors.down,
            borderColor: colors.up,
            borderColor0: colors.down,
            borderWidth: 1,
          },
        },
        ...(showMA
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
                    const candleValue = chartData.values[params.dataIndex]
                    if (!candleValue) return colors.textMuted
                    const [open, close] = candleValue
                    if (open === null || close === null) return colors.textMuted
                    return close >= open ? `${colors.up}80` : `${colors.down}80`
                  },
                },
              },
            ]
          : []),
      ],
      legend: showMA
        ? {
            data: ["MA5", "MA10", "MA20"],
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
  }, [chartData, data.length, showMA, showVolume, symbol, height])

  return (
    <div className="relative flex w-full flex-col" style={{ height }}>
      <div className="absolute left-3 right-3 top-2 z-10 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 rounded-full border bg-background/90 px-2 py-1 shadow-sm">
          {[
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

