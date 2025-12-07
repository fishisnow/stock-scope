# -*- coding: utf-8 -*-

"""
Supabase Auth 中间件
用于验证 Supabase Auth 的 JWT token
"""

from flask import request, jsonify
from functools import wraps
from db.database import db as stock_db
import os


def token_required(f):
    """
    装饰器：验证 Supabase Auth JWT token
    使用方法：
        @app.route('/protected')
        @token_required
        def protected_route():
            user = request.current_user
            return jsonify({'user_id': user['id'], 'email': user['email']})
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return jsonify({
                'success': False,
                'error': '缺少认证令牌'
            }), 401
        
        # 提取 token
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return jsonify({
                'success': False,
                'error': '令牌格式错误'
            }), 401
        
        token = parts[1]
        
        try:
            # 使用 Supabase client 验证 token
            user_response = stock_db.client.auth.get_user(token)
            
            if not user_response or not user_response.user:
                return jsonify({
                    'success': False,
                    'error': '无效或过期的令牌'
                }), 401
            
            user = user_response.user
            
            # 将用户信息添加到请求上下文
            request.current_user = {
                'id': user.id,
                'email': user.email,
                'user_metadata': user.user_metadata,
                'created_at': user.created_at
            }
            
            return f(*args, **kwargs)
            
        except Exception as e:
            print(f"❌ Token 验证失败: {e}")
            return jsonify({
                'success': False,
                'error': '令牌验证失败'
            }), 401
    
    return decorated


def optional_token(f):
    """
    装饰器：可选的 token 验证
    如果提供了有效 token，则设置 request.current_user
    如果没有 token 或 token 无效，则继续执行但 request.current_user 为 None
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        request.current_user = None
        
        if auth_header:
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == 'bearer':
                token = parts[1]
                try:
                    user_response = stock_db.client.auth.get_user(token)
                    if user_response and user_response.user:
                        user = user_response.user
                        request.current_user = {
                            'id': user.id,
                            'email': user.email,
                            'user_metadata': user.user_metadata,
                            'created_at': user.created_at
                        }
                except Exception:
                    pass  # 忽略错误，继续执行
        
        return f(*args, **kwargs)
    
    return decorated

