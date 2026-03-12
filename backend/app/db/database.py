# -*- coding: utf-8 -*-

import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from supabase import create_client, Client
from dotenv import load_dotenv
from app.utils.date_utils import TradingDateUtils

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
        self.trading_date_utils = TradingDateUtils()
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
    
    def save_stocks_basic_info(self, stocks_data: Dict[str, List[Dict]]):
        """
        保存股票基础信息到数据库（使用 upsert 方式，如果已存在则更新）
        并清理接口中已不存在（如摘牌）的股票
        :param stocks_data: 股票基础信息字典，格式为 {'A': [...], 'HK': [...]}
        """
        try:
            current_time = datetime.now().isoformat()
            records_to_upsert = []
            deleted_total = 0
            
            for market, stocks in stocks_data.items():
                incoming_codes = {
                    str(stock.get('code', '')).strip()
                    for stock in stocks
                    if str(stock.get('code', '')).strip()
                }

                # 某市场返回为空时，跳过删除以避免上游异常导致误删全量数据
                if incoming_codes:
                    existing_resp = self.get_stock_basic_info_paginated(
                        market=market,
                        columns='stock_code'
                    )
                    existing_codes = {
                        str(row.get('stock_code', '')).strip()
                        for row in existing_resp
                        if str(row.get('stock_code', '')).strip()
                    }

                    codes_to_delete = list(existing_codes - incoming_codes)
                    if codes_to_delete:
                        batch_size = 500
                        for i in range(0, len(codes_to_delete), batch_size):
                            batch = codes_to_delete[i:i + batch_size]
                            self.client.table('stock_basic_info').delete().eq('market', market).in_(
                                'stock_code', batch
                            ).execute()
                        deleted_total += len(codes_to_delete)

                for stock in stocks:
                    record = {
                        'stock_code': str(stock.get('code', '')),
                        'stock_name': str(stock.get('name', '')),
                        'market': market,
                        'exchange': str(stock.get('exchange', '')),
                        'last_synced_at': current_time,
                        'updated_at': current_time
                    }
                    records_to_upsert.append(record)
            
            # 使用 upsert（如果存在则更新，不存在则插入）
            if records_to_upsert:
                # Supabase 的 upsert 需要指定唯一约束字段
                # 由于我们设置了唯一索引 (stock_code, market)，可以直接 upsert
                self.client.table('stock_basic_info').upsert(
                    records_to_upsert,
                    on_conflict='stock_code,market'
                ).execute()
                total_count = len(records_to_upsert)
                a_count = len(stocks_data.get('A', []))
                hk_count = len(stocks_data.get('HK', []))
                print(f"✅ 已同步股票基础信息: 总计 {total_count} 条（A股 {a_count} 条，港股 {hk_count} 条）")
                if deleted_total:
                    print(f"🧹 已清理摘牌/无效股票: {deleted_total} 条")
            
        except Exception as e:
            print(f"❌ 保存股票基础信息失败: {e}")
            raise

    def get_stock_basic_info(self, market: Optional[str] = None) -> List[Dict]:
        """
        获取股票基础信息
        :param market: 市场筛选，可选 'A' 或 'HK'
        :return: 股票基础信息列表
        """
        try:
            query = self.client.table('stock_basic_info').select('*')
            if market:
                query = query.eq('market', market)
            response = query.execute()
            return response.data or []
        except Exception as e:
            print(f"❌ 查询股票基础信息失败: {e}")
            raise

    def get_stock_basic_info_paginated(
        self,
        market: Optional[str] = None,
        page_size: int = 1000,
        columns: str = '*'
    ) -> List[Dict]:
        """
        分页获取股票基础信息（避免 Supabase 单次查询限制）
        :param market: 市场筛选，可选 'A' 或 'HK'
        :param page_size: 每页数量
        :param columns: 查询字段
        :return: 股票基础信息列表
        """
        try:
            results: List[Dict] = []
            offset = 0
            while True:
                query = self.client.table('stock_basic_info').select(columns)
                if market:
                    query = query.eq('market', market)
                response = query.range(offset, offset + page_size - 1).execute()
                batch = response.data or []
                if not batch:
                    break
                results.extend(batch)
                if len(batch) < page_size:
                    break
                offset += page_size
            return results
        except Exception as e:
            print(f"❌ 分页查询股票基础信息失败: {e}")
            raise

    def get_stock_basic_info_by_codes(
        self,
        codes: List[str],
        market: Optional[str] = None,
        batch_size: int = 500
    ) -> List[Dict]:
        """
        按股票代码批量获取基础信息
        :param codes: 股票代码列表
        :param market: 市场筛选，可选 'A' 或 'HK'
        :param batch_size: 每批次查询的代码数量
        :return: 股票基础信息列表
        """
        try:
            if not codes:
                return []
            results: List[Dict] = []
            total = len(codes)
            for start in range(0, total, batch_size):
                end = min(start + batch_size, total)
                batch = codes[start:end]
                query = self.client.table('stock_basic_info').select('*').in_(
                    'stock_code', batch
                )
                if market:
                    query = query.eq('market', market)
                response = query.execute()
                if response.data:
                    results.extend(response.data)
            return results
        except Exception as e:
            print(f"❌ 按代码查询股票基础信息失败: {e}")
            raise

    def get_stock_basic_info_by_industry(
        self,
        industry: str,
        market: str = 'A',
        columns: str = 'stock_code,stock_name,exchange,market,sector,industry'
    ) -> List[Dict]:
        """
        按行业查询股票基础信息
        :param industry: 二级行业名称
        :param market: 市场，默认 A 股
        :param columns: 查询字段
        :return: 股票基础信息列表
        """
        try:
            if not industry:
                return []
            query = self.client.table('stock_basic_info').select(columns).eq('industry', industry)
            if market:
                query = query.eq('market', market)
            response = query.execute()
            return response.data or []
        except Exception as e:
            print(f"❌ 按行业查询股票基础信息失败: {e}")
            raise

    def upsert_stock_basic_metadata(self, records: List[Dict], batch_size: int = 500):
        """
        按主键批量更新股票行业分类等扩展字段（仅更新，不插入）
        :param records: 包含 id 以及其他字段的记录
        :param batch_size: 每批次 upsert 的记录数量
        """
        try:
            if not records:
                return
            total = len(records)
            for start in range(0, total, batch_size):
                end = min(start + batch_size, total)
                batch = records[start:end]
                response = self.client.rpc(
                    'update_stock_basic_metadata_batch',
                    {'p_records': batch}
                ).execute()
                updated = response.data or 0
                print(
                    f"✅ 已更新股票扩展信息: {end}/{total} "
                    f"(batch {start // batch_size + 1}, updated {updated})"
                )
        except Exception as e:
            print(f"❌ 更新股票扩展信息失败: {e}")
            raise

    def update_stock_basic_index_membership(self, records: List[Dict]):
        """
        更新股票指数归属信息（仅更新，不插入）
        :param records: 包含 stock_code, market, index_membership 的记录
        """
        try:
            if not records:
                return
            updated = 0
            for record in records:
                stock_code = record.get('stock_code')
                market = record.get('market')
                if not stock_code or not market:
                    continue
                payload = {
                    'index_membership': record.get('index_membership', []),
                    'updated_at': record.get('updated_at')
                }
                response = self.client.table('stock_basic_info').update(
                    payload
                ).eq('stock_code', stock_code).eq('market', market).execute()
                if response.data:
                    updated += 1
            print(f"✅ 已更新股票指数归属: {updated}/{len(records)}")
        except Exception as e:
            print(f"❌ 更新股票指数归属失败: {e}")
            raise

    def update_stock_basic_index_membership_batch(
        self,
        records: List[Dict],
        batch_size: int = 500
    ):
        """
        按主键批量更新股票指数归属（仅更新，不插入）
        :param records: 包含 id, index_membership, updated_at 的记录
        :param batch_size: 每批次更新数量
        """
        try:
            if not records:
                return
            total = len(records)
            for start in range(0, total, batch_size):
                end = min(start + batch_size, total)
                batch = records[start:end]
                response = self.client.rpc(
                    'update_stock_basic_index_membership_batch',
                    {'p_records': batch}
                ).execute()
                updated = response.data or 0
                print(
                    f"✅ 已批量更新指数归属: {end}/{total} "
                    f"(batch {start // batch_size + 1}, updated {updated})"
                )
        except Exception as e:
            print(f"❌ 批量更新指数归属失败: {e}")
            raise

    def upsert_market_breadth(self, records: List[Dict]):
        """
        批量写入市场宽度日度数据
        """
        try:
            if not records:
                return
            self.client.table('market_breadth_daily').upsert(
                records,
                on_conflict='date,breadth_type,sector'
            ).execute()
        except Exception as e:
            print(f"❌ 写入市场宽度数据失败: {e}")
            raise

    def get_market_breadth_records(self, limit: int = 10, breadth_type: Optional[str] = None) -> Dict:
        """
        获取最近N天市场宽度数据
        """
        try:
            # A股开盘前不使用当天，避免请求到尚未产出的日度数据
            now = datetime.now()
            before_open = now.hour < 9 or (now.hour == 9 and now.minute < 55)
            end_date = (now - timedelta(days=1)).strftime('%Y-%m-%d') if before_open else now.strftime('%Y-%m-%d')

            # 先用交易日历计算近 N 个 A 股交易日，再下推到数据库按 date IN 查询
            # 预留更长自然日窗口，确保节假日较多时也能覆盖到足够交易日
            lookback_days = max(limit * 4, 120)
            start_date = (now - timedelta(days=lookback_days)).strftime('%Y-%m-%d')
            dates = self.trading_date_utils.get_trading_days_in_range(start_date, end_date, market='CN')
            dates = sorted(set(dates), reverse=True)[:limit]

            if not dates:
                return {"dates": [], "records": []}

            # Supabase 单次查询默认最多返回约 1000 行，这里做分页聚合，确保多行业/多类型场景下数据完整。
            page_size = 1000
            records: List[Dict] = []
            page = 0
            while True:
                offset = page * page_size
                query = (
                    self.client.table('market_breadth_daily')
                    .select('*')
                    .in_('date', dates)
                    .order('date', desc=True)
                    .order('breadth_type')
                    .order('sector')
                    .range(offset, offset + page_size - 1)
                )
                if breadth_type:
                    query = query.eq('breadth_type', breadth_type)
                data_resp = query.execute()
                batch = data_resp.data or []
                records.extend(batch)
                if len(batch) < page_size:
                    break
                page += 1
                # 防止异常情况下无限循环
                if page > 30:
                    print("⚠️ market_breadth_daily 分页超过 30 页，提前终止以避免无限循环")
                    break

            # 只返回实际有数据的日期（例如当天无数据时不返回当天）
            existing_dates = {row.get('date') for row in records if row.get('date')}
            filtered_dates = [date for date in dates if date in existing_dates]

            return {"dates": filtered_dates, "records": records}
        except Exception as e:
            print(f"❌ 查询市场宽度数据失败: {e}")
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


def save_stock_basic_info(stocks_data: Dict[str, List[Dict]]):
    """
    保存股票基础信息到数据库
    :param stocks_data: 股票基础信息字典，格式为 {'A': [...], 'HK': [...]}
    """
    db.save_stocks_basic_info(stocks_data)

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