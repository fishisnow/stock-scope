# -*- coding: utf-8 -*-

import time
from datetime import datetime

import schedule

from app.db.database import save_futu_data, save_stock_basic_info
from app.utils import futu_data
from app.utils.sector_classifier import (
    classify_and_tag_a_stocks,
    update_index_membership_for_a_stocks
)
from app.utils.market_breadth import compute_market_breadth_daily
from app.utils.wx_push import send_md_message


def futu_job():
    # 检查是否在交易时间（周一到周五，9:00-16:00）
    now = datetime.now()
    current_time = now.time()
    current_weekday = now.weekday()  # 0-6，0是周一，6是周日
    
    if not (0 <= current_weekday <= 4 and 9 <= current_time.hour <= 16):
        # 非交易时间，直接返回
        return
    
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
        for i, stock in enumerate(data['A']['top_turnover'], 1):
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
        for i, stock in enumerate(data['HK']['top_turnover'], 1):
            volume_ratio = stock.get('volumeRatio', 0)
            turnover_rate = stock.get('turnoverRate', 0)
            message_parts.append(f"| {i} | {stock['name']} | {float(stock['amount'])/100000000:.1f} | {float(stock['changeRatio']):.1f} | {float(stock['volume'])/10000:.1f} | {float(volume_ratio):.1f} | {float(turnover_rate):.1f} | {float(stock['pe']):.1f} |")

            # 发送消息
        message = "\n".join(message_parts)
        send_md_message(message)
    except Exception as e:
        print(f"富途任务执行出错: {e}")


# 记录上次同步股票基础信息的月份，避免同一个月重复执行
_last_sync_month = None
_last_enrich_month = None

def sync_stock_basic_info_job(manual: bool = False):
    """
    同步股票基础信息任务（每月月初执行）
    """
    global _last_sync_month
    
    try:
        now = datetime.now()
        current_day = now.day
        current_month = now.strftime('%Y-%m')  # 格式：2024-01
        
        # 只在每月1号执行
        if current_day != 1 and not manual:
            return
        
        # 检查是否已经执行过（避免同一个月重复执行）
        if _last_sync_month == current_month:
            return
        
        print(f"开始同步股票基础信息: {now.strftime('%Y-%m-%d %H:%M')}")
        
        # 获取所有股票基础信息
        stocks_data = futu_data.get_all_stocks_basic_info()
        
        # 保存到数据库
        save_stock_basic_info(stocks_data)
        
        # 更新最后同步月份
        _last_sync_month = current_month
        
        print(f"股票基础信息同步完成: {now.strftime('%Y-%m-%d %H:%M')}")
        
    except Exception as e:
        print(f"同步股票基础信息失败: {e}")


def enrich_stock_metadata_job(manual: bool = False):
    """
    使用 DeepSeek 进行板块分类 + 指数归属标记（月初执行）
    """
    global _last_enrich_month
    try:
        now = datetime.now()
        current_day = now.day
        current_month = now.strftime('%Y-%m')

        if current_day != 1 and not manual:
            return

        if _last_enrich_month == current_month:
            return

        print(f"开始板块/指数归属补齐: {now.strftime('%Y-%m-%d %H:%M')}")
        sector_result = classify_and_tag_a_stocks()
        index_result = update_index_membership_for_a_stocks()
        _last_enrich_month = current_month
        print(
            "板块/指数归属补齐完成: "
            f"板块 {sector_result.get('total', 0)} 条, "
            f"指数 {index_result.get('total', 0)} 条"
        )
    except Exception as e:
        print(f"板块/指数归属补齐失败: {e}")

def main():
    schedule.every().hour.at(":55").do(futu_job)
    
    # 每天凌晨2点检查是否需要同步股票基础信息（每月1号执行）
    # 函数内部会检查是否是1号，避免非1号时执行
    schedule.every().day.at("02:00").do(sync_stock_basic_info_job)
    # 每天凌晨2点10分检查是否需要补齐板块/指数（每月1号执行）
    schedule.every().day.at("02:10").do(enrich_stock_metadata_job)
    # 每天盘中/尾盘分三次计算市场宽度（同日数据会被 upsert 覆盖）
    schedule.every().day.at("10:30").do(compute_market_breadth_daily)
    schedule.every().day.at("13:30").do(compute_market_breadth_daily)
    schedule.every().day.at("15:30").do(compute_market_breadth_daily)

    while True:
        schedule.run_pending()
        time.sleep(60)


if __name__ == "__main__":
    classify_and_tag_a_stocks()
