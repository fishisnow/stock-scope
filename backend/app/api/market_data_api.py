# -*- coding: utf-8 -*-
"""
市场数据相关 API
包含交易日、富途统计与市场宽度接口
"""

import math
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from app.utils.futu_data import get_market_snapshots_by_futu_codes

market_data_bp = Blueprint('market_data', __name__)

_db = None
_trading_date_utils = None


def _safe_float(value, default=0.0):
    try:
        number = float(value)
        if math.isnan(number):
            return default
        return number
    except Exception:
        return default


@market_data_bp.route('/api/dates')
def get_available_dates():
    """获取可用统计日期（港股和A股最近30个交易日并集）"""
    try:
        now = datetime.now()
        before_open = now.hour < 9 or (now.hour == 9 and now.minute < 55)
        end_date = (now - timedelta(days=1)).strftime('%Y-%m-%d') if before_open else now.strftime('%Y-%m-%d')
        start_date = (now - timedelta(days=60)).strftime('%Y-%m-%d')

        cn_days = set(_trading_date_utils.get_trading_days_in_range(start_date, end_date, market="CN"))
        hk_days = set(_trading_date_utils.get_trading_days_in_range(start_date, end_date, market="HK"))
        all_days = sorted(cn_days | hk_days, reverse=True)[:30]

        return jsonify({'success': True, 'data': all_days})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@market_data_bp.route('/api/futu_data/<date>')
def get_futu_data(date):
    """获取指定日期的富途统计数据"""
    try:
        data = _db.get_statistics_by_date(date, 'futu')
        return jsonify({
            'success': True,
            'data': data.get('futu', {}),
            'date': date
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@market_data_bp.route('/api/market_breadth')
def get_market_breadth():
    """获取市场宽度数据（默认全部指数）"""
    try:
        limit = int(request.args.get('limit', 10))
        limit = max(1, min(limit, 30))
        breadth_type = request.args.get('breadth_type')
        sector = request.args.get('sector', '').strip() or None
        data = _db.get_market_breadth_records(limit=limit, breadth_type=breadth_type, sector=sector)
        return jsonify({
            'success': True,
            'data': data,
            'breadth_type': breadth_type or 'all',
            'sector': sector or 'all'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@market_data_bp.route('/api/market_breadth/industry_stocks')
def get_industry_stocks():
    """获取指定行业的A股当前详情（用于行业宽度点击联动）"""
    try:
        industry = request.args.get('industry', '').strip()
        if not industry:
            return jsonify({'success': False, 'error': '缺少参数: industry'}), 400

        stocks = _db.get_stock_basic_info_by_industry(industry=industry, market='A')
        if not stocks:
            return jsonify({
                'success': True,
                'data': {
                    'industry': industry,
                    'stocks': [],
                    'total_candidates': 0,
                    'selected_count': 0
                }
            })

        futu_codes = []
        stock_meta = {}
        for item in stocks:
            exchange = str(item.get('exchange', '')).strip()
            stock_code = str(item.get('stock_code', '')).strip()
            stock_name = str(item.get('stock_name', '')).strip()
            if not exchange or not stock_code or stock_name.endswith("退"):
                continue
            futu_code = f"{exchange}.{stock_code}"
            futu_codes.append(futu_code)
            stock_meta[futu_code] = item

        if not futu_codes:
            return jsonify({
                'success': True,
                'data': {
                    'industry': industry,
                    'stocks': [],
                    'total_candidates': len(stocks),
                    'selected_count': 0
                }
            })

        quote_df = get_market_snapshots_by_futu_codes(futu_codes, batch_size=400)
        if quote_df.empty:
            return jsonify({
                'success': True,
                'data': {
                    'industry': industry,
                    'stocks': [],
                    'total_candidates': len(stocks),
                    'selected_count': len(futu_codes)
                }
            })

        snapshot_by_code = {}
        for _, row in quote_df.iterrows():
            code = str(row.get('code', '')).strip()
            if code:
                snapshot_by_code[code] = row

        result_stocks = []
        for futu_code in futu_codes:
            row = snapshot_by_code.get(futu_code)
            if row is None:
                continue

            meta = stock_meta.get(futu_code, {})
            exchange = str(meta.get('exchange', '')).strip()
            if not exchange and '.' in futu_code:
                exchange = futu_code.split('.', 1)[0].strip()

            last_price = _safe_float(row.get('last_price'), 0.0)
            prev_close = _safe_float(row.get('prev_close_price'), 0.0)
            change_ratio = (last_price - prev_close) / prev_close * 100 if prev_close > 0 else 0.0

            result_stocks.append({
                'code': str(meta.get('stock_code', '')),
                'exchange': exchange,
                'name': str(meta.get('stock_name', '') or row.get('name', '')),
                'changeRatio': round(change_ratio, 2),
                'volume': _safe_float(row.get('volume'), 0.0),
                'amount': _safe_float(row.get('turnover'), 0.0),
                'pe': _safe_float(row.get('pe_ratio'), 0.0),
                'volumeRatio': _safe_float(row.get('volume_ratio'), 0.0),
                'turnoverRate': _safe_float(row.get('turnover_rate'), 0.0),
            })

        result_stocks.sort(key=lambda item: item.get('amount', 0), reverse=True)

        return jsonify({
            'success': True,
            'data': {
                'industry': industry,
                'stocks': result_stocks,
                'total_candidates': len(stocks),
                'selected_count': len(futu_codes)
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def register_market_data_api(app, db, trading_date_utils):
    """注册市场数据 API 蓝图并注入依赖"""
    global _db, _trading_date_utils
    _db = db
    _trading_date_utils = trading_date_utils
    app.register_blueprint(market_data_bp)
