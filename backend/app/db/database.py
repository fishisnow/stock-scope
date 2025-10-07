# -*- coding: utf-8 -*-

import sqlite3
import json
from datetime import datetime
from typing import Dict, List, Optional
import os

DATABASE_PATH = 'stock_data.db'

class StockDatabase:
    def __init__(self, db_path: str = DATABASE_PATH):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """初始化数据库表"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # 创建股票统计记录表 - 每只股票一条记录
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS stock_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    time TEXT NOT NULL,
                    data_source TEXT NOT NULL,  -- 'futu' 或 'tonghuashun'
                    market TEXT NOT NULL,       -- 'A' 或 'HK'
                    data_type TEXT NOT NULL,    -- 'top_amount', 'top_change', 'top_volume_ratio', 'intersection'
                    rank_order INTEGER NOT NULL,  -- 排名
                    stock_code TEXT,            -- 股票代码
                    stock_name TEXT,            -- 股票名称
                    change_ratio REAL,          -- 涨跌幅
                    volume REAL,                -- 成交量
                    amount REAL,                -- 成交额
                    pe_ratio REAL,              -- 市盈率
                    volume_ratio REAL,          -- 量比
                    turnover_rate REAL,         -- 换手率
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # 创建唯一索引防止重复插入
            cursor.execute('''
                CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_stock_record 
                ON stock_records (date, data_source, market, data_type, stock_code)
            ''')
            
            # 创建其他索引提高查询性能
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_date_source_market 
                ON stock_records (date, data_source, market)
            ''')
            
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_stock_code 
                ON stock_records (stock_code)
            ''')
            
            # 检查并添加volume_ratio字段（如果不存在）
            cursor.execute("PRAGMA table_info(stock_records)")
            columns = [column[1] for column in cursor.fetchall()]
            if 'volume_ratio' not in columns:
                cursor.execute('ALTER TABLE stock_records ADD COLUMN volume_ratio REAL DEFAULT 0')
                print("已为数据库表添加volume_ratio字段")
            
            # 检查并添加turnover_rate字段（如果不存在）
            if 'turnover_rate' not in columns:
                cursor.execute('ALTER TABLE stock_records ADD COLUMN turnover_rate REAL DEFAULT 0')
                print("已为数据库表添加turnover_rate字段")
            
            conn.commit()
    
    def save_stock_data(self, data_source: str, market: str, data: Dict[str, List[Dict]]):
        """
        保存股票统计数据 - 每只股票作为单独记录，使用覆盖更新
        :param data_source: 数据源 ('futu' 或 'tonghuashun')
        :param market: 市场 ('A' 或 'HK')
        :param data: 股票数据字典
        """
        current_date = datetime.now().strftime('%Y-%m-%d')
        current_time = datetime.now().strftime('%H:%M')
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # 先删除当日同数据源同市场的所有数据，确保数据一致性
            cursor.execute('''
                DELETE FROM stock_records 
                WHERE date = ? AND data_source = ? AND market = ?
            ''', (current_date, data_source, market))
            
            # 然后插入新数据
            for data_type, stock_list in data.items():
                for rank, stock in enumerate(stock_list, 1):
                    # 安全转换数据类型，避免int64等问题
                    cursor.execute('''
                        INSERT INTO stock_records 
                        (date, time, data_source, market, data_type, rank_order,
                         stock_code, stock_name, change_ratio, volume, amount, pe_ratio, volume_ratio, turnover_rate)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        current_date, current_time, data_source, market, data_type, rank,
                        str(stock.get('code', '')),
                        str(stock.get('name', '')),
                        float(stock.get('changeRatio', 0)) if stock.get('changeRatio') is not None else 0.0,
                        float(stock.get('volume', 0)) if stock.get('volume') is not None else 0.0,
                        float(stock.get('amount', 0)) if stock.get('amount') is not None else 0.0,
                        float(stock.get('pe', 0)) if stock.get('pe') is not None else 0.0,
                        float(stock.get('volumeRatio', 0)) if stock.get('volumeRatio') is not None else 0.0,
                        float(stock.get('turnoverRate', 0)) if stock.get('turnoverRate') is not None else 0.0
                    ))
            
            conn.commit()
            print(f"已保存 {data_source} {market} 市场数据，共 {sum(len(stocks) for stocks in data.values())} 条记录")
    
    def get_statistics_by_date(self, date: str, data_source: Optional[str] = None) -> Dict:
        """
        根据日期获取统计数据
        :param date: 日期字符串 (YYYY-MM-DD)
        :param data_source: 数据源筛选 (可选)
        :return: 统计数据字典
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            query = '''
                SELECT data_source, market, data_type, time, rank_order,
                       stock_code, stock_name, change_ratio, volume, amount, pe_ratio, volume_ratio, turnover_rate
                FROM stock_records 
                WHERE date = ?
            '''
            params = [date]
            
            if data_source:
                query += ' AND data_source = ?'
                params.append(data_source)
            
            query += ' ORDER BY data_source, market, data_type, rank_order'
            
            cursor.execute(query, params)
            results = cursor.fetchall()
            
            # 组织数据结构
            data = {}
            for row in results:
                source, market, data_type, time, rank, code, name, change_ratio, volume, amount, pe, volume_ratio, turnover_rate = row
                
                if source not in data:
                    data[source] = {}
                if market not in data[source]:
                    data[source][market] = {}
                if 'time' not in data[source][market]:
                    data[source][market]['time'] = time
                if data_type not in data[source][market]:
                    data[source][market][data_type] = []
                
                stock_info = {
                    'code': code,
                    'name': name,
                    'changeRatio': change_ratio,
                    'volume': volume,
                    'amount': amount,
                    'pe': pe,
                    'volumeRatio': volume_ratio if volume_ratio is not None else 0,
                    'turnoverRate': turnover_rate if turnover_rate is not None else 0
                }
                data[source][market][data_type].append(stock_info)
            
            return data
    
    def get_available_dates(self, limit: int = 30) -> List[str]:
        """
        获取可用的统计日期列表
        :param limit: 返回最近多少天的数据
        :return: 日期列表
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT DISTINCT date 
                FROM stock_records 
                ORDER BY date DESC 
                LIMIT ?
            ''', (limit,))
            
            return [row[0] for row in cursor.fetchall()]
    
    def get_stock_history(self, stock_code: str, days: int = 7) -> List[Dict]:
        """
        获取特定股票的历史统计记录
        :param stock_code: 股票代码
        :param days: 查询天数
        :return: 历史记录列表
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT date, time, data_source, market, data_type, rank_order,
                       stock_code, stock_name, change_ratio, volume, amount, pe_ratio, volume_ratio, turnover_rate
                FROM stock_records 
                WHERE stock_code = ? AND date >= date('now', '-{} days')
                ORDER BY date DESC, time DESC
            '''.format(days), (stock_code,))
            
            results = cursor.fetchall()
            history = []
            
            for row in results:
                date, time, data_source, market, data_type, rank, code, name, change_ratio, volume, amount, pe, volume_ratio, turnover_rate = row
                history.append({
                    'date': date,
                    'time': time,
                    'data_source': data_source,
                    'market': market,
                    'data_type': data_type,
                    'rank': rank,
                    'stock_info': {
                        'code': code,
                        'name': name,
                        'changeRatio': change_ratio,
                        'volume': volume,
                        'amount': amount,
                        'pe': pe,
                        'volumeRatio': volume_ratio if volume_ratio is not None else 0,
                        'turnoverRate': turnover_rate if turnover_rate is not None else 0
                    }
                })
            
            return history
    
    def get_statistics_summary(self, date: str) -> Dict:
        """
        获取指定日期的统计摘要
        :param date: 日期字符串
        :return: 摘要信息
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT data_source, market, data_type, COUNT(*) as record_count
                FROM stock_records 
                WHERE date = ?
                GROUP BY data_source, market, data_type
            ''', (date,))
            
            results = cursor.fetchall()
            summary = {}
            
            for row in results:
                source, market, data_type, count = row
                if source not in summary:
                    summary[source] = {}
                if market not in summary[source]:
                    summary[source][market] = {}
                summary[source][market][data_type] = count
            
            return summary

# 全局数据库实例
db = StockDatabase()

def save_futu_data(data: Dict[str, Dict[str, List[Dict]]]):
    """保存富途数据"""
    for market, market_data in data.items():
        db.save_stock_data('futu', market, market_data)

def save_tonghuashun_data(data: Dict[str, List[Dict]]):
    """保存同花顺数据"""
    db.save_stock_data('tonghuashun', 'A', data)

if __name__ == '__main__':
    # 测试数据库功能
    print("数据库初始化完成")
    
    # 获取可用日期
    dates = db.get_available_dates()
    print(f"可用日期: {dates}")
    
    if dates:
        # 获取最新日期的数据
        latest_date = dates[0]
        data = db.get_statistics_by_date(latest_date)
        print(f"最新日期 {latest_date} 的数据结构: {list(data.keys())}")
