# -*- coding: utf-8 -*-

"""
Supabase Auth 中间件
用于验证 Supabase Auth 的 JWT token
"""

import json
import logging
import os
import time
from functools import wraps

import jwt as pyjwt
from jwt import PyJWK
from flask import request, jsonify
from supabase import create_client

from app.db.database import db as stock_db

logger = logging.getLogger(__name__)


# ============================================
# httpx 请求耗时日志 hook
# ============================================

def _on_httpx_request(req):
    req.extensions['_timing_start'] = time.time()


def _on_httpx_response(resp):
    start = resp.request.extensions.get('_timing_start')
    elapsed_str = f"{time.time() - start:.3f}s" if start else "?"
    logger.info(f"HTTP {resp.request.method} {resp.request.url} → {resp.status_code} ({elapsed_str})")


def add_httpx_timing_hooks(supabase_client):
    """为 Supabase 客户端的 httpx session 添加请求耗时日志"""
    try:
        session = supabase_client.postgrest.session
        hooks = session.event_hooks
        hooks.setdefault('request', []).append(_on_httpx_request)
        hooks.setdefault('response', []).append(_on_httpx_response)
        session.event_hooks = hooks
    except Exception as e:
        logger.warning(f"Failed to add httpx timing hooks: {e}")


# ============================================
# 本地 JWT 验证（替代远程 auth.get_user 调用）
# ============================================

_signing_key = None
_signing_algorithm = None


def _get_signing_key():
    """
    解析 SUPABASE_JWT_SECRET 环境变量，自动适配两种格式：
      - 旧版 HS256：纯字符串密钥
      - 新版 ES256：JWK JSON 格式公钥
    """
    global _signing_key, _signing_algorithm
    if _signing_key is not None:
        return _signing_key, _signing_algorithm

    raw = os.environ.get('SUPABASE_JWT_SECRET', '').strip()
    if not raw:
        return None, None

    try:
        jwk_dict = json.loads(raw)
        _signing_algorithm = jwk_dict.get('alg', 'ES256')
        _signing_key = PyJWK.from_dict(jwk_dict).key
        logger.info(f"JWT signing key loaded: algorithm={_signing_algorithm} (JWK)")
    except (json.JSONDecodeError, ValueError):
        _signing_algorithm = 'HS256'
        _signing_key = raw
        logger.info("JWT signing key loaded: algorithm=HS256 (symmetric secret)")

    return _signing_key, _signing_algorithm


def _verify_jwt_locally(token: str) -> dict:
    """
    本地验证 Supabase JWT token，避免远程 HTTP 调用。

    支持两种密钥格式（通过 SUPABASE_JWT_SECRET 环境变量配置）：
      - HS256 对称密钥：直接填入 JWT Secret 字符串
      - ES256 非对称密钥：填入 JWK JSON（Supabase Dashboard > Settings > API > JWT Public Key）
    """
    key, algorithm = _get_signing_key()
    if key is None:
        return None

    return pyjwt.decode(
        token,
        key,
        algorithms=[algorithm],
        audience="authenticated",
    )


def _extract_user_from_jwt(payload: dict) -> dict:
    """从 JWT payload 中提取用户信息，与原 auth.get_user 返回格式保持一致"""
    return {
        'id': payload.get('sub'),
        'email': payload.get('email', ''),
        'user_metadata': payload.get('user_metadata', {}),
        'created_at': payload.get('iat'),
    }


def _verify_token_remote(token: str) -> dict:
    """回退方案：通过 Supabase API 远程验证 token"""
    user_response = stock_db.client.auth.get_user(token)
    if not user_response or not user_response.user:
        return None
    user = user_response.user
    return {
        'id': user.id,
        'email': user.email,
        'user_metadata': user.user_metadata,
        'created_at': user.created_at,
    }


def _authenticate(token: str) -> dict:
    """
    验证 token 并返回用户信息。
    优先本地验证，若未配置 JWT_SECRET 则回退到远程验证。
    """
    payload = _verify_jwt_locally(token)
    if payload is not None:
        return _extract_user_from_jwt(payload)

    logger.warning("SUPABASE_JWT_SECRET not configured, falling back to remote auth.get_user")
    return _verify_token_remote(token)


# ============================================
# Flask 装饰器
# ============================================

def token_required(f):
    """装饰器：验证 Supabase Auth JWT token（必须）"""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')

        if not auth_header:
            return jsonify({'success': False, 'error': '缺少认证令牌'}), 401

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return jsonify({'success': False, 'error': '令牌格式错误'}), 401

        token = parts[1]

        try:
            user = _authenticate(token)
            if not user:
                return jsonify({'success': False, 'error': '无效或过期的令牌'}), 401

            request.current_user = user
            return f(*args, **kwargs)

        except pyjwt.ExpiredSignatureError:
            return jsonify({'success': False, 'error': '令牌已过期'}), 401
        except pyjwt.InvalidTokenError as e:
            logger.warning(f"JWT validation failed: {e}")
            return jsonify({'success': False, 'error': '令牌验证失败'}), 401
        except Exception as e:
            logger.error(f"Token verification error: {e}")
            return jsonify({'success': False, 'error': '令牌验证失败'}), 401

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
                    user = _authenticate(token)
                    if user:
                        request.current_user = user
                except Exception:
                    pass

        return f(*args, **kwargs)

    return decorated


# ============================================
# 复用 Supabase 客户端（避免每次请求都 create_client）
# ============================================

_cached_client = None


def get_user_supabase_client():
    """
    获取带有用户认证信息的 Supabase 客户端。
    复用同一个客户端实例，仅更新 Authorization header。
    """
    global _cached_client

    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_KEY')

    if not supabase_url or not supabase_key:
        return None

    if _cached_client is None:
        _cached_client = create_client(supabase_url, supabase_key)
        add_httpx_timing_hooks(_cached_client)
        logger.info("Supabase user client initialized (cached)")

    auth_header = request.headers.get('Authorization', '')
    user_token = auth_header.replace('Bearer ', '') if auth_header else None

    token_for_header = user_token if user_token else supabase_key
    _cached_client.postgrest.session.headers.update({
        "Authorization": f"Bearer {token_for_header}",
    })

    return _cached_client
