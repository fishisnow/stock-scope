# -*- coding: utf-8 -*-
"""
富途牛牛交易历史记录 API
处理用户从富途牛牛导入的交易历史数据的导入、查询和分析
"""

from flask import Blueprint, request, jsonify
from app.api.auth_middleware import token_required, get_user_supabase_client
from decimal import Decimal
import pandas as pd
from io import BytesIO
from datetime import datetime
import re
import os

# 创建蓝图
trading_bp = Blueprint('trading', __name__)


def parse_number(value):
    """解析数字，处理千分位逗号"""
    if pd.isna(value) or value == '' or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    # 移除千分位逗号
    value_str = str(value).replace(',', '').strip()
    if value_str == '':
        return None
    try:
        return float(value_str)
    except ValueError:
        return None


def parse_datetime(value):
    """解析日期时间"""
    if pd.isna(value) or value == '' or value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    value_str = str(value).strip()
    if value_str == '':
        return None
    
    # 处理带括号的时区信息，如 "2025/11/26 10:24:41 (美东)"
    # 移除括号及其内容
    value_str = re.sub(r'\s*\([^)]*\)\s*$', '', value_str)
    
    # 尝试多种日期格式
    formats = [
        '%Y/%m/%d %H:%M',
        '%Y-%m-%d %H:%M',
        '%Y/%m/%d %H:%M:%S',
        '%Y-%m-%d %H:%M:%S',
        '%Y/%m/%d',
        '%Y-%m-%d',
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(value_str, fmt)
            return dt.isoformat()
        except ValueError:
            continue
    
    return None


def parse_filled_info(filled_str):
    """解析成交信息，如 '200@12.035' """
    if pd.isna(filled_str) or filled_str == '' or filled_str is None:
        return None, None
    
    filled_str = str(filled_str).strip()
    match = re.match(r'(\d+)@([\d.]+)', filled_str)
    if match:
        return int(match.group(1)), float(match.group(2))
    return None, None


@trading_bp.route('/api/trading/upload', methods=['POST'])
@token_required
def upload_trading_records():
    """上传并解析交易记录Excel/CSV文件"""
    try:
        user = request.current_user
        user_id = user['id']
        
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': '请选择要上传的文件'
            }), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': '请选择要上传的文件'
            }), 400
        
        # 检查文件类型
        if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
            return jsonify({
                'success': False,
                'error': '请上传 Excel 或 CSV 文件 (.xlsx、.xls 或 .csv)'
            }), 400
        
        # 读取文件
        content = file.read()
        
        # 根据文件类型读取数据
        if file.filename.endswith('.csv'):
            # 读取CSV文件，尝试不同的编码
            try:
                df = pd.read_csv(BytesIO(content), encoding='utf-8')
            except UnicodeDecodeError:
                try:
                    df = pd.read_csv(BytesIO(content), encoding='gbk')
                except UnicodeDecodeError:
                    df = pd.read_csv(BytesIO(content), encoding='gb2312')
        else:
            # 读取Excel文件
            df = pd.read_excel(BytesIO(content))
        
        # 字段映射
        column_mapping = {
            '方向': 'direction',
            '代码': 'stock_code',
            '名称': 'stock_name',
            '币种': 'currency',
            '订单价格': 'order_price',
            '订单数量': 'order_quantity',
            '订单金额': 'order_amount',
            '交易状态': 'trade_status',
            '已成交@均价': 'filled_info',
            '下单时间': 'order_time',
            '成交数量': 'filled_quantity',
            '成交价格': 'filled_price',
            '成交金额': 'filled_amount',
            '成交时间': 'filled_time',
            '合计费用': 'total_fee',
            '备注': 'remarks',
        }
        
        # 重命名列
        df = df.rename(columns=column_mapping)
        
        records = []
        errors = []
        
        # 用于记录最后一笔订单的基本信息（处理分批成交）
        last_order_info = {}
        
        for idx, row in df.iterrows():
            try:
                # 检查是否有完整的订单信息
                has_order_info = pd.notna(row.get('direction')) and pd.notna(row.get('stock_code'))
                
                if has_order_info:
                    # 这是一笔新订单，记录其基本信息
                    # 处理股票代码：如果是纯数字（港股），去掉小数点
                    stock_code_raw = row.get('stock_code', '')
                    stock_code = str(stock_code_raw).strip()
                    # 如果是类似 "3690.0" 的格式，转换为整数字符串
                    try:
                        if '.' in stock_code and stock_code.replace('.', '').isdigit():
                            stock_code = str(int(float(stock_code)))
                    except (ValueError, AttributeError):
                        pass
                    
                    last_order_info = {
                        'direction': str(row.get('direction', '')).strip(),
                        'stock_code': stock_code,
                        'stock_name': str(row.get('stock_name', '')).strip(),
                        'currency': str(row.get('currency', '')).strip() if pd.notna(row.get('currency')) else None,
                        'order_price': parse_number(row.get('order_price')),
                        'order_quantity': int(parse_number(row.get('order_quantity')) or 0),
                        'order_amount': parse_number(row.get('order_amount')),
                        'trade_status': str(row.get('trade_status', '')).strip() if pd.notna(row.get('trade_status')) else None,
                        'order_time': parse_datetime(row.get('order_time')),
                        'remarks': str(row.get('remarks', '')).strip() if pd.notna(row.get('remarks')) else None,
                    }
                else:
                    # 这是分批成交的后续记录，使用上一笔订单的信息
                    if not last_order_info:
                        # 如果没有上一笔订单信息，跳过这一行
                        continue
                
                # 解析成交信息（如果有单独的列）
                filled_qty = parse_number(row.get('filled_quantity'))
                filled_price = parse_number(row.get('filled_price'))
                
                # 如果没有单独的成交数量/价格列，尝试从 '已成交@均价' 解析
                if (filled_qty is None or filled_price is None) and 'filled_info' in row:
                    parsed_qty, parsed_price = parse_filled_info(row.get('filled_info'))
                    if parsed_qty is not None:
                        filled_qty = parsed_qty
                    if parsed_price is not None:
                        filled_price = parsed_price
                
                # 只处理有成交数量的记录
                if not filled_qty or filled_qty == 0:
                    continue
                
                # 构建记录（使用当前订单信息或上一笔订单信息）
                record = {
                    'user_id': user_id,
                    'direction': last_order_info.get('direction', ''),
                    'stock_code': last_order_info.get('stock_code', ''),
                    'stock_name': last_order_info.get('stock_name', ''),
                    'currency': last_order_info.get('currency'),
                    'order_price': last_order_info.get('order_price'),
                    'order_quantity': last_order_info.get('order_quantity', 0),
                    'order_amount': last_order_info.get('order_amount'),
                    'trade_status': last_order_info.get('trade_status'),
                    'filled_quantity': int(filled_qty),
                    'filled_price': filled_price,
                    'filled_amount': parse_number(row.get('filled_amount')),
                    'order_time': last_order_info.get('order_time'),
                    'filled_time': parse_datetime(row.get('filled_time')),
                    'total_fee': parse_number(row.get('total_fee')) or 0,
                    'remarks': last_order_info.get('remarks'),
                }
                
                records.append(record)
                
            except Exception as e:
                errors.append(f"第 {idx + 2} 行解析错误: {str(e)}")
        
        if not records:
            return jsonify({
                'success': False,
                'error': '没有找到有效的交易记录',
                'parsing_errors': errors
            }), 400
        
        # 插入数据库（使用用户认证的客户端）
        user_supabase = get_user_supabase_client()
        if not user_supabase:
            return jsonify({
                'success': False,
                'error': '数据库连接失败'
            }), 500
        
        result = user_supabase.table('futu_trading_records').insert(records).execute()
        inserted_count = len(result.data)
        
        return jsonify({
            'success': True,
            'message': f'成功导入 {inserted_count} 条交易记录',
            'inserted_count': inserted_count,
            'parsing_errors': errors if errors else None
        })
        
    except Exception as e:
        print(f"❌ 上传交易记录失败: {e}")
        return jsonify({
            'success': False,
            'error': f'上传失败: {str(e)}'
        }), 500


@trading_bp.route('/api/trading/records', methods=['GET'])
@token_required
def get_trading_records():
    """获取用户的交易记录"""
    try:
        user = request.current_user
        user_id = user['id']
        
        # 可选的查询参数
        stock_code = request.args.get('stock_code')
        limit = request.args.get('limit', 100, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        user_supabase = get_user_supabase_client()
        if not user_supabase:
            return jsonify({
                'success': False,
                'error': '数据库连接失败'
            }), 500
        
        query = user_supabase.table('futu_trading_records').select('*').eq('user_id', user_id)
        
        if stock_code:
            query = query.eq('stock_code', stock_code)
        
        query = query.order('filled_time', desc=True).range(offset, offset + limit - 1)
        result = query.execute()
        
        return jsonify({
            'success': True,
            'data': result.data,
            'count': len(result.data)
        })
            
    except Exception as e:
        print(f"❌ 获取交易记录失败: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@trading_bp.route('/api/trading/summary', methods=['GET'])
@token_required
def get_trading_summary():
    """获取用户的交易汇总统计（按股票分组的盈亏排行）"""
    try:
        user = request.current_user
        user_id = user['id']
        
        # 获取时间过滤参数
        start_date = request.args.get('start_date')  # 格式: YYYY-MM-DD
        end_date = request.args.get('end_date')      # 格式: YYYY-MM-DD
        
        user_supabase = get_user_supabase_client()
        if not user_supabase:
            return jsonify({
                'success': False,
                'error': '数据库连接失败'
            }), 500
        
        # 获取所有交易记录（只获取有实际成交的记录）
        query = user_supabase.table('futu_trading_records') \
            .select('*') \
            .eq('user_id', user_id) \
            .gt('filled_quantity', 0)
        
        # 应用时间过滤
        if start_date:
            query = query.gte('filled_time', f'{start_date}T00:00:00')
        if end_date:
            query = query.lte('filled_time', f'{end_date}T23:59:59')
        
        result = query.execute()
        
        records = result.data
        
        if not records:
            return jsonify({
                'success': True,
                'data': [],
                'total_stats': {
                    'total_invested': 0,
                    'total_returned': 0,
                    'total_profit': 0,
                    'total_fees': 0,
                    'winning_stocks': 0,
                    'losing_stocks': 0
                }
            })
        
        # 按股票代码分组计算
        stock_summary = {}
        
        # 汇率常量：1 USD = 7.8 HKD
        HKD_TO_USD_RATE = 1 / 7.8
        
        for record in records:
            code = record['stock_code']
            name = record['stock_name']
            currency = record.get('currency', 'USD')  # 默认为 USD
            
            # 关键：确保同一股票代码只有一个汇总记录
            if code not in stock_summary:
                stock_summary[code] = {
                    'stock_code': code,
                    'stock_name': name,
                    'currency': currency,           # 记录原始货币
                    'total_bought': 0,              # 总买入数量
                    'total_sold': 0,                # 总卖出数量
                    'total_buy_amount': 0,          # 总买入金额（原始货币）
                    'total_sell_amount': 0,         # 总卖出金额（原始货币）
                    'total_fees': 0,                # 总费用（原始货币）
                    'trade_count': 0,               # 交易次数
                    'first_trade': None,            # 首次交易时间
                    'last_trade': None,             # 最后交易时间
                    'avg_buy_price': 0,             # 平均买入价（原始货币）
                    'avg_sell_price': 0,            # 平均卖出价（原始货币）
                }
            
            summary = stock_summary[code]
            filled_qty = record.get('filled_quantity') or 0
            filled_amount = record.get('filled_amount') or 0
            total_fee = record.get('total_fee') or 0
            filled_time = record.get('filled_time')
            
            # 不转换金额，保持原始货币
            if record['direction'] == '买入' and filled_qty > 0:
                summary['total_bought'] += filled_qty
                summary['total_buy_amount'] += filled_amount
            elif record['direction'] == '卖出' and filled_qty > 0:
                summary['total_sold'] += filled_qty
                summary['total_sell_amount'] += filled_amount
            
            summary['total_fees'] += total_fee
            summary['trade_count'] += 1
            
            if filled_time:
                if summary['first_trade'] is None or filled_time < summary['first_trade']:
                    summary['first_trade'] = filled_time
                if summary['last_trade'] is None or filled_time > summary['last_trade']:
                    summary['last_trade'] = filled_time
        
        # 计算每只股票的盈亏
        stock_list = []
        total_invested = 0
        total_returned = 0
        total_fees = 0
        winning_stocks = 0
        losing_stocks = 0
        
        for code, summary in stock_summary.items():
            # 计算平均价格（使用原始货币）
            if summary['total_bought'] > 0:
                summary['avg_buy_price'] = summary['total_buy_amount'] / summary['total_bought']
            if summary['total_sold'] > 0:
                summary['avg_sell_price'] = summary['total_sell_amount'] / summary['total_sold']
            
            # 当前持仓
            summary['current_holding'] = summary['total_bought'] - summary['total_sold']
            
            # 计算已实现盈亏（转换为美元用于排序和汇总）
            # 先转换所有金额为美元
            buy_amount_usd = summary['total_buy_amount']
            sell_amount_usd = summary['total_sell_amount']
            fees_usd = summary['total_fees']
            
            if summary['currency'] == 'HKD':
                buy_amount_usd = buy_amount_usd * HKD_TO_USD_RATE
                sell_amount_usd = sell_amount_usd * HKD_TO_USD_RATE
                fees_usd = fees_usd * HKD_TO_USD_RATE
            
            # 已实现盈亏（美元）= 卖出金额 - 对应的买入成本 - 费用
            if summary['total_sold'] > 0 and summary['total_bought'] > 0:
                # 按卖出数量计算成本
                avg_sell_price_usd = sell_amount_usd / summary['total_sold'] if summary['total_sold'] > 0 else 0
                avg_buy_price_usd = buy_amount_usd / summary['total_bought'] if summary['total_bought'] > 0 else 0
                cost_basis = summary['total_sold'] * avg_buy_price_usd
                summary['realized_profit'] = sell_amount_usd - cost_basis - fees_usd
                summary['profit_rate'] = (summary['realized_profit'] / cost_basis * 100) if cost_basis > 0 else 0
            else:
                summary['realized_profit'] = -fees_usd
                summary['profit_rate'] = 0
            
            total_invested += buy_amount_usd
            total_returned += sell_amount_usd
            total_fees += fees_usd
            
            if summary['realized_profit'] > 0:
                winning_stocks += 1
            elif summary['realized_profit'] < 0:
                losing_stocks += 1
            
            stock_list.append(summary)
        
        # 按盈亏排序
        stock_list.sort(key=lambda x: x['realized_profit'], reverse=True)
        
        return jsonify({
            'success': True,
            'data': stock_list,
            'total_stats': {
                'total_invested': total_invested,
                'total_returned': total_returned,
                'total_profit': total_returned - total_invested - total_fees,
                'total_fees': total_fees,
                'winning_stocks': winning_stocks,
                'losing_stocks': losing_stocks,
                'total_stocks': len(stock_list)
            }
        })
        
    except Exception as e:
        print(f"❌ 获取交易汇总失败: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@trading_bp.route('/api/trading/stock/<stock_code>', methods=['GET'])
@token_required
def get_stock_trades(stock_code):
    """获取指定股票的所有交易记录"""
    try:
        user = request.current_user
        user_id = user['id']
        
        user_supabase = get_user_supabase_client()
        if not user_supabase:
            return jsonify({
                'success': False,
                'error': '数据库连接失败'
            }), 500
        
        result = user_supabase.table('futu_trading_records') \
            .select('*') \
            .eq('user_id', user_id) \
            .eq('stock_code', stock_code) \
            .gt('filled_quantity', 0) \
            .order('filled_time', desc=False) \
            .execute()
        
        return jsonify({
            'success': True,
            'data': result.data,
            'stock_code': stock_code
        })
        
    except Exception as e:
        print(f"❌ 获取股票交易记录失败: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@trading_bp.route('/api/trading/clear', methods=['DELETE'])
@token_required
def clear_trading_records():
    """清空用户的所有交易记录"""
    try:
        user = request.current_user
        user_id = user['id']
        
        user_supabase = get_user_supabase_client()
        if not user_supabase:
            return jsonify({
                'success': False,
                'error': '数据库连接失败'
            }), 500
        
        result = user_supabase.table('futu_trading_records') \
            .delete() \
            .eq('user_id', user_id) \
            .execute()
        
        return jsonify({
            'success': True,
            'message': '已清空所有交易记录'
        })
        
    except Exception as e:
        print(f"❌ 清空交易记录失败: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

