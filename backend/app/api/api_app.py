# -*- coding: utf-8 -*-

import logging
import time

from flask import Flask, g, request
from flask_cors import CORS

from app.api.auth_middleware import add_httpx_timing_hooks, make_session_robust
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


# 注册业务蓝图
app.register_blueprint(trading_bp)
register_stock_analysis_api(app)
register_investment_opportunities_api(app)
register_market_data_api(app, db=db, trading_date_utils=trading_date_utils)


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
