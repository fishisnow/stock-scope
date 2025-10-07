# -*- coding: utf-8 -*-

from flask import Flask, render_template, request, jsonify
from datetime import datetime, timedelta
from db.database import StockDatabase
import json

app = Flask(__name__)
db = StockDatabase()

@app.route('/')
def index():
    """主页"""
    return render_template('index.html')

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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
