import logging
import threading
import time

from futu import *
from datetime import date
import pandas as pd
from typing import Dict, List, Tuple
import os

logger = logging.getLogger(__name__)

# 获取今天的日期并格式化
formatted_date = date.today().strftime('%Y%m%d')

sort_field_name = {
    'CHANGE_RATE': '涨跌幅',
    'TURNOVER': '成交额'
}

plate_code_name = {
    'HK.LIST1600': '港股',
    'SH.LIST0600': '大A'
}


# ============================================
# 共享 FutuQuoteContext（单例复用，避免每次调用都建立 TCP 连接）
# ============================================

_quote_ctx = None
_quote_ctx_lock = threading.Lock()
_quote_ctx_created_at = 0.0
_subscription_lock = threading.Lock()
_active_subscriptions: Dict[Tuple[str, SubType], float] = {}


def _sub_key(code: str, sub_type: SubType) -> Tuple[str, SubType]:
    return code, sub_type


def _get_subscription_limit() -> int:
    """
    读取订阅上限。富途订阅额度默认 300，可通过环境变量覆盖。
    """
    try:
        value = int(os.getenv('FUTU_SUBSCRIPTION_LIMIT', '300'))
        return max(1, value)
    except Exception:
        return 300


def _evict_old_subscriptions_if_needed(quote_context, sub_type: SubType, incoming_count: int):
    """
    在订阅新标的前，按最久未使用优先释放旧订阅，避免超过额度。
    """
    if incoming_count <= 0:
        return

    limit = _get_subscription_limit()
    with _subscription_lock:
        used = len(_active_subscriptions)
        available = max(0, limit - used)
        need_release = incoming_count - available
        if need_release <= 0:
            return

        # 先从同类型订阅中释放，仍不足时再从其他类型补齐
        same_type = sorted(
            [(key, ts) for key, ts in _active_subscriptions.items() if key[1] == sub_type],
            key=lambda x: x[1]
        )
        candidates = same_type[:need_release]
        if len(candidates) < need_release:
            others = sorted(
                [(key, ts) for key, ts in _active_subscriptions.items() if key[1] != sub_type],
                key=lambda x: x[1]
            )
            candidates.extend(others[:need_release - len(candidates)])

    grouped_codes: Dict[SubType, List[str]] = {}
    for (code, old_type), _ in candidates:
        grouped_codes.setdefault(old_type, []).append(code)

    for old_type, code_list in grouped_codes.items():
        if not code_list:
            continue
        try:
            quote_context.unsubscribe(code_list, [old_type], unsubscribe_all=False)
        except Exception as exc:
            logger.warning(f"释放订阅失败，类型={old_type}, 数量={len(code_list)}: {exc}")
            continue
        with _subscription_lock:
            for code in code_list:
                _active_subscriptions.pop(_sub_key(code, old_type), None)
        logger.info(f"已释放订阅 {len(code_list)} 个，类型={old_type}")


def _subscribe_if_needed(quote_context, code_list: List[str], sub_type: SubType):
    """
    仅对未订阅的 code 发起订阅，减少重复订阅和额度占用。
    """
    if not code_list:
        return RET_OK, ''

    now = time.time()
    with _subscription_lock:
        need_subscribe = []
        for code in code_list:
            key = _sub_key(code, sub_type)
            if key not in _active_subscriptions:
                need_subscribe.append(code)
            else:
                # 已订阅也刷新最近使用时间，便于后续按 LRU 释放
                _active_subscriptions[key] = now

    if not need_subscribe:
        return RET_OK, ''

    _evict_old_subscriptions_if_needed(quote_context, sub_type, len(need_subscribe))

    ret_sub, err_message = quote_context.subscribe(need_subscribe, [sub_type], subscribe_push=False)
    if ret_sub == RET_OK:
        with _subscription_lock:
            for code in need_subscribe:
                _active_subscriptions[_sub_key(code, sub_type)] = now
    return ret_sub, err_message


def get_quote_context() -> OpenQuoteContext:
    """
    获取共享的富途行情上下文（惰性创建，全局复用）。
    连接断开时自动重建；连接存活过久时轮换重建，避免状态长期累积。
    """
    global _quote_ctx, _quote_ctx_created_at
    with _quote_ctx_lock:
        max_age_sec = int(os.getenv('FUTU_QUOTE_CTX_MAX_AGE_SEC', '1800'))
        if _quote_ctx is not None and max_age_sec > 0:
            alive_sec = time.time() - _quote_ctx_created_at
            if alive_sec >= max_age_sec:
                try:
                    _quote_ctx.close()
                except Exception:
                    pass
                _quote_ctx = None
                _quote_ctx_created_at = 0.0
                with _subscription_lock:
                    _active_subscriptions.clear()
                logger.info(f"FutuQuoteContext recycled after {alive_sec:.0f}s")

        if _quote_ctx is None:
            futu_host = os.getenv('FUTU_HOST', '127.0.0.1')
            futu_port = int(os.getenv('FUTU_PORT', '11111'))
            _quote_ctx = OpenQuoteContext(host=futu_host, port=futu_port)
            _quote_ctx_created_at = time.time()
            logger.info(f"FutuQuoteContext created: {futu_host}:{futu_port}")
        return _quote_ctx


def _reset_quote_context():
    """连接异常时重置上下文，下次调用 get_quote_context 会重建"""
    global _quote_ctx, _quote_ctx_created_at, _active_subscriptions
    with _quote_ctx_lock:
        if _quote_ctx is not None:
            try:
                _quote_ctx.close()
            except Exception:
                pass
            _quote_ctx = None
            _quote_ctx_created_at = 0.0
            logger.info("FutuQuoteContext reset due to error")
    with _subscription_lock:
        _active_subscriptions = {}


def close_quote_context():
    """应用退出时调用，关闭共享的富途行情上下文"""
    _reset_quote_context()


def get_hot_top(quote_context, plate_code: str, sort_field: str, top: int = 50):
    """
    获取热门股票数据
    :param quote_context: 行情上下文
    :param plate_code: 板块代码
    :param sort_field: 排序字段
    :param top: 获取前多少名
    :return: DataFrame 包含股票数据
    """
    ret, data = quote_context.get_plate_stock(plate_code=plate_code, sort_field=sort_field, ascend=False)
    if ret == RET_OK:
        return data.head(top)
    else:
        print('error:', data)
        return pd.DataFrame()


def get_stock_quote(quote_context, code_list:list[str]):
    """
    获取股票报价数据
    :param quote_context: 行情上下文
    :param code_list: 股票代码列表
    :return: DataFrame 包含股票报价数据
    """
    if not code_list:
        return pd.DataFrame()

    ret_sub, err_message = _subscribe_if_needed(quote_context, code_list, SubType.QUOTE)
    if ret_sub != RET_OK:
        print('subscription failed', err_message)
        return pd.DataFrame()

    ret, data = quote_context.get_market_snapshot(code_list)
    if ret == RET_OK:
        return data
    else:
        print('error:', data)
        return pd.DataFrame()


def get_realtime_quotes_by_futu_codes(code_list: List[str]) -> pd.DataFrame:
    """
    按富途代码批量获取实时快照。
    :param code_list: 如 ['SH.600519', 'SZ.000001']
    """
    quote_context = get_quote_context()
    return get_stock_quote(quote_context, code_list)


def get_market_snapshots_by_futu_codes(code_list: List[str], batch_size: int = 400) -> pd.DataFrame:
    """
    按富途代码批量获取快照（无需订阅）。
    :param code_list: 如 ['SH.600519', 'SZ.000001']
    :param batch_size: 单次请求数量上限，富途接口限制为 400
    """
    if not code_list:
        return pd.DataFrame()

    quote_context = get_quote_context()
    safe_batch_size = max(1, min(int(batch_size), 400))

    chunks: List[pd.DataFrame] = []
    for start in range(0, len(code_list), safe_batch_size):
        batch_codes = code_list[start:start + safe_batch_size]
        ret, data = quote_context.get_market_snapshot(batch_codes)
        if ret != RET_OK:
            raise Exception(f"获取市场快照失败: {data}")
        if not data.empty:
            chunks.append(data)

    if not chunks:
        return pd.DataFrame()
    return pd.concat(chunks, ignore_index=True)


def get_stock_data(plate_code: str) -> Dict[str, List[Dict]]:
    """
    获取股票数据，包括涨幅和成交额排名
    :param plate_code: 板块代码
    :return: 包含涨幅和成交额排名的字典
    """
    try:
        quote_context = get_quote_context()
        
        # 获取涨幅前50
        change_rate_df = get_hot_top(quote_context, plate_code, 'CHANGE_RATE', 50)
        # 获取成交额前50
        turnover_top50_df = get_hot_top(quote_context, plate_code, 'TURNOVER', 50)
        
        # 收集所有需要获取详细数据的股票代码
        all_codes = set()
        all_codes.update(change_rate_df['code'].tolist())
        all_codes.update(turnover_top50_df['code'].tolist())
        all_codes = list(all_codes)
        
        # 一次性获取所有股票的详细数据
        quote_data = get_stock_quote(quote_context, all_codes)
        
        # 处理数据
        def process_df(df):
            if df.empty:
                return []
            result = []
            for _, row in df.iterrows():
                code = row['code']
                quote_row = quote_data[quote_data['code'] == code].iloc[0] if not quote_data.empty else None
                
                # 计算涨跌幅
                change_ratio = 0
                if quote_row is not None:
                    last_price = quote_row['last_price']
                    prev_close = quote_row['prev_close_price']
                    if prev_close > 0:
                        change_ratio = (last_price - prev_close) / prev_close * 100
                
                # 获取量比数据
                volume_ratio = 0
                if quote_row is not None and 'volume_ratio' in quote_row:
                    volume_ratio = quote_row['volume_ratio']
                
                # 获取换手率数据
                turnover_rate = 0
                if quote_row is not None and 'turnover_rate' in quote_row:
                    turnover_rate = quote_row['turnover_rate']
                
                stock_data = {
                    'code': code,
                    'name': row['stock_name'],
                    'changeRatio': change_ratio,
                    'volume': quote_row['volume'] if quote_row is not None else 0,
                    'amount': quote_row['turnover'] if quote_row is not None else 0,
                    'pe': quote_row['pe_ratio'] if quote_row is not None and 'pe_ratio' in quote_row else 0,
                    'volumeRatio': volume_ratio,
                    'turnoverRate': turnover_rate
                }
                result.append(stock_data)
            return result
        
        # 计算交集
        change_rate_codes = set(change_rate_df['code'])
        turnover_codes = set(turnover_top50_df['code'])
        intersection_codes = list(change_rate_codes & turnover_codes)
        
        # 获取交集数据
        intersection_data = []
        for code in intersection_codes:
            change_rate_row = change_rate_df[change_rate_df['code'] == code].iloc[0]
            quote_row = quote_data[quote_data['code'] == code].iloc[0] if not quote_data.empty else None
            
            # 计算涨跌幅
            change_ratio = 0
            if quote_row is not None:
                last_price = quote_row['last_price']
                prev_close = quote_row['prev_close_price']
                if prev_close > 0:
                    change_ratio = (last_price - prev_close) / prev_close * 100
            
            # 获取量比数据
            volume_ratio = 0
            if quote_row is not None and 'volume_ratio' in quote_row:
                volume_ratio = quote_row['volume_ratio']
            
            # 获取换手率数据
            turnover_rate = 0
            if quote_row is not None and 'turnover_rate' in quote_row:
                turnover_rate = quote_row['turnover_rate']
            
            stock_data = {
                'code': code,
                'name': change_rate_row['stock_name'],
                'changeRatio': change_ratio,
                'volume': quote_row['volume'] if quote_row is not None else 0,
                'amount': quote_row['turnover'] if quote_row is not None else 0,
                'pe': quote_row['pe_ratio'] if quote_row is not None and 'pe_ratio' in quote_row else 0,
                'volumeRatio': volume_ratio,
                'turnoverRate': turnover_rate
            }
            intersection_data.append(stock_data)
        
        return {
            'top_change': process_df(change_rate_df),
            'top_turnover': process_df(turnover_top50_df),
            'intersection': intersection_data
        }
        
    except Exception as e:
        print(f"获取数据时发生错误: {str(e)}")
        return {
            'top_change': [],
            'top_turnover': [],
            'intersection': []
        }


def get_all_stock_data() -> Dict[str, Dict[str, List[Dict]]]:
    """
    获取所有板块的股票数据
    :return: 包含大A和港股数据的字典
    """
    return {
        'A': get_stock_data('SH.LIST0600'),
        'HK': get_stock_data('HK.LIST1600')
    }


def extract_exchange_from_futu_code(futu_code: str) -> str:
    """
    从富途代码中提取交易所代码
    :param futu_code: 富途格式的股票代码，如 'SH.000001', 'SZ.000001', 'HK.00700'
    :return: 交易所代码，如 'SH', 'SZ', 'HK'
    """
    if '.' in futu_code:
        return futu_code.split('.')[0]
    else:
        raise ValueError(f"无效的富途代码格式: {futu_code}")


def convert_to_futu_code(code: str, market: str = None, exchange: str = None) -> str:
    """
    将股票代码转换为富途格式
    :param code: 股票代码，如 '000001'
    :param market: 市场类型，'A' 或 'HK'（如果未提供 exchange 则必需）
    :param exchange: 交易所代码，'SH', 'SZ', 'HK'（如果提供则优先使用）
    :return: 富途格式的股票代码，如 'SH.000001' 或 'HK.00700'
    """
    if exchange:
        # 如果提供了 exchange，直接使用
        return f'{exchange}.{code}'
    elif market == 'A':
        # A股：6开头或5开头是上海，其他是深圳
        if code.startswith(('6', '5')):
            return f'SH.{code}'
        else:
            return f'SZ.{code}'
    elif market == 'HK':
        # 港股：HK.开头
        return f'HK.{code}'
    else:
        raise ValueError(f"必须提供 market 或 exchange 参数")


def get_plate_stocks(plate_code: str) -> List[Dict]:
    """
    获取板块内所有股票的基础信息
    
    :param plate_code: 板块代码，如 'HK.LIST1910'（所有港股）或 'SH.LIST3000005'（全部A股）
    :return: 股票基础信息列表，格式如下：
        [
            {
                'code': '000001',
                'name': '股票名称',
                'exchange': 'SH',
                'market': 'A'
            },
            ...
        ]
    """
    try:
        quote_ctx = get_quote_context()
        
        ret, data = quote_ctx.get_plate_stock(plate_code)
        
        if ret != RET_OK:
            raise Exception(f"获取板块股票失败: {data}")
        
        if data.empty:
            return []
        
        market = 'HK' if plate_code.startswith('HK.') else 'A'
        
        stocks = []
        for _, row in data.iterrows():
            futu_code = str(row['code']) if pd.notna(row['code']) else ''
            stock_name = str(row['stock_name']) if pd.notna(row['stock_name']) else ''
            
            if '.' in futu_code:
                exchange = futu_code.split('.')[0]
                stock_code = futu_code.split('.')[1]
            else:
                if market == 'HK':
                    exchange = 'HK'
                else:
                    if futu_code.startswith(('6', '5')):
                        exchange = 'SH'
                    else:
                        exchange = 'SZ'
                stock_code = futu_code
            
            stocks.append({
                'code': stock_code,
                'name': stock_name,
                'exchange': exchange,
                'market': market
            })
        
        return stocks
        
    except Exception as e:
        raise Exception(f"获取板块股票失败: {str(e)}")


def get_all_stocks_basic_info() -> Dict[str, List[Dict]]:
    """
    获取所有市场（A股和港股）的股票基础信息
    
    :return: 包含A股和港股股票基础信息的字典
        {
            'A': [...],
            'HK': [...]
        }
    """
    try:
        # 获取A股所有股票
        a_stocks = get_plate_stocks('SH.LIST3000005')
        
        # 获取港股所有股票
        hk_stocks = get_plate_stocks('HK.LIST1910')
        
        return {
            'A': a_stocks,
            'HK': hk_stocks
        }
    except Exception as e:
        raise Exception(f"获取所有股票基础信息失败: {str(e)}")


def get_above_ma20_stock_codes() -> set:
    """
    获取A股市场（沪深）收盘价高于MA20的股票代码集合
    :return: set(['000001', ...])
    """
    quote_ctx = get_quote_context()

    custom_filter = CustomIndicatorFilter()
    custom_filter.ktype = KLType.K_DAY
    custom_filter.stock_field1 = StockField.PRICE
    custom_filter.stock_field2 = StockField.MA
    custom_filter.stock_field2_para = [20]
    custom_filter.relative_position = RelativePosition.MORE
    custom_filter.is_no_filter = False

    def fetch_market_codes(market) -> set:
        codes = set()
        begin = 0
        while True:
            ret, ls = quote_ctx.get_stock_filter(
                market=market,
                filter_list=[custom_filter],
                begin=begin
            )
            if ret != RET_OK:
                raise Exception(ls)

            time.sleep(3)
            last_page, _, ret_list = ls
            if not ret_list:
                break
            for item in ret_list:
                raw_code = getattr(item, 'stock_code', '')
                if '.' in raw_code:
                    raw_code = raw_code.split('.')[1]
                if raw_code:
                    codes.add(raw_code)
            if last_page:
                break
            begin += len(ret_list)
        return codes

    sh_codes = fetch_market_codes(Market.SH)
    sz_codes = fetch_market_codes(Market.SZ)
    return sh_codes.union(sz_codes)


def get_stock_current_price(code: str, market: str) -> Dict:
    """
    获取指定股票的当前价格信息
    
    :param code: 股票代码，如 '000001'
    :param market: 市场类型，'A' 或 'HK'
    :return: 包含股票价格信息的字典
    """
    try:
        futu_code = convert_to_futu_code(code, market)
        quote_ctx = get_quote_context()
        
        ret_sub, err_message = _subscribe_if_needed(quote_ctx, [futu_code], SubType.QUOTE)
        if ret_sub != RET_OK:
            raise Exception(f"订阅股票失败: {err_message}")
        ret, data = quote_ctx.get_stock_quote([futu_code])
        if ret != RET_OK:
            raise Exception(f"获取股票报价失败: {data}")
        
        if data.empty:
            raise Exception(f"未找到股票 {futu_code} 的报价数据")
        
        row = data.iloc[0]
        last_price = float(row['last_price']) if pd.notna(row['last_price']) else None
        prev_close_price = float(row['prev_close_price']) if pd.notna(row['prev_close_price']) else None
        
        change_ratio = None
        if last_price is not None and prev_close_price is not None and prev_close_price > 0:
            change_ratio = (last_price - prev_close_price) / prev_close_price * 100
        
        return {
            'code': code,
            'name': str(row['name']) if pd.notna(row['name']) else '',
            'current_price': last_price,
            'change_ratio': change_ratio,
            'volume': int(row['volume']) if pd.notna(row['volume']) else 0,
            'amount': float(row['turnover']) if pd.notna(row['turnover']) else 0,
            'open_price': float(row['open_price']) if pd.notna(row['open_price']) else None,
            'high_price': float(row['high_price']) if pd.notna(row['high_price']) else None,
            'low_price': float(row['low_price']) if pd.notna(row['low_price']) else None,
            'prev_close_price': prev_close_price
        }
        
    except Exception as e:
        raise Exception(f"获取股票价格失败: {str(e)}")


def get_stock_rt_data(code: str, market: str) -> List[Dict]:
    """
    获取指定股票的分时数据（返回结构与K线兼容）
    
    :param code: 股票代码，如 '000001'
    :param market: 市场类型，'A' 或 'HK'
    :return: 分时数据列表
    """
    try:
        futu_code = convert_to_futu_code(code, market)
        quote_ctx = get_quote_context()
        
        ret_sub, err_message = _subscribe_if_needed(quote_ctx, [futu_code], SubType.RT_DATA)
        if ret_sub != RET_OK:
            raise Exception(f"订阅分时数据失败: {err_message}")
        ret, data = quote_ctx.get_rt_data(futu_code)
        if ret != RET_OK:
            raise Exception(f"获取分时数据失败: {data}")
        
        if data.empty:
            return []
        
        result = []
        for _, row in data.iterrows():
            if bool(row.get('is_blank')):
                continue
            time_value = str(row.get('time', '')).strip()
            cur_price = float(row['cur_price']) if pd.notna(row.get('cur_price')) else None
            volume = int(row['volume']) if pd.notna(row.get('volume')) else 0
            last_close = float(row['last_close']) if pd.notna(row.get('last_close')) else None
            turnover = float(row['turnover']) if pd.notna(row.get('turnover')) else None
            result.append({
                'date': time_value,
                'open': cur_price,
                'close': cur_price,
                'high': cur_price,
                'low': cur_price,
                'volume': volume,
                'last_close': last_close,
                'turnover': turnover
            })
        
        return result
    except Exception as e:
        raise Exception(f"获取分时数据失败: {str(e)}")


def get_stock_history_kline(code: str, market: str, start: str, end: str, max_count: int = 1000, ktype: str = "K_DAY") -> List[Dict]:
    """
    获取指定股票的历史K线数据（默认日K）
    
    :param code: 股票代码，如 '000001'
    :param market: 市场类型，'A' 或 'HK'
    :param start: 开始日期，格式 'YYYY-MM-DD'
    :param end: 结束日期，格式 'YYYY-MM-DD'
    :param max_count: 最大返回条数
    :return: K线数据列表，格式如下：
        [
            {
                'date': '2024-01-01',
                'open': 10.0,
                'close': 10.5,
                'high': 10.8,
                'low': 9.9,
                'volume': 1000000
            },
            ...
        ]
    """
    try:
        if ktype == "K_RT":
            return get_stock_rt_data(code, market)
        futu_code = convert_to_futu_code(code, market)
        quote_ctx = get_quote_context()
        
        result = []
        page_req_key = None
        remaining = max_count
        
        ktype_mapping = {
            "K_DAY": KLType.K_DAY,
            "K_WEEK": KLType.K_WEEK,
            "K_MON": KLType.K_MON,
            "K_QUARTER": KLType.K_QUARTER,
            "K_YEAR": KLType.K_YEAR
        }
        ktype_value = ktype_mapping.get(ktype, KLType.K_DAY)
        
        while remaining > 0:
            ret, data, page_req_key = quote_ctx.request_history_kline(
                code=futu_code,
                start=start,
                end=end,
                max_count=remaining,
                ktype=ktype_value,
                page_req_key=page_req_key
            )
            
            if ret != RET_OK:
                raise Exception(f"获取K线数据失败: {data}")
            
            if data.empty:
                break
            
            for _, row in data.iterrows():
                time_key = str(row.get('time_key', '')).split(' ')[0]
                result.append({
                    'date': time_key,
                    'open': float(row['open']) if pd.notna(row['open']) else None,
                    'close': float(row['close']) if pd.notna(row['close']) else None,
                    'high': float(row['high']) if pd.notna(row['high']) else None,
                    'low': float(row['low']) if pd.notna(row['low']) else None,
                    'volume': int(row['volume']) if pd.notna(row['volume']) else 0
                })
            
            remaining = max_count - len(result)
            if not page_req_key:
                break
        
        return result
    except Exception as e:
        raise Exception(f"获取K线历史数据失败: {str(e)}")


if __name__ == '__main__':
    # 测试代码
    data = get_all_stock_data()
    print("大A市场数据:")
    print("涨幅前50:")
    for i, stock in enumerate(data['A']['top_change'], 1):
        print(f"{i}. {stock['code']} - {stock['name']} (涨跌幅: {stock['changeRatio']:.1f}%)")
    
    print("\n港股市场数据:")
    print("涨幅前50:")
    for i, stock in enumerate(data['HK']['top_change'], 1):
        print(f"{i}. {stock['code']} - {stock['name']} (涨跌幅: {stock['changeRatio']:.1f}%)")
