# -*- coding: utf-8 -*-
"""
富途牛牛交易历史记录 API
处理用户从富途牛牛导入的交易历史数据的导入、查询和分析
"""

from flask import Blueprint, request, jsonify
from app.api.auth_middleware import token_required
from decimal import Decimal
import pandas as pd
from io import BytesIO
from datetime import datetime
import re
import os
from supabase import create_client

# 创建蓝图
trading_bp = Blueprint('trading', __name__)

# Supabase 配置
supabase_url = os.environ.get('SUPABASE_URL')
supabase_anon_key = os.environ.get('SUPABASE_KEY')  # 使用 anon key，配合用户 token


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


def get_user_supabase_client():
    """
    创建带有用户认证信息的 Supabase 客户端
    从请求头中获取用户的 JWT token，传递给 Supabase
    这样 Supabase 就知道是哪个用户在操作，RLS 策略能正常工作
    """
    if not supabase_url or not supabase_anon_key:
        return None
    
    # 从请求头获取用户的 JWT token
    auth_header = request.headers.get('Authorization', '')
    user_token = auth_header.replace('Bearer ', '') if auth_header else None
    
    if not user_token:
        # 如果没有 token，返回普通客户端
        return create_client(supabase_url, supabase_anon_key)
    
    # 创建带有用户 token 的客户端
    # 这样 Supabase 就能识别用户，auth.uid() 会返回正确的用户 ID
    client = create_client(supabase_url, supabase_anon_key)
    # 设置用户 session
    client.auth.set_session(user_token, user_token)
    
    return client


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
        
        for idx, row in df.iterrows():
            try:
                # 跳过空行
                if pd.isna(row.get('direction')) or pd.isna(row.get('stock_code')):
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
                
                record = {
                    'user_id': user_id,
                    'direction': str(row.get('direction', '')).strip(),
                    'stock_code': str(row.get('stock_code', '')).strip(),
                    'stock_name': str(row.get('stock_name', '')).strip(),
                    'order_price': parse_number(row.get('order_price')),
                    'order_quantity': int(parse_number(row.get('order_quantity')) or 0),
                    'order_amount': parse_number(row.get('order_amount')),
                    'trade_status': str(row.get('trade_status', '')).strip() if pd.notna(row.get('trade_status')) else None,
                    'filled_quantity': int(filled_qty) if filled_qty else 0,
                    'filled_price': filled_price,
                    'filled_amount': parse_number(row.get('filled_amount')),
                    'order_time': parse_datetime(row.get('order_time')),
                    'filled_time': parse_datetime(row.get('filled_time')),
                    'total_fee': parse_number(row.get('total_fee')) or 0,
                    'remarks': str(row.get('remarks', '')).strip() if pd.notna(row.get('remarks')) else None,
                }
                
                # 只保留有实际成交数量的记录（包含全部成交和部分成交）
                # 过滤掉已撤单且无成交的记录
                if record['filled_quantity'] == 0:
                    continue
                
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
        
        user_supabase = get_user_supabase_client()
        if not user_supabase:
            return jsonify({
                'success': False,
                'error': '数据库连接失败'
            }), 500
        
        # 获取所有交易记录（只获取有实际成交的记录）
        result = user_supabase.table('futu_trading_records') \
            .select('*') \
            .eq('user_id', user_id) \
            .gt('filled_quantity', 0) \
            .execute()
        
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
        
        for record in records:
            code = record['stock_code']
            name = record['stock_name']
            
            if code not in stock_summary:
                stock_summary[code] = {
                    'stock_code': code,
                    'stock_name': name,
                    'total_bought': 0,        # 总买入数量
                    'total_sold': 0,          # 总卖出数量
                    'total_buy_amount': 0,    # 总买入金额
                    'total_sell_amount': 0,   # 总卖出金额
                    'total_fees': 0,          # 总费用
                    'trade_count': 0,         # 交易次数
                    'first_trade': None,      # 首次交易时间
                    'last_trade': None,       # 最后交易时间
                    'avg_buy_price': 0,       # 平均买入价
                    'avg_sell_price': 0,      # 平均卖出价
                }
            
            summary = stock_summary[code]
            filled_qty = record.get('filled_quantity') or 0
            filled_amount = record.get('filled_amount') or 0
            total_fee = record.get('total_fee') or 0
            filled_time = record.get('filled_time')
            
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
            # 计算平均价格
            if summary['total_bought'] > 0:
                summary['avg_buy_price'] = summary['total_buy_amount'] / summary['total_bought']
            if summary['total_sold'] > 0:
                summary['avg_sell_price'] = summary['total_sell_amount'] / summary['total_sold']
            
            # 当前持仓
            summary['current_holding'] = summary['total_bought'] - summary['total_sold']
            
            # 已实现盈亏 = 卖出金额 - 对应的买入成本 - 费用
            if summary['total_sold'] > 0 and summary['total_bought'] > 0:
                # 按卖出数量计算成本
                cost_basis = (summary['total_sell_amount'] / summary['avg_sell_price']) * summary['avg_buy_price'] if summary['avg_sell_price'] > 0 else 0
                summary['realized_profit'] = summary['total_sell_amount'] - cost_basis - summary['total_fees']
                summary['profit_rate'] = (summary['realized_profit'] / cost_basis * 100) if cost_basis > 0 else 0
            else:
                summary['realized_profit'] = -summary['total_fees']
                summary['profit_rate'] = 0
            
            total_invested += summary['total_buy_amount']
            total_returned += summary['total_sell_amount']
            total_fees += summary['total_fees']
            
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

