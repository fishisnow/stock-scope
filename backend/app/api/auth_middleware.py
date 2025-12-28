# -*- coding: utf-8 -*-

"""
Supabase Auth 中间件
用于验证 Supabase Auth 的 JWT token
"""

from flask import request, jsonify
from functools import wraps
from app.db.database import db as stock_db
from supabase import create_client
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


def get_user_supabase_client():
    """
    创建带有用户认证信息的 Supabase 客户端
    从请求头中获取用户的 JWT token，传递给 Supabase
    这样 Supabase 就知道是哪个用户在操作，RLS 策略能正常工作

    返回:
        supabase.Client: 配置了用户认证的Supabase客户端
    """
    # Supabase 配置
    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_KEY')  # 使用 anon key，配合用户 token

    if not supabase_url or not supabase_key:
        return None

    # 从请求头获取用户的 JWT token
    auth_header = request.headers.get('Authorization', '')
    user_token = auth_header.replace('Bearer ', '') if auth_header else None

    if not user_token:
        # 如果没有 token，返回普通客户端
        return create_client(supabase_url, supabase_key)

    # 创建带有用户 token 的客户端
    # 这样 Supabase 就能识别用户，auth.uid() 会返回正确的用户 ID
    client = create_client(supabase_url, supabase_key)
    # 设置用户 session
    client.auth.set_session(user_token, user_token)

    return client

