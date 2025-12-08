"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts"

interface ProfitBarChartProps {
  data: Array<{
    stock_code: string
    stock_name: string
    realized_profit: number
  }>
  type: 'profit' | 'loss'
}

export function ProfitBarChart({ data, type }: ProfitBarChartProps) {
  // 根据类型过滤和排序数据
  const filteredData = type === 'profit' 
    ? data.filter(item => item.realized_profit > 0)
    : data.filter(item => item.realized_profit < 0)

  const chartData = filteredData
    .map(item => ({
      name: item.stock_name,  // 使用股票名称作为 Legend
      code: item.stock_code,   // 保留代码用于显示
      fullName: item.stock_name,
      profit: item.realized_profit,
    }))
    .sort((a, b) => type === 'profit' 
      ? b.profit - a.profit  // 盈利从高到低
      : a.profit - b.profit  // 亏损从低到高（绝对值大的在前）
    )
    .slice(0, 30)  // 只显示前30个

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-semibold">{data.fullName}</p>
          <p className="text-sm text-muted-foreground">{data.code}</p>
          <p className={`font-mono font-semibold ${
            data.profit >= 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            {data.profit >= 0 ? '+' : ''}US${data.profit.toFixed(2)}
          </p>
        </div>
      )
    }
    return null
  }

  // 如果没有数据，显示空状态
  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">暂无{type === 'profit' ? '盈利' : '亏损'}数据</p>
      </div>
    )
  }

  // 动态计算柱子宽度
  const barSize = Math.max(8, Math.min(40, 800 / chartData.length))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart 
        data={chartData} 
        margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
        barSize={barSize}
      >
        <XAxis 
          dataKey="code"
          tick={{ fontSize: 10 }}
          angle={-45}
          textAnchor="end"
          height={60}
          interval={0}
        />
        <YAxis 
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar 
          dataKey="profit" 
          radius={[4, 4, 0, 0]}
        >
          {chartData.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={type === 'profit' ? 'hsl(0 84% 60%)' : 'hsl(142 76% 36%)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

