import logging
import math
import re
import threading
import time
import socket

from futu import *
from datetime import date
import pandas as pd
from typing import Dict, List, Optional, Tuple
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
_quote_ctx_unavailable_until = 0.0
_quote_ctx_unavailable_reason = ''
_subscription_lock = threading.Lock()
_active_subscriptions: Dict[Tuple[str, SubType], float] = {}


def _sub_key(code: str, sub_type: SubType) -> Tuple[str, SubType]:
    return code, sub_type


def _get_futu_connect_timeout_sec() -> float:
    """
    富途端口可达性探测超时，默认 0.3 秒，避免阻塞业务接口。
    """
    try:
        timeout = float(os.getenv('FUTU_CONNECT_TIMEOUT_SEC', '0.3'))
        return max(0.05, timeout)
    except Exception:
        return 0.3


def _get_futu_connect_fail_cooldown_sec() -> float:
    """
    富途连接失败后的冷却时间（秒），冷却期内直接快速失败。
    """
    try:
        cooldown = float(os.getenv('FUTU_CONNECT_FAIL_COOLDOWN_SEC', '15'))
        return max(0.0, cooldown)
    except Exception:
        return 15.0


def _probe_futu_gateway(host: str, port: int, timeout_sec: float) -> Tuple[bool, str]:
    """
    先做 TCP 可达性探测，避免 OpenQuoteContext 在不可达场景中长期阻塞。
    """
    try:
        with socket.create_connection((host, port), timeout=timeout_sec):
            return True, ''
    except socket.timeout:
        return False, f"connect timeout after {timeout_sec:.2f}s"
    except OSError as exc:
        return False, str(exc)
    except Exception as exc:
        return False, str(exc)


def _build_price_fallback(code: str) -> Dict:
    return {
        'code': code,
        'name': '',
        'current_price': None,
        'change_ratio': None,
        'volume': 0,
        'amount': 0,
        'open_price': None,
        'high_price': None,
        'low_price': None,
        'prev_close_price': None
    }


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
    global _quote_ctx, _quote_ctx_created_at, _quote_ctx_unavailable_until, _quote_ctx_unavailable_reason
    with _quote_ctx_lock:
        now = time.time()
        if _quote_ctx is None and now < _quote_ctx_unavailable_until:
            raise TimeoutError(_quote_ctx_unavailable_reason or "Futu quote service temporarily unavailable")

        max_age_sec = int(os.getenv('FUTU_QUOTE_CTX_MAX_AGE_SEC', '1800'))
        if _quote_ctx is not None and max_age_sec > 0:
            alive_sec = now - _quote_ctx_created_at
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
            connect_timeout_sec = _get_futu_connect_timeout_sec()
            ok, reason = _probe_futu_gateway(futu_host, futu_port, connect_timeout_sec)
            if not ok:
                cooldown_sec = _get_futu_connect_fail_cooldown_sec()
                _quote_ctx_unavailable_until = now + cooldown_sec
                _quote_ctx_unavailable_reason = (
                    f"Futu gateway unavailable ({futu_host}:{futu_port}): {reason}"
                )
                logger.warning(_quote_ctx_unavailable_reason)
                raise TimeoutError(_quote_ctx_unavailable_reason)
            _quote_ctx = OpenQuoteContext(host=futu_host, port=futu_port)
            _quote_ctx_created_at = time.time()
            _quote_ctx_unavailable_until = 0.0
            _quote_ctx_unavailable_reason = ''
            logger.info(f"FutuQuoteContext created: {futu_host}:{futu_port}")
        return _quote_ctx


def _reset_quote_context():
    """连接异常时重置上下文，下次调用 get_quote_context 会重建"""
    global _quote_ctx, _quote_ctx_created_at, _active_subscriptions, _quote_ctx_unavailable_until, _quote_ctx_unavailable_reason
    with _quote_ctx_lock:
        if _quote_ctx is not None:
            try:
                _quote_ctx.close()
            except Exception:
                pass
            _quote_ctx = None
            _quote_ctx_created_at = 0.0
            logger.info("FutuQuoteContext reset due to error")
        _quote_ctx_unavailable_until = 0.0
        _quote_ctx_unavailable_reason = ''
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

    # 富途 get_market_snapshot 当前不支持北交所，按证券代码前缀过滤：
    # 82 / 83 / 87 / 92
    filtered_codes: List[str] = []
    skipped_bj_count = 0
    bj_prefixes = ('82', '83', '87', '92')
    for code in code_list:
        normalized = str(code).strip()
        if not normalized:
            continue
        # 兼容 SH.830001 / SZ.920001 / 830001
        code_part = normalized.split('.', 1)[1] if '.' in normalized else normalized
        if code_part.startswith(bj_prefixes):
            skipped_bj_count += 1
            continue
        filtered_codes.append(normalized)

    if skipped_bj_count > 0:
        logger.info(f"get_market_snapshot 过滤北交所标的: {skipped_bj_count} 个")

    if not filtered_codes:
        return pd.DataFrame()

    quote_context = get_quote_context()
    safe_batch_size = max(1, min(int(batch_size), 400))

    chunks: List[pd.DataFrame] = []
    for start in range(0, len(filtered_codes), safe_batch_size):
        batch_codes = filtered_codes[start:start + safe_batch_size]
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
    except TimeoutError as e:
        logger.warning(f"获取股票 {code} 实时价格超时，使用降级数据: {e}")
        return _build_price_fallback(code)
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


def _metric_float(value) -> Optional[float]:
    if value is None or (isinstance(value, float) and (pd.isna(value) or not math.isfinite(value))):
        return None
    try:
        number = float(value)
        if not math.isfinite(number):
            return None
        return number
    except (TypeError, ValueError):
        return None


def _extract_net_profit_from_items(item_list: List[Dict]) -> Optional[float]:
    """从利润表 item_list 提取净利润（优先归母/Net Profit）。"""
    if not item_list:
        return None

    preferred_ids = {5045, 5051, 5052}
    keywords = ('net profit', '净利润', '归母', 'parent company', 'common stockholders')

    for item in item_list:
        field_id = item.get('field_id')
        display_name = str(item.get('display_name', '')).lower()
        if field_id in preferred_ids or any(key in display_name for key in keywords):
            value = _metric_float(item.get('data'))
            if value is not None:
                return value
    return None


def _normalize_financial_key(key: str) -> str:
    mapping = {
        'itemList': 'item_list',
        'reportList': 'report_list',
        'structureList': 'structure_list',
        'periodText': 'period_text',
        'dateTime': 'date_time',
        'fiscalYear': 'fiscal_year',
        'financialType': 'financial_type',
        'fieldId': 'field_id',
        'displayName': 'display_name',
    }
    return mapping.get(key, key)


def _normalize_financial_dict(data: Dict) -> Dict:
    if not isinstance(data, dict):
        return data
    normalized: Dict = {}
    for key, value in data.items():
        normalized[_normalize_financial_key(key)] = value
    return normalized


def _normalize_financial_item(item: Dict) -> Dict:
    normalized = _normalize_financial_dict(item)
    if 'field_id' not in normalized and 'fieldId' in item:
        normalized['field_id'] = item.get('fieldId')
    if 'display_name' not in normalized and 'displayName' in item:
        normalized['display_name'] = item.get('displayName')
    return normalized


STATEMENT_INCOME = 1
STATEMENT_MAIN_INDEX = 4

_STATEMENT_TYPE_LABELS = {
    STATEMENT_INCOME: 'income',
    STATEMENT_MAIN_INDEX: 'main_index',
}

# A 股利润表归母净利润 field_id（按板块，与 OpenD lang 无关）
_INCOME_PARENT_FIELD_ID_STAR = 1047   # 科创板 SH.688
_INCOME_PARENT_FIELD_ID_MAIN = 3047   # 主板/创业板 SH./SZ.（非 688）
_INCOME_PARENT_FIELD_IDS_HK = (5051, 5052)
PARENT_NET_PROFIT_FIELD_IDS = (
    _INCOME_PARENT_FIELD_ID_STAR,
    _INCOME_PARENT_FIELD_ID_MAIN,
    *_INCOME_PARENT_FIELD_IDS_HK,
)

_PARENT_NET_PROFIT_DISPLAY_KEYWORDS_ZH = (
    '归属母公司净利润',
    '归属于母公司所有者的净利润',
    '归属母公司股东的净利润',
    '归属普通股股东净利润',
)
_PARENT_NET_PROFIT_DISPLAY_KEYWORDS_EN = (
    'net profit attributable',
    'profit attributable to owners',
    'profit attributable to equity holders',
    'common stockholders',
)

# A 股主要指标表扣非净利润：富途按板块模板分配 field_id（与 OpenD lang 无关）
# 科创板 SH.688 → 1024；主板/创业板等 SH./SZ.（非 688）→ 3026
_MAIN_INDEX_DEDUCTED_FIELD_ID_STAR = 1024
_MAIN_INDEX_DEDUCTED_FIELD_ID_MAIN = 3026

_DEDUCTED_NET_PROFIT_DISPLAY_KEYWORDS_ZH = (
    '扣非净利润',
    '扣除非经常性损益后的净利润',
)
_DEDUCTED_NET_PROFIT_DISPLAY_KEYWORDS_EN = (
    'deducted net profit',
    'net profit after deducting',
    'net profit after deduction',
    'excluding non-recurring',
    'non-recurring gains and losses',
    'non recurring gains and losses',
)

# 港股利润表：正常经营利润 = 营业利润(5034) - 经营利润特殊项目(5032)
_HK_INCOME_OPERATING_PROFIT_FIELD_ID = 5034
_HK_INCOME_OPERATING_SPECIAL_FIELD_ID = 5032


def _field_amount_from_items(item_list: List[Dict], field_id: int) -> Optional[float]:
    for item in item_list or []:
        normalized = _normalize_financial_item(item)
        if normalized.get('field_id') == field_id:
            return _metric_float(normalized.get('data'))
    return None


def _prior_year_period(period_text: Optional[str]) -> Optional[str]:
    if not period_text:
        return None
    match = re.match(r'^(\d{4})/(Q[1-4]|FY|H1|Q9)$', period_text)
    if not match:
        return None
    return f'{int(match.group(1)) - 1}/{match.group(2)}'


def _attach_prior_year_yoy_percent(series: List[Dict]) -> None:
    """按同比期利润重算复合指标的 yoy（%）。"""
    by_period = {item['period']: item for item in series if item.get('period')}
    for item in series:
        prev_period = _prior_year_period(item.get('period'))
        if not prev_period:
            continue
        prev = by_period.get(prev_period)
        if not prev:
            continue
        curr_profit = item.get('profit')
        prev_profit = prev.get('profit')
        if (
            curr_profit is None
            or prev_profit is None
            or not math.isfinite(curr_profit)
            or not math.isfinite(prev_profit)
            or prev_profit == 0
        ):
            continue
        item['yoy_percent'] = (curr_profit / prev_profit - 1) * 100


def _calc_hk_normal_operating_profit_from_items(
    item_list: List[Dict],
) -> Tuple[Optional[float], Dict]:
    """
    港股正常经营利润 = 营业利润(5034) - 经营利润特殊项目(5032)。
    5032 缺失时按 0 处理。
    """
    meta: Dict = {'formula': 'operating_profit - operating_special_items'}
    if not item_list:
        return None, meta

    operating_profit = _field_amount_from_items(
        item_list,
        _HK_INCOME_OPERATING_PROFIT_FIELD_ID,
    )
    if operating_profit is None:
        return None, meta

    special_items = _field_amount_from_items(
        item_list,
        _HK_INCOME_OPERATING_SPECIAL_FIELD_ID,
    )
    special_items_value = special_items if special_items is not None else 0.0
    normal_profit = operating_profit - special_items_value
    meta.update({
        'operating_profit': operating_profit,
        'operating_special_items': special_items,
        'operating_special_items_missing': special_items is None,
    })
    return normal_profit, meta


def _extract_hk_normal_operating_profit_yoy_from_reports(
    reports: List[Dict],
    period_text: Optional[str],
) -> Optional[float]:
    """按同比期正常经营利润重算 yoy（%）。"""
    if not period_text:
        return None
    prev_period = _prior_year_period(period_text)
    if not prev_period:
        return None

    by_period: Dict[str, float] = {}
    for report in reports or []:
        period = report.get('period_text')
        if not period:
            continue
        profit, _ = _calc_hk_normal_operating_profit_from_items(report.get('item_list') or [])
        if profit is not None:
            by_period[period] = profit

    curr_profit = by_period.get(period_text)
    prev_profit = by_period.get(prev_period)
    if (
        curr_profit is None
        or prev_profit is None
        or not math.isfinite(curr_profit)
        or not math.isfinite(prev_profit)
        or prev_profit == 0
    ):
        return None
    return (curr_profit / prev_profit - 1) * 100


def _structure_field_ids(structure_list: List[Dict]) -> set:
    field_ids = set()
    for item in structure_list or []:
        normalized = _normalize_financial_item(item)
        field_id = normalized.get('field_id')
        if field_id is not None:
            field_ids.add(int(field_id))
    return field_ids


def _expected_income_parent_net_profit_field_ids(futu_code: str) -> set:
    """利润表归母 field_id，按板块推断。"""
    code = (futu_code or '').upper()
    if code.startswith('SH.688'):
        return {_INCOME_PARENT_FIELD_ID_STAR}
    if code.startswith(('SH.', 'SZ.')):
        return {_INCOME_PARENT_FIELD_ID_MAIN}
    if code.startswith('HK.'):
        return set(_INCOME_PARENT_FIELD_IDS_HK)
    return set()


def _is_parent_net_profit_display_name(display_name: str) -> bool:
    """按展示名识别归母净利润（中英文），排除合并净利润/比率字段。"""
    if _is_ratio_style_field(display_name):
        return False
    lowered = display_name.lower()
    if display_name in ('净利润',) or lowered == 'net profit':
        return False
    if '持续经营' in display_name and '净利' in display_name:
        return False
    if any(key in display_name for key in _PARENT_NET_PROFIT_DISPLAY_KEYWORDS_ZH):
        return True
    if any(key in lowered for key in _PARENT_NET_PROFIT_DISPLAY_KEYWORDS_EN):
        return True
    return False


def _parent_net_profit_field_ids_by_display_name(structure_list: List[Dict]) -> set:
    field_ids = set()
    for item in structure_list or []:
        normalized = _normalize_financial_item(item)
        display_name = str(normalized.get('display_name', ''))
        if not _is_parent_net_profit_display_name(display_name):
            continue
        field_id = normalized.get('field_id')
        if field_id is not None:
            field_ids.add(int(field_id))
    return field_ids


def _parent_net_profit_field_ids(
    structure_list: List[Dict],
    futu_code: str,
) -> Tuple[set, str]:
    """利润表归母 field_id：优先板块 id + structure 校验，否则展示名。"""
    structure_ids = _structure_field_ids(structure_list)
    expected = _expected_income_parent_net_profit_field_ids(futu_code)
    matched = expected & structure_ids
    if matched:
        return matched, 'board_field_id'

    by_name = _parent_net_profit_field_ids_by_display_name(structure_list)
    if by_name:
        return by_name, 'display_name'
    return set(), 'none'


def _expected_main_index_deducted_field_id(futu_code: str) -> Optional[int]:
    """A 股主要指标表扣非 field_id，按板块模板推断。"""
    code = (futu_code or '').upper()
    if code.startswith('SH.688'):
        return _MAIN_INDEX_DEDUCTED_FIELD_ID_STAR
    if code.startswith(('SH.', 'SZ.')):
        return _MAIN_INDEX_DEDUCTED_FIELD_ID_MAIN
    return None


def _is_deducted_net_profit_display_name(display_name: str) -> bool:
    """按展示名识别扣非净利润（中英文），排除比率类字段。"""
    if _is_ratio_style_field(display_name):
        return False
    if any(key in display_name for key in _DEDUCTED_NET_PROFIT_DISPLAY_KEYWORDS_ZH):
        return True
    lowered = display_name.lower()
    if any(key in lowered for key in _DEDUCTED_NET_PROFIT_DISPLAY_KEYWORDS_EN):
        return True
    if 'non-recurring' in lowered or 'non recurring' in lowered:
        return 'profit' in lowered or '净利' in display_name
    return False


def _item_yoy_only(item: Dict) -> Optional[float]:
    """只取同比（%），利润增速不用环比。"""
    return _metric_float(item.get('yoy'))


def _is_ratio_style_field(display_name: str) -> bool:
    lowered = display_name.lower()
    if '/' in display_name or '／' in display_name:
        return True
    if any(token in display_name for token in ('率', 'ratio', 'margin', 'percent')):
        return '扣非净利润' not in display_name and '扣除非经常性损益' not in display_name
    return False


def _extract_yoy_by_field_ids(
    item_list: List[Dict],
    field_ids: set,
) -> Optional[float]:
    normalized_items = [_normalize_financial_item(item) for item in item_list]
    for field_id in field_ids:
        for item in normalized_items:
            if item.get('field_id') == field_id:
                yoy = _item_yoy_only(item)
                if yoy is not None:
                    return yoy
    return None


def _extract_deducted_net_profit_yoy_from_items(
    item_list: List[Dict],
    deducted_field_ids: Optional[set] = None,
) -> Optional[float]:
    """从 item_list 提取扣非净利润同比增速（%）。"""
    if not item_list:
        return None

    if deducted_field_ids:
        yoy = _extract_yoy_by_field_ids(item_list, deducted_field_ids)
        if yoy is not None:
            return yoy

    normalized_items = [_normalize_financial_item(item) for item in item_list]
    for item in normalized_items:
        display_name = str(item.get('display_name', ''))
        if not _is_deducted_net_profit_display_name(display_name):
            continue
        yoy = _item_yoy_only(item)
        if yoy is not None:
            return yoy
    return None


def _extract_parent_net_profit_yoy_from_items(
    item_list: List[Dict],
    parent_field_ids: Optional[set] = None,
) -> Optional[float]:
    """归母净利润同比（%），避免误用合并口径「净利润」。"""
    if not item_list:
        return None

    field_ids = parent_field_ids or set()
    if field_ids:
        yoy = _extract_yoy_by_field_ids(item_list, field_ids)
        if yoy is not None:
            return yoy

    normalized_items = [_normalize_financial_item(item) for item in item_list]
    for item in normalized_items:
        display_name = str(item.get('display_name', ''))
        if not _is_parent_net_profit_display_name(display_name):
            continue
        yoy = _item_yoy_only(item)
        if yoy is not None:
            return yoy
    return None


def _find_profit_growth_field_label(
    item_list: List[Dict],
    growth: float,
) -> Optional[str]:
    for item in item_list:
        normalized = _normalize_financial_item(item)
        yoy = _item_yoy_only(normalized)
        if yoy is not None and abs(yoy - growth) < 1e-6:
            return str(normalized.get('display_name') or '')
    return None


_F10_TYPE_NAME_MAP = {
    'F10Type_Q1': 1,
    'F10Type_Q2': 2,
    'F10Type_Q3': 3,
    'F10Type_Q4': 4,
    'F10Type_H1': 5,
    'F10Type_Q9': 6,
    'F10Type_Annual': 7,
    'F10Type_QuarterlyCombo': 9,
    'F10Type_QuarterlyAnnual': 10,
    'F10Type_CumulativeQuarterly': 11,
}
_QUARTERLY_F10_TYPES = {1, 2, 3, 4}


def _report_financial_type(report: Dict) -> Optional[int]:
    financial_type = report.get('financial_type')
    if financial_type is None:
        return None
    if hasattr(financial_type, 'value'):
        return int(financial_type.value)
    if isinstance(financial_type, str):
        if financial_type in _F10_TYPE_NAME_MAP:
            return _F10_TYPE_NAME_MAP[financial_type]
        mapping = {'Q1': 1, 'Q2': 2, 'Q3': 3, 'Q4': 4}
        if financial_type in mapping:
            return mapping[financial_type]
        if financial_type.isdigit():
            return int(financial_type)
        return None
    try:
        return int(financial_type)
    except (TypeError, ValueError):
        return None


def _deducted_net_profit_field_ids_by_display_name(structure_list: List[Dict]) -> set:
    field_ids = set()
    for item in structure_list or []:
        normalized = _normalize_financial_item(item)
        display_name = str(normalized.get('display_name', ''))
        if not _is_deducted_net_profit_display_name(display_name):
            continue
        field_id = normalized.get('field_id')
        if field_id is not None:
            field_ids.add(int(field_id))
    return field_ids


def _deducted_net_profit_field_ids(
    structure_list: List[Dict],
    futu_code: str,
    *,
    main_index: bool = True,
) -> Tuple[set, str]:
    """
    解析扣非净利润 field_id。
    A 股主要指标表优先按板块 field_id（lang 无关），并在 structure 中校验存在；
    其余情况回退展示名匹配。
    返回 (field_ids, resolve_source)。
    """
    structure_ids = _structure_field_ids(structure_list)
    if main_index:
        expected_id = _expected_main_index_deducted_field_id(futu_code)
        if expected_id is not None and expected_id in structure_ids:
            return {expected_id}, 'board_field_id'

    by_name = _deducted_net_profit_field_ids_by_display_name(structure_list)
    if by_name:
        return by_name, 'display_name'
    return set(), 'none'


def _pick_latest_quarter_report(reports: List[Dict]) -> Optional[Dict]:
    if not reports:
        return None
    normalized_reports = [_normalize_financial_dict(report) for report in reports]
    quarter_reports = [
        report for report in normalized_reports
        if _report_financial_type(report) in _QUARTERLY_F10_TYPES
    ]
    candidates = quarter_reports or normalized_reports
    return max(candidates, key=lambda item: item.get('date_time') or 0)


def _financial_fetch_log_ctx(
    futu_code: str,
    statement_type: int,
    financial_type: int,
) -> str:
    label = _STATEMENT_TYPE_LABELS.get(statement_type, str(statement_type))
    return (
        f'futu_code={futu_code} statement_type={statement_type}({label}) '
        f'financial_type={financial_type}'
    )


def _fetch_financial_reports(
    quote_ctx,
    futu_code: str,
    statement_type: int,
    financial_type: int,
) -> Tuple[List[Dict], Optional[str], List[Dict]]:
    ctx = _financial_fetch_log_ctx(futu_code, statement_type, financial_type)
    if not hasattr(quote_ctx, 'get_financials_statements'):
        error = '当前 futu-api 版本不支持 get_financials_statements，请升级 futu-api>=10.7'
        logger.warning('[财报拉取] %s 返回空数据: %s', ctx, error)
        return [], error, []
    try:
        fin_ret, fin_data = quote_ctx.get_financials_statements(
            futu_code,
            statement_type=statement_type,
            financial_type=financial_type,
            num=20,
        )
        if fin_ret != RET_OK:
            error_text = str(fin_data)
            if '未知的协议' in error_text or 'unknown protocol' in error_text.lower():
                error = (
                    'OpenD 版本过低，不支持财报接口 get_financials_statements，'
                    '请升级富途 OpenD 至最新版（与 futu-api 10.7+ 匹配）'
                )
                logger.warning('[财报拉取] %s 返回空数据: %s', ctx, error)
                return [], error, []
            error = f'获取财报失败: {error_text}'
            logger.warning('[财报拉取] %s 返回空数据: %s', ctx, error)
            return [], error, []

        if not fin_data:
            error = '财报接口返回空数据'
            logger.warning('[财报拉取] %s 返回空数据: %s', ctx, error)
            return [], error, []

        fin_data = _normalize_financial_dict(fin_data)
        structure_list = [
            _normalize_financial_item(item)
            for item in (fin_data.get('structure_list') or [])
        ]
        reports = [
            _normalize_financial_dict(report)
            for report in (fin_data.get('report_list') or [])
        ]
        if not reports:
            logger.warning(
                '[财报拉取] %s report_list 为空 structure_count=%d',
                ctx,
                len(structure_list),
            )
        elif not structure_list:
            logger.warning(
                '[财报拉取] %s structure_list 为空 report_count=%d',
                ctx,
                len(reports),
            )
        empty_item_reports = sum(
            1 for report in reports if not (report.get('item_list') or [])
        )
        if empty_item_reports:
            logger.warning(
                '[财报拉取] %s %d/%d 期 report 的 item_list 为空',
                ctx,
                empty_item_reports,
                len(reports),
            )
        return reports, None, structure_list
    except Exception as exc:
        logger.warning(
            '[财报拉取] %s 返回空数据: 获取财报异常: %s',
            ctx,
            exc,
        )
        return [], f'获取财报异常: {exc}', []


def _extract_profit_growth_from_report(
    report: Dict,
    structure_list: List[Dict],
    futu_code: str,
    *,
    prefer_deducted: bool,
    allow_parent_fallback: bool = True,
    main_index: bool = True,
    prefer_hk_normal_operating_profit: bool = False,
    income_reports: Optional[List[Dict]] = None,
) -> Tuple[Optional[float], Optional[str], Optional[str]]:
    item_list = [
        _normalize_financial_item(item)
        for item in (report.get('item_list') or [])
    ]
    deducted_field_ids, _ = _deducted_net_profit_field_ids(
        structure_list,
        futu_code,
        main_index=main_index,
    )
    parent_field_ids, _ = (
        _parent_net_profit_field_ids(structure_list, futu_code)
        if not main_index
        else (set(), 'none')
    )

    if prefer_hk_normal_operating_profit:
        growth = _extract_hk_normal_operating_profit_yoy_from_reports(
            income_reports or [],
            report.get('period_text'),
        )
        if growth is not None:
            return growth, '正常经营利润同比', 'hk_normal_operating_profit'

    if prefer_deducted:
        growth = _extract_deducted_net_profit_yoy_from_items(
            item_list,
            deducted_field_ids=deducted_field_ids or None,
        )
        if growth is not None:
            label = _find_profit_growth_field_label(item_list, growth)
            return growth, label, 'deducted'

    if allow_parent_fallback:
        growth = _extract_parent_net_profit_yoy_from_items(
            item_list,
            parent_field_ids=parent_field_ids or None,
        )
        if growth is not None:
            label = _find_profit_growth_field_label(item_list, growth)
            return growth, label, 'parent'
    return None, None, None


def _load_latest_quarter_profit_growth(
    quote_ctx,
    futu_code: str,
    market: str,
) -> Tuple[Optional[float], Optional[str], Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    A 股：优先主要指标表扣非净利润同比；扣非缺失时再尝试利润表扣非，最后才回退归母。
    港股：利润表正常经营利润（5034-5032）同比。
    """
    last_error = None
    protocol_unsupported = False
    is_a_share = market == 'A'
    is_hk = market == 'HK'

    for financial_type in (10, 9, 11):
        if protocol_unsupported:
            break

        if is_hk:
            income_reports, error, income_structure = _fetch_financial_reports(
                quote_ctx,
                futu_code,
                statement_type=STATEMENT_INCOME,
                financial_type=financial_type,
            )
            if error and ('未知的协议' in error or 'unknown protocol' in error.lower()):
                protocol_unsupported = True
                last_error = error
                break
            latest_income = _pick_latest_quarter_report(income_reports)
            if latest_income:
                growth, field_label, growth_kind = _extract_profit_growth_from_report(
                    latest_income,
                    income_structure,
                    futu_code,
                    prefer_deducted=False,
                    allow_parent_fallback=False,
                    main_index=False,
                    prefer_hk_normal_operating_profit=True,
                    income_reports=income_reports,
                )
                if growth is not None:
                    return (
                        growth,
                        latest_income.get('period_text'),
                        None,
                        'financial_statements_income_hk_normal_operating_profit',
                        field_label,
                        growth_kind,
                    )
            last_error = '港股未找到正常经营利润同比增速'
            if error:
                last_error = error
            continue

        main_reports, error, main_structure = _fetch_financial_reports(
            quote_ctx,
            futu_code,
            statement_type=STATEMENT_MAIN_INDEX,
            financial_type=financial_type,
        )
        if error and ('未知的协议' in error or 'unknown protocol' in error.lower()):
            protocol_unsupported = True
            last_error = error
            break

        latest_quarter = _pick_latest_quarter_report(main_reports)
        if latest_quarter:
            growth, field_label, growth_kind = _extract_profit_growth_from_report(
                latest_quarter,
                main_structure,
                futu_code,
                prefer_deducted=True,
                allow_parent_fallback=not is_a_share,
                main_index=True,
            )
            if growth is not None:
                return (
                    growth,
                    latest_quarter.get('period_text'),
                    None,
                    'financial_statements_main_index',
                    field_label,
                    growth_kind,
                )

        income_reports, income_error, income_structure = _fetch_financial_reports(
            quote_ctx,
            futu_code,
            statement_type=STATEMENT_INCOME,
            financial_type=financial_type,
        )
        if income_error and not error:
            error = income_error
        latest_income = _pick_latest_quarter_report(income_reports)
        if latest_income:
            growth, field_label, growth_kind = _extract_profit_growth_from_report(
                latest_income,
                income_structure,
                futu_code,
                prefer_deducted=True,
                allow_parent_fallback=False,
                main_index=False,
            )
            if growth is not None:
                return (
                    growth,
                    latest_income.get('period_text'),
                    None,
                    'financial_statements_income',
                    field_label,
                    growth_kind,
                )

            if is_a_share:
                growth, field_label, growth_kind = _extract_profit_growth_from_report(
                    latest_income,
                    income_structure,
                    futu_code,
                    prefer_deducted=False,
                    allow_parent_fallback=True,
                    main_index=False,
                )
                if growth is not None:
                    return (
                        growth,
                        latest_income.get('period_text'),
                        None,
                        'financial_statements_income_parent_fallback',
                        field_label,
                        growth_kind,
                    )

            last_error = (
                'A股未找到扣非净利润同比增速'
                if is_a_share
                else '最近季报未找到可用的扣非/归母净利润同比增速'
            )
            continue

        if error:
            last_error = error

    return None, None, last_error, None, None, None


def _extract_parent_net_profit_from_items(
    item_list: List[Dict],
    parent_field_ids: Optional[set] = None,
) -> Tuple[Optional[float], Optional[float]]:
    """返回 (归母净利润金额, 同比增速%)。"""
    if not item_list:
        return None, None

    normalized_items = [_normalize_financial_item(item) for item in item_list]
    if parent_field_ids:
        for field_id in parent_field_ids:
            for item in normalized_items:
                if item.get('field_id') == field_id:
                    data = _metric_float(item.get('data'))
                    yoy = _item_yoy_only(item)
                    if data is not None:
                        return data, yoy

    for item in normalized_items:
        display_name = str(item.get('display_name', ''))
        if not _is_parent_net_profit_display_name(display_name):
            continue
        data = _metric_float(item.get('data'))
        yoy = _item_yoy_only(item)
        if data is not None:
            return data, yoy
    return None, None


def _extract_deducted_net_profit_from_items(
    item_list: List[Dict],
    deducted_field_ids: Optional[set] = None,
) -> Tuple[Optional[float], Optional[float]]:
    """返回 (扣非净利润金额, 同比增速%)。"""
    if not item_list:
        return None, None

    normalized_items = [_normalize_financial_item(item) for item in item_list]
    if deducted_field_ids:
        for field_id in deducted_field_ids:
            for item in normalized_items:
                if item.get('field_id') == field_id:
                    data = _metric_float(item.get('data'))
                    yoy = _item_yoy_only(item)
                    if data is not None:
                        return data, yoy

    for item in normalized_items:
        display_name = str(item.get('display_name', ''))
        if not _is_deducted_net_profit_display_name(display_name):
            continue
        data = _metric_float(item.get('data'))
        yoy = _item_yoy_only(item)
        if data is not None:
            return data, yoy
    return None, None


def _log_opend_environment(quote_ctx, futu_code: str) -> Optional[str]:
    """记录 OpenD / futu-api 环境，便于对比生产与本地。"""
    server_ver = None
    try:
        import futu as futu_pkg

        ret, global_state = quote_ctx.get_global_state()
        if ret == RET_OK and isinstance(global_state, dict):
            server_ver = global_state.get('server_ver')
        logger.info(
            '[估值数据][%s] 环境 OpenD server_ver=%s futu-api=%s FUTU_HOST=%s FUTU_PORT=%s',
            futu_code,
            server_ver,
            getattr(futu_pkg, '__version__', 'unknown'),
            os.getenv('FUTU_HOST', '127.0.0.1'),
            os.getenv('FUTU_PORT', '11111'),
        )
    except Exception as exc:
        logger.warning('[估值数据][%s] 读取 OpenD 环境失败: %s', futu_code, exc)
    return server_ver


def _collect_quarter_deducted_series(
    quote_ctx,
    futu_code: str,
) -> Tuple[List[Dict], Optional[str]]:
    """收集单季扣非净利润序列，按 date_time 升序。"""
    last_error = None
    protocol_unsupported = False

    for financial_type in (10, 9, 11):
        if protocol_unsupported:
            break
        reports, error, structure = _fetch_financial_reports(
            quote_ctx,
            futu_code,
            statement_type=STATEMENT_MAIN_INDEX,
            financial_type=financial_type,
        )
        if error and ('未知的协议' in error or 'unknown protocol' in error.lower()):
            protocol_unsupported = True
            last_error = error
            break
        if not reports:
            if error:
                last_error = error
            continue

        deducted_field_ids, resolve_source = _deducted_net_profit_field_ids(
            structure,
            futu_code,
            main_index=True,
        )
        logger.info(
            '[估值数据][%s] 扣非 field_id=%s source=%s structure_count=%d',
            futu_code,
            sorted(deducted_field_ids) if deducted_field_ids else [],
            resolve_source,
            len(structure or []),
        )
        series: List[Dict] = []
        for report in reports:
            ft = _report_financial_type(report)
            if ft not in _QUARTERLY_F10_TYPES:
                continue
            item_list = report.get('item_list') or []
            profit, yoy = _extract_deducted_net_profit_from_items(
                item_list,
                deducted_field_ids=deducted_field_ids or None,
            )
            if profit is None:
                continue
            series.append({
                'period': report.get('period_text'),
                'date_time': report.get('date_time') or 0,
                'profit': profit,
                'yoy_percent': yoy,
            })

        if series:
            series.sort(key=lambda item: item['date_time'])
            logger.info(
                '[估值数据][%s] 扣非序列命中 financial_type=%s count=%d latest=%s',
                futu_code,
                financial_type,
                len(series),
                series[-1],
            )
            return series, None

    if last_error and (
        '未知的协议' in last_error
        or 'unknown protocol' in last_error.lower()
        or '不支持 get_financials_statements' in last_error
    ):
        logger.info('[估值数据][%s] 扣非序列失败 error=%r', futu_code, last_error)
        return [], 'opend_unsupported'
    logger.info(
        '[估值数据][%s] 扣非序列为空 last_error=%r',
        futu_code,
        last_error,
    )
    return [], 'missing_deducted_net_profit'


def _collect_hk_normal_operating_profit_series(
    quote_ctx,
    futu_code: str,
) -> Tuple[List[Dict], Optional[str]]:
    """收集港股单季正常经营利润（5034-5032）序列（利润表），按 date_time 升序。"""
    last_error = None
    protocol_unsupported = False

    for financial_type in (10, 9, 11):
        if protocol_unsupported:
            break
        reports, error, structure = _fetch_financial_reports(
            quote_ctx,
            futu_code,
            statement_type=STATEMENT_INCOME,
            financial_type=financial_type,
        )
        if error and ('未知的协议' in error or 'unknown protocol' in error.lower()):
            protocol_unsupported = True
            last_error = error
            break
        if not reports:
            if error:
                last_error = error
            continue

        logger.info(
            '[估值数据][%s] 港股正常经营利润 formula=5034-5032 structure_count=%d',
            futu_code,
            len(structure or []),
        )

        series: List[Dict] = []
        for report in reports:
            ft = _report_financial_type(report)
            if ft not in _QUARTERLY_F10_TYPES:
                continue
            item_list = report.get('item_list') or []
            profit, _ = _calc_hk_normal_operating_profit_from_items(item_list)
            if profit is None:
                continue
            series.append({
                'period': report.get('period_text'),
                'date_time': report.get('date_time') or 0,
                'profit': profit,
                'yoy_percent': None,
            })

        if series:
            series.sort(key=lambda item: item['date_time'])
            _attach_prior_year_yoy_percent(series)
            logger.info(
                '[估值数据][%s] 港股正常经营利润序列命中 financial_type=%s count=%d latest=%s',
                futu_code,
                financial_type,
                len(series),
                series[-1],
            )
            return series, None

    if last_error and (
        '未知的协议' in last_error
        or 'unknown protocol' in last_error.lower()
        or '不支持 get_financials_statements' in last_error
    ):
        logger.info('[估值数据][%s] 港股正常经营利润序列失败 error=%r', futu_code, last_error)
        return [], 'opend_unsupported'
    logger.info(
        '[估值数据][%s] 港股正常经营利润序列为空 last_error=%r',
        futu_code,
        last_error,
    )
    return [], 'missing_hk_non_ifrs_operating_profit'


def _collect_quarter_net_profit_series(
    quote_ctx,
    futu_code: str,
) -> Tuple[List[Dict], Optional[str]]:
    """收集单季归母净利润序列（利润表），按 date_time 升序。"""
    last_error = None
    protocol_unsupported = False

    for financial_type in (10, 9, 11):
        if protocol_unsupported:
            break
        reports, error, structure = _fetch_financial_reports(
            quote_ctx,
            futu_code,
            statement_type=STATEMENT_INCOME,
            financial_type=financial_type,
        )
        if error and ('未知的协议' in error or 'unknown protocol' in error.lower()):
            protocol_unsupported = True
            last_error = error
            break
        if not reports:
            if error:
                last_error = error
            continue

        parent_field_ids, resolve_source = _parent_net_profit_field_ids(
            structure,
            futu_code,
        )
        logger.info(
            '[估值数据][%s] 归母 field_id=%s source=%s structure_count=%d',
            futu_code,
            sorted(parent_field_ids) if parent_field_ids else [],
            resolve_source,
            len(structure or []),
        )

        series: List[Dict] = []
        for report in reports:
            ft = _report_financial_type(report)
            if ft not in _QUARTERLY_F10_TYPES:
                continue
            item_list = report.get('item_list') or []
            profit, yoy = _extract_parent_net_profit_from_items(
                item_list,
                parent_field_ids=parent_field_ids or None,
            )
            if profit is None:
                continue
            series.append({
                'period': report.get('period_text'),
                'date_time': report.get('date_time') or 0,
                'profit': profit,
                'yoy_percent': yoy,
            })

        if series:
            series.sort(key=lambda item: item['date_time'])
            logger.info(
                '[估值数据][%s] 归母序列命中 financial_type=%s count=%d latest=%s',
                futu_code,
                financial_type,
                len(series),
                series[-1],
            )
            return series, None

    if last_error and (
        '未知的协议' in last_error
        or 'unknown protocol' in last_error.lower()
        or '不支持 get_financials_statements' in last_error
    ):
        logger.info('[估值数据][%s] 归母序列失败 error=%r', futu_code, last_error)
        return [], 'opend_unsupported'
    logger.info(
        '[估值数据][%s] 归母序列为空 last_error=%r',
        futu_code,
        last_error,
    )
    return [], 'missing_parent_net_profit'


def _format_yi_for_log(value: Optional[float]) -> str:
    if value is None or not math.isfinite(value):
        return '—'
    return f'{value / 1e8:.4f} 亿'


def _log_dynamic_pe_calculation(
    futu_code: str,
    *,
    market_cap: Optional[float],
    latest_net: Dict,
    dynamic_pe: Optional[float],
) -> None:
    latest_quarter_profit = latest_net.get('profit')
    annualized_profit = (
        latest_quarter_profit * 4
        if latest_quarter_profit is not None and latest_quarter_profit > 0
        else None
    )
    logger.info(
        '[估值][%s] 动态 PE 计算过程:\n'
        '  公式: 动态 PE = 市值 ÷ (最新单季归母净利润 × 4)\n'
        '  市值 = %s\n'
        '  最新单季归母净利润 (%s) = %s\n'
        '  年化归母净利润 = 单季 × 4 = %s\n'
        '  动态 PE = %s ÷ %s = %s',
        futu_code,
        _format_yi_for_log(market_cap),
        latest_net.get('period'),
        _format_yi_for_log(latest_quarter_profit),
        _format_yi_for_log(annualized_profit),
        _format_yi_for_log(market_cap),
        _format_yi_for_log(annualized_profit),
        f'{dynamic_pe:.4f}' if dynamic_pe is not None and math.isfinite(dynamic_pe) else '—',
    )


def _log_deducted_ttm_calculation(
    futu_code: str,
    quarters: List[Dict],
    ttm_profit: Optional[float],
    ttm_growth: Optional[float],
    period_label: Optional[str],
) -> None:
    lines = [
        f'[估值][{futu_code}] 扣非净利润 TTM 计算过程:',
        '  单季扣非序列（主要指标表）:',
    ]
    for item in quarters:
        line = f"    {item.get('period')}: {_format_yi_for_log(item.get('profit'))}"
        yoy = item.get('yoy_percent')
        if yoy is not None:
            line += f'，单季同比 {yoy:.4f}%'
        lines.append(line)

    if len(quarters) >= 4:
        last4 = quarters[-4:]
        lines.append('  近 4 季 TTM = ' + ' + '.join(
            _format_yi_for_log(item.get('profit')) for item in last4
        ))
        lines.append(f'         = {_format_yi_for_log(ttm_profit)}（{period_label}）')

    if len(quarters) >= 8:
        prev4 = quarters[-8:-4]
        ttm_prev = sum(item['profit'] for item in prev4)
        prev_label = f"{prev4[0]['period']}~{prev4[-1]['period']}"
        lines.append('  前 4 季 TTM = ' + ' + '.join(
            _format_yi_for_log(item.get('profit')) for item in prev4
        ))
        lines.append(f'             = {_format_yi_for_log(ttm_prev)}（{prev_label}）')
        if ttm_profit is not None and ttm_prev > 0 and ttm_growth is not None:
            lines.append(
                f'  TTM 同比 = ({_format_yi_for_log(ttm_profit)} ÷ '
                f'{_format_yi_for_log(ttm_prev)} - 1) × 100% = {ttm_growth:.4f}%'
            )
    elif ttm_profit is not None:
        lines.append('  历史季报不足 8 期，无法计算 TTM 同比')

    logger.info('\n'.join(lines))


def _calc_ttm_deducted_metrics(
    quarters: List[Dict],
    *,
    futu_code: Optional[str] = None,
) -> Tuple[Optional[float], Optional[float], Optional[str]]:
    """返回 (TTM扣非净利润, TTM同比增速%, 区间说明)。"""
    if len(quarters) < 4:
        if futu_code:
            logger.info(
                '[估值][%s] 扣非净利润 TTM 计算跳过: 单季扣非仅 %d 期，不足 4 期',
                futu_code,
                len(quarters),
            )
        return None, None, None

    last4 = quarters[-4:]
    ttm_profit = sum(item['profit'] for item in last4)
    period_label = f"{last4[0]['period']}~{last4[-1]['period']}"

    if len(quarters) < 8:
        if futu_code:
            _log_deducted_ttm_calculation(
                futu_code, quarters, ttm_profit, None, period_label
            )
        return ttm_profit, None, period_label

    prev4 = quarters[-8:-4]
    ttm_prev = sum(item['profit'] for item in prev4)
    if ttm_prev <= 0:
        if futu_code:
            _log_deducted_ttm_calculation(
                futu_code, quarters, ttm_profit, None, period_label
            )
        return ttm_profit, None, period_label

    growth = (ttm_profit / ttm_prev - 1) * 100
    if futu_code:
        _log_deducted_ttm_calculation(
            futu_code, quarters, ttm_profit, growth, period_label
        )
    return ttm_profit, growth, period_label


def _calc_dynamic_pe_from_annualized_profit(
    market_cap: Optional[float],
    current_price: Optional[float],
    shares: Optional[float],
    latest_quarter_profit: Optional[float],
) -> Optional[float]:
    if latest_quarter_profit is None or latest_quarter_profit <= 0:
        return None
    annualized_profit = latest_quarter_profit * 4
    if market_cap is not None and market_cap > 0:
        return market_cap / annualized_profit
    if (
        current_price is not None
        and current_price > 0
        and shares is not None
        and shares > 0
    ):
        annualized_eps = annualized_profit / shares
        return current_price / annualized_eps
    return None


def _calc_peg(pe: Optional[float], growth_percent: Optional[float]) -> Optional[float]:
    if pe is None or pe <= 0:
        return None
    if growth_percent is None or growth_percent <= 0:
        return None
    return pe / growth_percent


def _calc_payback_years(
    market_cap: float,
    profit: float,
    growth_percent: Optional[float],
) -> Optional[float]:
    if market_cap <= 0 or profit <= 0:
        return None
    if growth_percent is None:
        return None
    growth_decimal = growth_percent / 100
    if growth_decimal <= -0.99:
        return None

    pe = market_cap / profit
    if abs(growth_decimal) < 1e-9:
        return pe

    g = growth_decimal
    b = 1 + (g * pe) / (1 + g)
    if b <= 1:
        return None
    n = math.log(b) / math.log(1 + g)
    if not math.isfinite(n) or n < 0:
        return None
    return math.ceil(n)


def _build_valuation_scenario(
    *,
    pe: Optional[float],
    growth_percent: Optional[float],
    market_cap: Optional[float],
    profit: Optional[float],
    growth_period: Optional[str] = None,
    profit_label: Optional[str] = None,
    profit_growth_field_label: Optional[str] = None,
    compute_peg: bool = True,
) -> Dict:
    scenario: Dict = {
        'pe': pe,
        'profit_growth_percent': growth_percent,
        'profit_growth_period': growth_period,
        'profit_label': profit_label,
        'profit_growth_field_label': profit_growth_field_label,
        'market_cap_yi': market_cap / 1e8 if market_cap else None,
        'profit_yi': profit / 1e8 if profit else None,
        'peg': None,
        'payback_years': None,
        'errors': [],
    }

    if pe is None or pe <= 0:
        scenario['errors'].append('invalid_pe')

    if compute_peg:
        if growth_percent is None:
            scenario['errors'].append('missing_growth')
        elif growth_percent <= 0:
            scenario['errors'].append('non_positive_growth')
        if market_cap is None or market_cap <= 0 or profit is None or profit <= 0:
            scenario['errors'].append('invalid_profit')

        peg_errors = {'missing_growth', 'non_positive_growth', 'invalid_profit', 'invalid_pe'}
        if not peg_errors.intersection(scenario['errors']):
            scenario['peg'] = _calc_peg(pe, growth_percent)
            scenario['payback_years'] = _calc_payback_years(market_cap, profit, growth_percent)
            if scenario['peg'] is None:
                scenario['errors'].append('invalid_peg')
            if scenario['payback_years'] is None:
                scenario['errors'].append('payback_unavailable')

    return scenario


def _append_unique_error(scenario: Dict, code: str) -> None:
    if code not in scenario['errors']:
        scenario['errors'].append(code)


def _build_valuation_scenarios(
    quote_ctx,
    futu_code: str,
    market: str,
    *,
    market_cap: Optional[float],
    current_price: Optional[float],
    shares: Optional[float],
    pe_static: Optional[float],
    pe_ttm: Optional[float],
) -> Tuple[Dict, Optional[str]]:
    net_quarters, net_error = _collect_quarter_net_profit_series(quote_ctx, futu_code)
    is_hk = market == 'HK'
    if is_hk:
        growth_quarters, growth_error = _collect_hk_normal_operating_profit_series(
            quote_ctx,
            futu_code,
        )
        growth_field_label = '正常经营利润同比'
        growth_ttm_label = '正常经营利润 TTM 同比'
        growth_ttm_profit_label = '正常经营利润 TTM'
        missing_growth_code = 'missing_hk_non_ifrs_growth'
        missing_series_code = 'missing_hk_non_ifrs_operating_profit'
    else:
        growth_quarters, growth_error = _collect_quarter_deducted_series(quote_ctx, futu_code)
        growth_field_label = '扣非净利润同比'
        growth_ttm_label = '扣非净利润 TTM 同比'
        growth_ttm_profit_label = '扣非净利润 TTM'
        missing_growth_code = 'missing_deducted_growth'
        missing_series_code = 'missing_deducted_net_profit'

    dynamic_scenario: Dict = {
        'pe': None,
        'profit_growth_percent': None,
        'profit_growth_period': None,
        'profit_label': None,
        'profit_growth_field_label': None,
        'market_cap_yi': market_cap / 1e8 if market_cap else None,
        'profit_yi': None,
        'peg': None,
        'payback_years': None,
        'errors': [],
    }

    if not net_quarters:
        _append_unique_error(dynamic_scenario, net_error or 'missing_parent_net_profit')
    elif not growth_quarters:
        latest_net = net_quarters[-1]
        dynamic_pe = _calc_dynamic_pe_from_annualized_profit(
            market_cap,
            current_price,
            shares,
            latest_net['profit'],
        )
        _log_dynamic_pe_calculation(
            futu_code,
            market_cap=market_cap,
            latest_net=latest_net,
            dynamic_pe=dynamic_pe,
        )
        dynamic_scenario.update({
            'pe': dynamic_pe,
            'profit_growth_period': latest_net.get('period'),
            'profit_label': '归母净利润（单季×4）',
            'pe_static_reference': pe_static,
        })
        if dynamic_pe is None or dynamic_pe <= 0:
            _append_unique_error(dynamic_scenario, 'invalid_pe')
        _append_unique_error(
            dynamic_scenario,
            growth_error or missing_growth_code,
        )
    else:
        latest_net = net_quarters[-1]
        latest_growth = growth_quarters[-1]
        annualized_growth_profit = latest_growth['profit'] * 4
        dynamic_pe = _calc_dynamic_pe_from_annualized_profit(
            market_cap,
            current_price,
            shares,
            latest_net['profit'],
        )
        _log_dynamic_pe_calculation(
            futu_code,
            market_cap=market_cap,
            latest_net=latest_net,
            dynamic_pe=dynamic_pe,
        )
        dynamic_scenario = _build_valuation_scenario(
            pe=dynamic_pe,
            growth_percent=latest_growth.get('yoy_percent'),
            market_cap=market_cap,
            profit=annualized_growth_profit,
            growth_period=latest_growth.get('period'),
            profit_label='归母净利润（单季×4）',
            profit_growth_field_label=growth_field_label,
            compute_peg=True,
        )
        dynamic_scenario['pe_static_reference'] = pe_static

    if not growth_quarters:
        ttm_scenario = _build_valuation_scenario(
            pe=pe_ttm if pe_ttm is not None and pe_ttm > 0 else None,
            growth_percent=None,
            market_cap=market_cap,
            profit=None,
            growth_period=None,
            profit_label=growth_ttm_profit_label,
            profit_growth_field_label=growth_ttm_label,
            compute_peg=False,
        )
        _append_unique_error(ttm_scenario, growth_error or missing_series_code)
        if pe_ttm is None or pe_ttm <= 0:
            _append_unique_error(ttm_scenario, 'missing_pe_ttm')
    else:
        ttm_profit, ttm_growth, ttm_period = _calc_ttm_deducted_metrics(
            growth_quarters,
            futu_code=futu_code,
        )
        ttm_scenario = _build_valuation_scenario(
            pe=pe_ttm if pe_ttm is not None and pe_ttm > 0 else None,
            growth_percent=ttm_growth,
            market_cap=market_cap,
            profit=ttm_profit,
            growth_period=ttm_period,
            profit_label=growth_ttm_profit_label,
            profit_growth_field_label=growth_ttm_label,
            compute_peg=ttm_growth is not None and ttm_profit is not None,
        )
        if ttm_growth is None and len(growth_quarters) < 8:
            _append_unique_error(ttm_scenario, 'insufficient_quarters_for_ttm_growth')
        if pe_ttm is None or pe_ttm <= 0:
            _append_unique_error(ttm_scenario, 'missing_pe_ttm')

    series_error = net_error or growth_error
    return {'dynamic': dynamic_scenario, 'ttm': ttm_scenario}, series_error


def get_stock_valuation_metrics(code: str, market: str) -> Dict:
    """
    获取估值双口径：
    - 动态：PE = 市值÷(单季归母净利润×4)；PEG/回收期配最近单季扣非净利润同比
    - TTM：PE = pe_ttm_ratio；PEG/回收期配扣非 TTM 同比
    """
    futu_code = convert_to_futu_code(code, market)
    quote_ctx = get_quote_context()
    opend_server_ver = _log_opend_environment(quote_ctx, futu_code)

    ret, snap_df = quote_ctx.get_market_snapshot([futu_code])
    if ret != RET_OK:
        raise Exception(f"获取市场快照失败: {snap_df}")
    if snap_df.empty:
        raise Exception(f"未找到股票 {futu_code} 的快照数据")

    row = snap_df.iloc[0]
    market_cap = _metric_float(row.get('total_market_val'))
    pe_static = _metric_float(row.get('pe_ratio'))
    pe_ttm = _metric_float(row.get('pe_ttm_ratio'))
    current_price = _metric_float(row.get('last_price'))
    shares = _metric_float(row.get('issued_shares'))
    if shares is None or shares <= 0:
        shares = _metric_float(row.get('outstanding_shares'))

    logger.info(
        '[估值数据][%s] 快照 code=%s market=%s price=%s market_cap_yi=%s '
        'pe_static=%s pe_ttm=%s shares=%s',
        futu_code,
        code,
        market,
        current_price,
        _format_yi_for_log(market_cap),
        pe_static,
        pe_ttm,
        shares,
    )

    metrics: Dict = {
        'code': code,
        'name': str(row.get('name', '')) if pd.notna(row.get('name')) else '',
        'market': market,
        'currency': 'HKD' if market == 'HK' else 'CNY',
        'current_price': current_price,
        'market_cap': market_cap,
        'pe_static': pe_static,
        'pe_ttm': pe_ttm,
        'opend_server_ver': opend_server_ver,
        'data_sources': ['market_snapshot', 'financial_statements_income', 'financial_statements_main_index'],
    }

    if market_cap is not None:
        metrics['market_cap_yi'] = market_cap / 1e8

    scenarios, series_error = _build_valuation_scenarios(
        quote_ctx,
        futu_code,
        market,
        market_cap=market_cap,
        current_price=current_price,
        shares=shares,
        pe_static=pe_static,
        pe_ttm=pe_ttm,
    )
    metrics['scenarios'] = scenarios
    if series_error:
        metrics['profit_growth_error'] = series_error
    logger.info(
        '[估值数据][%s] 结果 dynamic_errors=%s ttm_errors=%s series_error=%r',
        futu_code,
        scenarios.get('dynamic', {}).get('errors'),
        scenarios.get('ttm', {}).get('errors'),
        series_error,
    )
    if series_error and not metrics.get('opend_server_ver'):
        try:
            ret, global_state = quote_ctx.get_global_state()
            if ret == RET_OK and isinstance(global_state, dict):
                metrics['opend_server_ver'] = global_state.get('server_ver')
        except Exception:
            pass

    return metrics


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
