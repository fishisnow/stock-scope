"use client"

import { Line, LineChart, ResponsiveContainer } from "recharts"

interface TrendChartProps {
  data: number[]
}

export function TrendChart({ data }: TrendChartProps) {
  const chartData = data.map((value, index) => ({
    value,
    index,
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
