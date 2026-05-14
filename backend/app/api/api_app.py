# -*- coding: utf-8 -*-

import logging
import time
from pathlib import Path

from flask import Flask, g, request, redirect, send_from_directory
from flask_cors import CORS

from app.api.auth_middleware import (
    AuthSessionExpiredError,
    add_httpx_timing_hooks,
    make_session_robust,
    normalize_auth_exception_response,
)
from app.api.market_data_api import register_market_data_api
from app.api.stock_analysis_api import register_investment_opportunities_api, register_stock_analysis_api
from app.api.trading_api import trading_bp
from app.db.database import StockDatabase
from app.utils.date_utils import TradingDateUtils

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s'
)
logging.getLogger('werkzeug').setLevel(logging.WARNING)
logging.getLogger('httpx').setLevel(logging.WARNING)
logging.getLogger('httpcore').setLevel(logging.WARNING)

logger = logging.getLogger('api')
frontend_dist = Path(__file__).resolve().parents[3] / 'frontend' / 'out'

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
CORS(app)

db = StockDatabase()
make_session_robust(db.client)
add_httpx_timing_hooks(db.client)
trading_date_utils = TradingDateUtils()


@app.before_request
def _start_timer():
    g.start_time = time.time()


@app.after_request
def _log_request(response):
    elapsed = time.time() - g.start_time
    logger.info(f"{request.method} {request.full_path.rstrip('?')} -> {response.status_code} ({elapsed:.3f}s)")
    return response


@app.errorhandler(AuthSessionExpiredError)
def _handle_auth_session_expired(error):
    response = normalize_auth_exception_response(error)
    if response is not None:
        return response
    return error


# 注册业务蓝图
app.register_blueprint(trading_bp)
register_stock_analysis_api(app)
register_investment_opportunities_api(app)
register_market_data_api(app, db=db, trading_date_utils=trading_date_utils)


@app.route('/')
def serve_root():
    return redirect('/en/')


@app.route('/<path:path>')
@app.route('/<path:path>/')
def serve_frontend(path: str):
    normalized_path = path.rstrip('/')
    asset_path = frontend_dist / normalized_path
    if asset_path.is_file():
        return send_from_directory(str(frontend_dist), normalized_path)

    html_path = frontend_dist / normalized_path / 'index.html'
    if html_path.is_file():
        return send_from_directory(str(frontend_dist), f'{normalized_path}/index.html')

    request_path = request.path.rstrip('/')
    locale_path = request_path.lstrip('/')
    locale_html_path = frontend_dist / locale_path / 'index.html'
    if locale_html_path.is_file():
        return send_from_directory(str(frontend_dist), f'{locale_path}/index.html')

    segments = [segment for segment in locale_path.split('/') if segment]
    if segments:
        locale_fallback = frontend_dist / segments[0] / 'index.html'
        if locale_fallback.is_file():
            return send_from_directory(str(frontend_dist), f'{segments[0]}/index.html')

    return send_from_directory(str(frontend_dist), 'index.html')


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
