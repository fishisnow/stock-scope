# -*- coding: utf-8 -*-

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta
from db.database import StockDatabase
from api.auth_middleware import token_required, optional_token
from api.trading_api import trading_bp
import json

app = Flask(__name__)
# 配置 Flask JSON 输出中文字符不转义
app.config['JSON_AS_ASCII'] = False
# 配置上传文件大小限制（16MB）
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
CORS(app)  # 启用 CORS 支持
db = StockDatabase()

# 注册交易API蓝图
app.register_blueprint(trading_bp)

# 注意：现在使用 Supabase Auth
# 认证由前端 Supabase 客户端直接处理
# 后端只需要验证 JWT token


@app.route('/api/dates')
def get_available_dates():
    """获取可用的统计日期"""
    try:
        dates = db.get_available_dates(30)
        return jsonify({
            'success': True,
            'data': dates
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
