# -*- coding: utf-8 -*-

import os
from datetime import datetime
from typing import Dict, List, Optional
from supabase import create_client, Client
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

class StockDatabase:
    def __init__(self):
        """初始化Supabase客户端"""
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("请在.env文件中配置SUPABASE_URL和SUPABASE_KEY")
        
        self.client: Client = create_client(self.supabase_url, self.supabase_key)
        print("✅ Supabase客户端初始化成功")
    
    def save_stock_data(self, data_source: str, market: str, data: Dict[str, List[Dict]]):
        """
        保存股票统计数据 - 每只股票作为单独记录，使用覆盖更新
        :param data_source: 数据源 ('futu' 或 'tonghuashun')
        :param market: 市场 ('A' 或 'HK')
        :param data: 股票数据字典
        """
        current_date = datetime.now().strftime('%Y-%m-%d')
        current_time = datetime.now().strftime('%H:%M:%S')
        
        try:
            # 先删除当日同数据源同市场的所有数据，确保数据一致性
            self.client.table('stock_records').delete().eq('date', current_date).eq(
                'data_source', data_source
            ).eq('market', market).execute()
            
            # 准备批量插入的数据
            records_to_insert = []
            
            for data_type, stock_list in data.items():
                for rank, stock in enumerate(stock_list, 1):
                    record = {
                        'date': current_date,
                        'time': current_time,
                        'data_source': data_source,
                        'market': market,
                        'data_type': data_type,
                        'rank_order': rank,
                        'stock_code': str(stock.get('code', '')),
                        'stock_name': str(stock.get('name', '')),
                        'change_ratio': float(stock.get('changeRatio', 0)) if stock.get('changeRatio') is not None else 0.0,
                        'volume': float(stock.get('volume', 0)) if stock.get('volume') is not None else 0.0,
                        'amount': float(stock.get('amount', 0)) if stock.get('amount') is not None else 0.0,
                        'pe_ratio': float(stock.get('pe', 0)) if stock.get('pe') is not None else 0.0,
                        'volume_ratio': float(stock.get('volumeRatio', 0)) if stock.get('volumeRatio') is not None else 0.0,
                        'turnover_rate': float(stock.get('turnoverRate', 0)) if stock.get('turnoverRate') is not None else 0.0
                    }
                    records_to_insert.append(record)
            
            # 批量插入数据
            if records_to_insert:
                self.client.table('stock_records').insert(records_to_insert).execute()
                print(f"✅ 已保存 {data_source} {market} 市场数据，共 {len(records_to_insert)} 条记录")
            
        except Exception as e:
            print(f"❌ 保存数据失败: {e}")
            raise
    
    def get_statistics_by_date(self, date: str, data_source: Optional[str] = None) -> Dict:
        """
        根据日期获取统计数据
        :param date: 日期字符串 (YYYY-MM-DD)
        :param data_source: 数据源筛选 (可选)
        :return: 统计数据字典
        """
        try:
            query = self.client.table('stock_records').select('*').eq('date', date)
            
            if data_source:
                query = query.eq('data_source', data_source)
            
            query = query.order('data_source').order('market').order('data_type').order('rank_order')
            response = query.execute()
            
            results = response.data
            
            # 组织数据结构
            data = {}
            for row in results:
                source = row['data_source']
                market = row['market']
                data_type = row['data_type']
                time = row['time']
                
                if source not in data:
                    data[source] = {}
                if market not in data[source]:
                    data[source][market] = {}
                if 'time' not in data[source][market]:
                    data[source][market]['time'] = time
                if data_type not in data[source][market]:
                    data[source][market][data_type] = []
                
                stock_info = {
                    'code': row['stock_code'],
                    'name': row['stock_name'],
                    'changeRatio': row['change_ratio'],
                    'volume': row['volume'],
                    'amount': row['amount'],
                    'pe': row['pe_ratio'],
                    'volumeRatio': row['volume_ratio'] if row['volume_ratio'] is not None else 0,
                    'turnoverRate': row['turnover_rate'] if row['turnover_rate'] is not None else 0
                }
                data[source][market][data_type].append(stock_info)
            
            return data
            
        except Exception as e:
            print(f"❌ 查询数据失败: {e}")
            raise
    
    def get_available_dates(self, limit: int = 30) -> List[str]:
        """
        获取可用的统计日期列表（使用 RPC 调用原生 SQL）
        :param limit: 返回最近多少天的数据
        :return: 日期列表
        """
        try:
            # 使用 Supabase RPC 调用数据库函数
            response = self.client.rpc('get_distinct_dates', {'limit_count': limit}).execute()
            return [row['date'] for row in response.data]
            
        except Exception as e:
            print(f"❌ 查询可用日期失败: {e}")
            # 如果 RPC 函数不存在，使用备用方案
            print("⚠️  使用备用查询方法")
            response = self.client.table('stock_records').select('date').order('date', desc=True).execute()
            return list(dict.fromkeys([row['date'] for row in response.data]))[:limit]
    
    def get_stock_history(self, stock_code: str, days: int = 7) -> List[Dict]:
        """
        获取特定股票的历史统计记录
        :param stock_code: 股票代码
        :param days: 查询天数
        :return: 历史记录列表
        """
        try:
            # 计算起始日期
            from datetime import timedelta
            start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
            
            response = self.client.table('stock_records').select('*').eq(
                'stock_code', stock_code
            ).gte('date', start_date).order('date', desc=True).order('time', desc=True).execute()
            
            history = []
            for row in response.data:
                history.append({
                    'date': row['date'],
                    'time': row['time'],
                    'data_source': row['data_source'],
                    'market': row['market'],
                    'data_type': row['data_type'],
                    'rank': row['rank_order'],
                    'stock_info': {
                        'code': row['stock_code'],
                        'name': row['stock_name'],
                        'changeRatio': row['change_ratio'],
                        'volume': row['volume'],
                        'amount': row['amount'],
                        'pe': row['pe_ratio'],
                        'volumeRatio': row['volume_ratio'] if row['volume_ratio'] is not None else 0,
                        'turnoverRate': row['turnover_rate'] if row['turnover_rate'] is not None else 0
                    }
                })
            
            return history
            
        except Exception as e:
            print(f"❌ 查询股票历史失败: {e}")
            raise
    
    def get_statistics_summary(self, date: str) -> Dict:
        """
        获取指定日期的统计摘要
        :param date: 日期字符串
        :return: 摘要信息
        """
        try:
            response = self.client.table('stock_records').select(
                'data_source, market, data_type'
            ).eq('date', date).execute()
            
            # 手动统计分组
            summary = {}
            for row in response.data:
                source = row['data_source']
                market = row['market']
                data_type = row['data_type']
                
                if source not in summary:
                    summary[source] = {}
                if market not in summary[source]:
                    summary[source][market] = {}
                if data_type not in summary[source][market]:
                    summary[source][market][data_type] = 0
                summary[source][market][data_type] += 1
            
            return summary
            
        except Exception as e:
            print(f"❌ 查询统计摘要失败: {e}")
            raise

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
    print("🔍 测试Supabase连接...")
    
    try:
        # 获取可用日期
        dates = db.get_available_dates()
        print(f"✅ 可用日期: {dates}")
        
        if dates:
            # 获取最新日期的数据
            latest_date = dates[0]
            data = db.get_statistics_by_date(latest_date)
            print(f"✅ 最新日期 {latest_date} 的数据结构: {list(data.keys())}")
            
            # 获取统计摘要
            summary = db.get_statistics_summary(latest_date)
            print(f"✅ 统计摘要: {summary}")
    except Exception as e:
        print(f"❌ 测试失败: {e}")