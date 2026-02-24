# -*- coding: utf-8 -*-

import logging
import math
import time
from datetime import datetime, timedelta

from flask import Flask, g, request, jsonify
from flask_cors import CORS

from api.auth_middleware import token_required, optional_token, add_httpx_timing_hooks, make_session_robust
from api.stock_analysis_api import register_stock_analysis_api, register_investment_opportunities_api
from api.trading_api import trading_bp
from db.database import StockDatabase
from utils.date_utils import TradingDateUtils
from utils.futu_data import get_market_snapshots_by_futu_codes

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s'
)
# 用自定义的带耗时日志替代默认输出
logging.getLogger('werkzeug').setLevel(logging.WARNING)
logging.getLogger('httpx').setLevel(logging.WARNING)
logging.getLogger('httpcore').setLevel(logging.WARNING)

logger = logging.getLogger('api')

app = Flask(__name__)
# 配置 Flask JSON 输出中文字符不转义
app.config['JSON_AS_ASCII'] = False
# 配置上传文件大小限制（16MB）
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
CORS(app)
db = StockDatabase()
make_session_robust(db.client)
add_httpx_timing_hooks(db.client)
trading_date_utils = TradingDateUtils()


def _safe_float(value, default=0.0):
    try:
        number = float(value)
        if math.isnan(number):
            return default
        return number
    except Exception:
        return default


@app.before_request
def _start_timer():
    g.start_time = time.time()


@app.after_request
def _log_request(response):
    elapsed = time.time() - g.start_time
    logger.info(f"{request.method} {request.full_path.rstrip('?')} → {response.status_code} ({elapsed:.3f}s)")
    return response


# 注册交易API蓝图
app.register_blueprint(trading_bp)

# 注册股票分析API
register_stock_analysis_api(app)

# 注册投资机会记录API
register_investment_opportunities_api(app)

# 注意：现在使用 Supabase Auth
# 认证由前端 Supabase 客户端直接处理
# 后端只需要验证 JWT token


@app.route('/api/dates')
def get_available_dates():
    """获取可用的统计日期（港股和A股最近30个交易日的并集）"""
    try:
        now = datetime.now()
        # 9点30分之前排除当天（尚未开盘，无数据）
        before_open = now.hour < 9 or (now.hour == 9 and now.minute < 55)
        end_date = (now - timedelta(days=1)).strftime('%Y-%m-%d') if before_open else now.strftime('%Y-%m-%d')
        # 往前推60个自然日，确保覆盖至少30个交易日
        start_date = (now - timedelta(days=60)).strftime('%Y-%m-%d')

        # 分别获取A股和港股的交易日
        cn_days = set(trading_date_utils.get_trading_days_in_range(start_date, end_date, market="CN"))
        hk_days = set(trading_date_utils.get_trading_days_in_range(start_date, end_date, market="HK"))

        # 取并集，降序排列，取最近30天
        all_days = sorted(cn_days | hk_days, reverse=True)[:30]

        return jsonify({
            'success': True,
            'data': all_days
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/futu_data/<date>')
def get_futu_data(date):
    """获取指定日期的富途统计数据"""
    try:
        # 只获取富途数据
        data = db.get_statistics_by_date(date, 'futu')
        return jsonify({
            'success': True,
            'data': data.get('futu', {}),
            'date': date
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/market_breadth')
def get_market_breadth():
    """获取市场宽度数据（默认全部指数）"""
    try:
        limit = int(request.args.get('limit', 30))
        breadth_type = request.args.get('breadth_type')
        data = db.get_market_breadth_records(limit=limit, breadth_type=breadth_type)
        return jsonify({
            'success': True,
            'data': data,
            'breadth_type': breadth_type or 'all'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/market_breadth/industry_stocks')
def get_industry_stocks():
    """获取指定行业的A股当前详情（用于行业宽度点击联动）"""
    try:
        industry = request.args.get('industry', '').strip()

        if not industry:
            return jsonify({
                'success': False,
                'error': '缺少参数: industry'
            }), 400

        stocks = db.get_stock_basic_info_by_industry(industry=industry, market='A')
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
            if not exchange or not stock_code:
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
            last_price = _safe_float(row.get('last_price'), 0.0)
            prev_close = _safe_float(row.get('prev_close_price'), 0.0)
            if prev_close > 0:
                change_ratio = (last_price - prev_close) / prev_close * 100
            else:
                change_ratio = 0.0

            result_stocks.append({
                'code': str(meta.get('stock_code', '')),
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
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================
# 认证相关路由示例
# ============================================

@app.route('/api/auth/me', methods=['GET'])
@token_required
def get_current_user():
    """获取当前登录用户信息（需要认证）"""
    try:
        user = request.current_user
        return jsonify({
            'success': True,
            'data': {
                'user': user
            }
        }), 200
    except Exception as e:
        print(f"❌ 获取用户信息失败: {e}")
        return jsonify({
            'success': False,
            'error': '服务器错误，请稍后重试'
        }), 500


@app.route('/api/protected-example', methods=['GET'])
@token_required
def protected_example():
    """受保护路由示例（需要认证）"""
    user = request.current_user
    return jsonify({
        'success': True,
        'message': f'你好 {user["email"]}，这是一个受保护的路由',
        'user_id': user['id']
    })


@app.route('/api/optional-auth-example', methods=['GET'])
@optional_token
def optional_auth_example():
    """可选认证路由示例（不强制要求认证）"""
    user = request.current_user
    if user:
        message = f'你好 {user["email"]}，你已登录'
    else:
        message = '你好游客，你未登录'
    
    return jsonify({
        'success': True,
        'message': message,
        'authenticated': user is not None
    })


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
