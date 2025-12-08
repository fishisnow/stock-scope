from futu import *
from datetime import date
import pandas as pd
from typing import Dict, List
import os

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
    ret_sub, err_message = quote_context.subscribe(code_list, [SubType.QUOTE], subscribe_push=False)
    if ret_sub == RET_OK:
        ret, data = quote_context.get_market_snapshot(code_list)
        if ret == RET_OK:
            return data
        else:
            print('error:', data)
            return pd.DataFrame()
    else:
        print('subscription failed', err_message)
        return pd.DataFrame()


def get_stock_data(plate_code: str) -> Dict[str, List[Dict]]:
    """
    获取股票数据，包括涨幅和成交额排名
    :param plate_code: 板块代码
    :return: 包含涨幅和成交额排名的字典
    """
    try:
        # 创建行情上下文
        # mac Docker 容器内访问宿主机使用 host.docker.internal
        futu_host = os.getenv('FUTU_HOST', '127.0.0.1')
        futu_port = int(os.getenv('FUTU_PORT', '11111'))
        quote_context = OpenQuoteContext(host=futu_host, port=futu_port)
        
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
        
        # 关闭行情上下文
        quote_context.close()
        
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
