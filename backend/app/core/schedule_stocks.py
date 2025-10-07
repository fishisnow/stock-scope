# -*- coding: utf-8 -*-

import time
from datetime import datetime

import schedule

from app.db.database import save_futu_data
from app.utils import futu_data


def futu_job():
    try:
        # 获取股票数据
        data = futu_data.get_all_stock_data()
        
        # 保存数据到数据库
        save_futu_data(data)
        print(f"富途数据已保存到数据库: {datetime.now().strftime('%Y-%m-%d %H:%M')}")

        # 格式化消息
        message_parts = []
        current_time = datetime.now().strftime('%H:%M')
        message_parts.append(f"【{current_time} 富途数据】\n")

        # 处理大A数据
        message_parts.append("### 大A市场")
        
        # 交集表格 - 放在第一位
        message_parts.append("#### 同时在涨幅和成交额前50的股票")
        message_parts.append("| 排名 | 股票名称 | 成交额(亿) | 涨跌幅(%) | 成交量(万手) | 量比 | 换手率(%) | 市盈率 |")
        message_parts.append("|------|----------|------------|-----------|-------------|------|---------|--------|")
        for i, stock in enumerate(data['A']['intersection'], 1):
            volume_ratio = stock.get('volumeRatio', 0)
            turnover_rate = stock.get('turnoverRate', 0)
            message_parts.append(f"| {i} | {stock['name']} | {float(stock['amount'])/100000000:.1f} | {float(stock['changeRatio']):.1f} | {float(stock['volume'])/10000:.1f} | {float(volume_ratio):.1f} | {float(turnover_rate):.1f} | {float(stock['pe']):.1f} |")

        # 涨幅前50表格
        message_parts.append("\n#### 涨幅前50")
        message_parts.append("| 排名 | 股票名称 | 涨跌幅(%) | 成交量(万手) | 量比 | 换手率(%) | 市盈率 |")
        message_parts.append("|------|----------|-----------|-------------|------|---------|--------|")
        for i, stock in enumerate(data['A']['top_change'], 1):
            volume_ratio = stock.get('volumeRatio', 0)
            turnover_rate = stock.get('turnoverRate', 0)
            message_parts.append(f"| {i} | {stock['name']} | {float(stock['changeRatio']):.1f} | {float(stock['volume'])/10000:.1f} | {float(volume_ratio):.1f} | {float(turnover_rate):.1f} | {float(stock['pe']):.1f} |")

        # 成交额前50表格
        message_parts.append("\n#### 成交额前50")
        message_parts.append("| 排名 | 股票名称 | 成交额(亿) | 涨跌幅(%) | 成交量(万手) | 量比 | 换手率(%) | 市盈率 |")
        message_parts.append("|------|----------|------------|-----------|-------------|------|---------|--------|")
        for i, stock in enumerate(data['A']['top_volume_ratio'], 1):
            volume_ratio = stock.get('volumeRatio', 0)
            turnover_rate = stock.get('turnoverRate', 0)
            message_parts.append(f"| {i} | {stock['name']} | {float(stock['amount'])/100000000:.1f} | {float(stock['changeRatio']):.1f} | {float(stock['volume'])/10000:.1f} | {float(volume_ratio):.1f} | {float(turnover_rate):.1f} | {float(stock['pe']):.1f} |")



        # 处理港股数据
        message_parts.append("\n### 港股市场")
        
        # 交集表格 - 放在第一位
        message_parts.append("#### 同时在涨幅和成交额前50的股票")
        message_parts.append("| 排名 | 股票名称 | 成交额(亿) | 涨跌幅(%) | 成交量(万手) | 量比 | 换手率(%) | 市盈率 |")
        message_parts.append("|------|----------|------------|-----------|-------------|------|---------|--------|")
        for i, stock in enumerate(data['HK']['intersection'], 1):
            volume_ratio = stock.get('volumeRatio', 0)
            turnover_rate = stock.get('turnoverRate', 0)
            message_parts.append(f"| {i} | {stock['name']} | {float(stock['amount'])/100000000:.1f} | {float(stock['changeRatio']):.1f} | {float(stock['volume'])/10000:.1f} | {float(volume_ratio):.1f} | {float(turnover_rate):.1f} | {float(stock['pe']):.1f} |")

        # 涨幅前50表格
        message_parts.append("\n#### 涨幅前50")
        message_parts.append("| 排名 | 股票名称 | 涨跌幅(%) | 成交量(万手) | 量比 | 换手率(%) | 市盈率 |")
        message_parts.append("|------|----------|-----------|-------------|------|---------|--------|")
        for i, stock in enumerate(data['HK']['top_change'], 1):
            volume_ratio = stock.get('volumeRatio', 0)
            turnover_rate = stock.get('turnoverRate', 0)
            message_parts.append(f"| {i} | {stock['name']} | {float(stock['changeRatio']):.1f} | {float(stock['volume'])/10000:.1f} | {float(volume_ratio):.1f} | {float(turnover_rate):.1f} | {float(stock['pe']):.1f} |")

        # 成交额前50表格
        message_parts.append("\n#### 成交额前50")
        message_parts.append("| 排名 | 股票名称 | 成交额(亿) | 涨跌幅(%) | 成交量(万手) | 量比 | 换手率(%) | 市盈率 |")
        message_parts.append("|------|----------|------------|-----------|-------------|------|---------|--------|")
        for i, stock in enumerate(data['HK']['top_volume_ratio'], 1):
            volume_ratio = stock.get('volumeRatio', 0)
            turnover_rate = stock.get('turnoverRate', 0)
            message_parts.append(f"| {i} | {stock['name']} | {float(stock['amount'])/100000000:.1f} | {float(stock['changeRatio']):.1f} | {float(stock['volume'])/10000:.1f} | {float(volume_ratio):.1f} | {float(turnover_rate):.1f} | {float(stock['pe']):.1f} |")

    except Exception as e:
        print(f"富途任务执行出错: {e}")


def main():
    schedule.every().hour.at(":55").do(futu_job)

    while True:
        current_time = datetime.now().time()
        current_weekday = datetime.now().weekday()  # 0-6，0是周一，6是周日

        # 只在周一到周五（0-4）的9:00-16:00之间运行
        if 0 <= current_weekday <= 4 and 9 <= current_time.hour <= 16:
            schedule.run_pending()
        time.sleep(60)


if __name__ == "__main__":
    futu_job()
