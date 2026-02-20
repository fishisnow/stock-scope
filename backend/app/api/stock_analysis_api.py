"""
股票分析API端点
提供基于搜索和AI的股票投资机会分析接口
"""
import logging

from flask import Blueprint, request, jsonify
from app.api.auth_middleware import token_required, optional_token, get_user_supabase_client
import os
import sys
from dotenv import load_dotenv
from datetime import datetime
import re

logger = logging.getLogger(__name__)

# Add the backend directory to Python path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import db
from app.search_engine import (
    BochaSearchEngine,
    OpenAIAnalyzer,
    DeepSeekAnalyzer,
    StockAnalysisWorkflow
)
from app.utils.futu_data import get_stock_current_price, get_stock_history_kline

# 加载环境变量
load_dotenv()

# 创建Blueprint
stock_analysis_bp = Blueprint('stock_analysis', __name__, url_prefix='/api/stock-analysis')

# 初始化组件（单例模式）
_search_engine = None
_ai_analyzer = None
_workflow = None


def get_workflow() -> StockAnalysisWorkflow:
    """获取工作流实例（单例）"""
    global _search_engine, _ai_analyzer, _workflow
    
    if _workflow is None:
        # 初始化搜索引擎
        bocha_api_key = os.getenv("BOCHA_API_KEY")
        if not bocha_api_key:
            raise ValueError("未配置BOCHA_API_KEY环境变量")
        
        _search_engine = BochaSearchEngine(api_key=bocha_api_key)
        
        # 初始化AI分析器（优先使用DeepSeek，成本更低）
        deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")
        openai_api_key = os.getenv("OPENAI_API_KEY")
        
        if deepseek_api_key:
            _ai_analyzer = DeepSeekAnalyzer(
                api_key=deepseek_api_key,
                model=os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
            )
        elif openai_api_key:
            _ai_analyzer = OpenAIAnalyzer(
                api_key=openai_api_key,
                model=os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
            )
        else:
            raise ValueError("未配置AI API密钥（DEEPSEEK_API_KEY或OPENAI_API_KEY）")
        
        # 创建工作流
        _workflow = StockAnalysisWorkflow(
            search_engine=_search_engine,
            ai_analyzer=_ai_analyzer
        )
    
    return _workflow


@stock_analysis_bp.route('/analyze', methods=['POST'])
def analyze_stock():
    """
    分析单只股票的上涨原因和投资机会
    
    请求体:
    {
        "stock_name": "雅克科技",
        "date": "2024-10-13",  // 可选，默认今天
        "search_freshness": "oneDay",  // 可选，默认oneDay
        "search_count": 10  // 可选，默认10
    }
    
    响应:
    {
        "success": true,
        "data": {
            "search_result": {...},
            "analysis": {...},
            "metadata": {...}
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'stock_name' not in data:
            return jsonify({
                "success": False,
                "error": "缺少必需参数: stock_name"
            }), 400
        
        stock_name = data['stock_name']
        date = data.get('date')
        search_freshness = data.get('search_freshness', 'oneDay')
        search_count = data.get('search_count', 10)
        
        # 获取工作流并执行分析
        workflow = get_workflow()
        result = workflow.analyze_stock_rise(
            stock_name=stock_name,
            date=date,
            search_freshness=search_freshness,
            search_count=search_count
        )
        
        return jsonify({
            "success": True,
            "data": result
        })
        
    except ValueError as e:
        return jsonify({
            "success": False,
            "error": f"配置错误: {str(e)}"
        }), 500
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"分析失败: {str(e)}"
        }), 500


@stock_analysis_bp.route('/batch-analyze', methods=['POST'])
def batch_analyze_stocks():
    """
    批量分析多只股票
    
    请求体:
    {
        "stock_names": ["雅克科技", "宁德时代", "比亚迪"],
        "date": "2024-10-13",  // 可选
        "search_freshness": "oneDay"  // 可选
    }
    
    响应:
    {
        "success": true,
        "data": {
            "雅克科技": {...},
            "宁德时代": {...},
            "比亚迪": {...}
        },
        "summary": {
            "total": 3,
            "success": 2,
            "failed": 1
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'stock_names' not in data:
            return jsonify({
                "success": False,
                "error": "缺少必需参数: stock_names"
            }), 400
        
        stock_names = data['stock_names']
        if not isinstance(stock_names, list) or len(stock_names) == 0:
            return jsonify({
                "success": False,
                "error": "stock_names必须是非空数组"
            }), 400
        
        date = data.get('date')
        search_freshness = data.get('search_freshness', 'oneDay')
        
        # 获取工作流并执行批量分析
        workflow = get_workflow()
        results = workflow.batch_analyze_stocks(
            stock_names=stock_names,
            date=date,
            search_freshness=search_freshness
        )
        
        # 统计成功和失败数量
        success_count = sum(1 for r in results.values() if 'error' not in r)
        failed_count = len(results) - success_count
        
        return jsonify({
            "success": True,
            "data": results,
            "summary": {
                "total": len(results),
                "success": success_count,
                "failed": failed_count
            }
        })
        
    except ValueError as e:
        return jsonify({
            "success": False,
            "error": f"配置错误: {str(e)}"
        }), 500
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"批量分析失败: {str(e)}"
        }), 500


@stock_analysis_bp.route('/health', methods=['GET'])
def health_check():
    """
    健康检查端点
    
    响应:
    {
        "status": "ok",
        "search_engine": "configured",
        "ai_analyzer": "configured"
    }
    """
    try:
        # 检查API密钥配置
        bocha_configured = bool(os.getenv("BOCHA_API_KEY"))
        ai_configured = bool(os.getenv("DEEPSEEK_API_KEY") or os.getenv("OPENAI_API_KEY"))
        
        return jsonify({
            "status": "ok" if (bocha_configured and ai_configured) else "degraded",
            "search_engine": "configured" if bocha_configured else "not_configured",
            "ai_analyzer": "configured" if ai_configured else "not_configured"
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


# ============================================
# 股票搜索API - 用于投资机会记录器
# ============================================

@stock_analysis_bp.route('/search-stocks', methods=['GET'])
def search_stocks():
    """
    根据股票名称或代码搜索股票信息

    查询参数:
    - query: 搜索关键词（股票名称或代码）
    - market: 市场筛选 ('A' 或 'HK'，可选)

    响应:
    {
        "success": true,
        "data": [
            {
                "code": "000001",
                "name": "平安银行",
                "market": "A",
                "exchange": "SZ"
            }
        ]
    }
    """
    try:
        query = request.args.get('query', '').strip()
        market_filter = request.args.get('market', '').upper()

        if not query:
            return jsonify({
                "success": False,
                "error": "缺少搜索关键词参数: query"
            }), 400

        # 从 stock_basic_info 表中搜索匹配的股票
        # 支持按股票名称和股票代码搜索
        all_results = []
        seen_codes = set()

        # 判断 query 是否为纯数字（可能是股票代码）
        is_numeric = re.match(r'^\d+$', query)
        
        # 搜索股票名称
        name_query = db.client.table('stock_basic_info').select(
            'stock_code, stock_name, market, exchange'
        ).ilike('stock_name', f'{query}%')
        
        if market_filter in ['A', 'HK']:
            name_query = name_query.eq('market', market_filter)
        
        name_response = name_query.limit(20).execute()
        
        for row in name_response.data:
            key = f"{row['stock_code']}_{row['market']}"
            if key not in seen_codes:
                seen_codes.add(key)
                all_results.append({
                    'code': row['stock_code'],
                    'name': row['stock_name'],
                    'market': row['market'],
                    'exchange': row['exchange']
                })

        # 如果是纯数字，也搜索股票代码
        if is_numeric:
            code_query = db.client.table('stock_basic_info').select(
                'stock_code, stock_name, market, exchange'
            ).ilike('stock_code', f'%{query}%')
            
            if market_filter in ['A', 'HK']:
                code_query = code_query.eq('market', market_filter)
            
            code_response = code_query.limit(20).execute()
            
            for row in code_response.data:
                key = f"{row['stock_code']}_{row['market']}"
                if key not in seen_codes:
                    seen_codes.add(key)
                    all_results.append({
                        'code': row['stock_code'],
                        'name': row['stock_name'],
                        'market': row['market'],
                        'exchange': row['exchange']
                    })

        # 限制返回结果数量
        results = all_results[:10]

        return jsonify({
            "success": True,
            "data": results
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"搜索股票失败: {str(e)}"
        }), 500

@stock_analysis_bp.route('/get-stock-price', methods=['GET'])
def get_stock_price():
    """
    获取指定股票的当前价格信息

    查询参数:
    - code: 股票代码
    - market: 市场 ('A' 或 'HK')

    响应:
    {
        "success": true,
        "data": {
            "code": "000001",
            "name": "平安银行",
            "current_price": 10.5,
            "change_ratio": 2.5,
            "volume": 1000000,
            "amount": 10500000,
            "open_price": 10.0,
            "high_price": 10.8,
            "low_price": 9.9,
            "prev_close_price": 10.2
        }
    }
    """
    try:
        code = request.args.get('code', '').strip()
        market = request.args.get('market', '').upper()

        if not code or market not in ['A', 'HK']:
            return jsonify({
                "success": False,
                "error": "缺少必需参数: code 或 market无效"
            }), 400

        # 使用富途API获取实时价格信息
        result = get_stock_current_price(code, market)

        return jsonify({
            "success": True,
            "data": result
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"获取股票价格失败: {str(e)}"
        }), 500


@stock_analysis_bp.route('/kline-history', methods=['GET'])
def get_kline_history():
    """
    获取指定股票的历史K线数据（默认日K）
    
    查询参数:
    - code: 股票代码
    - market: 市场 ('A' 或 'HK')
    - start: 开始日期 'YYYY-MM-DD'
    - end: 结束日期 'YYYY-MM-DD'
    - max_count: 最大返回条数（可选，默认1000）
    - ktype: K线类型（K_RT, K_DAY, K_WEEK, K_MON, K_QUARTER, K_YEAR）
    
    响应:
    {
        "success": true,
        "data": [
            {
                "date": "2024-01-01",
                "open": 10.0,
                "close": 10.5,
                "high": 10.8,
                "low": 9.9,
                "volume": 1000000
            }
        ]
    }
    """
    try:
        code = request.args.get('code', '').strip()
        market = request.args.get('market', '').upper()
        start = request.args.get('start', '').strip()
        end = request.args.get('end', '').strip()
        max_count = request.args.get('max_count', '1000').strip()
        ktype = request.args.get('ktype', 'K_DAY').strip().upper()
        
        if not code or market not in ['A', 'HK'] or not start or not end:
            return jsonify({
                "success": False,
                "error": "缺少必需参数: code, market, start 或 end"
            }), 400
        
        try:
            max_count = int(max_count)
        except ValueError:
            max_count = 1000
        
        result = get_stock_history_kline(
            code=code,
            market=market,
            start=start,
            end=end,
            max_count=max_count,
            ktype=ktype
        )
        
        return jsonify({
            "success": True,
            "data": result
        })
    except Exception as e:
        logging.error(f"get_kline_history error:{e}")
        return jsonify({
            "success": False,
            "error": f"获取K线历史数据失败: {str(e)}"
        }), 500

# ============================================
# 投资机会记录API
# ============================================

investment_opportunities_bp = Blueprint('investment_opportunities', __name__, url_prefix='/api/investment-opportunities')

def hide_opportunity_info(opportunity: dict) -> dict:
    """
    对投资机会进行信息隐藏处理（用于未登录用户查看非最新记录）
    
    :param opportunity: 投资机会数据字典
    :return: 隐藏敏感信息后的投资机会数据
    """
    hidden_opportunity = opportunity.copy()
    # 只保留标题和标签来吸引用户
    # 隐藏摘要、来源URL
    hidden_opportunity['summary'] = None
    hidden_opportunity['source_url'] = None
    # 保留基本信息：id, core_idea, trigger_words, recorded_at, created_at, updated_at
    return hidden_opportunity


def enrich_stock_with_price_change(stock: dict) -> dict:
    """
    为股票数据添加最新价格和涨幅信息
    
    :param stock: 股票数据字典，包含 stock_code, market, current_price
    :return: 添加了 latest_price 和 price_change_ratio 的股票数据
    """
    recorded_price = stock.get('current_price')
    if recorded_price is not None and recorded_price > 0:
        try:
            # 获取当前最新股价
            current_price_info = get_stock_current_price(
                code=stock['stock_code'],
                market=stock['market']
            )
            current_price = current_price_info.get('current_price')
            
            if current_price is not None and current_price > 0:
                # 计算距今涨幅 = (当前股价 - 录入时股价) / 录入时股价 * 100
                price_change_ratio = ((current_price - recorded_price) / recorded_price) * 100
                stock['latest_price'] = current_price
                stock['price_change_ratio'] = round(price_change_ratio, 2)
            else:
                stock['latest_price'] = None
                stock['price_change_ratio'] = None
        except Exception as e:
            # 如果获取失败，不影响其他股票
            print(f"获取股票 {stock['stock_code']} 最新价格失败: {str(e)}")
            stock['latest_price'] = None
            stock['price_change_ratio'] = None
    else:
        stock['latest_price'] = None
        stock['price_change_ratio'] = None
    
    return stock

@investment_opportunities_bp.route('', methods=['POST'])
@token_required
def create_investment_opportunity():
    """
    创建投资机会记录

    请求体:
    {
        "core_idea": "AI代理将颠覆客服行业",
        "source_url": "https://example.com",
        "summary": "详细的描述...",
        "trigger_words": ["AI代理", "客服自动化", "人力替代"],
        "stocks": [
            {
                "stock_name": "平安银行",
                "stock_code": "000001",
                "current_price": 10.5,
                "market": "A"
            }
        ]
    }

    响应:
    {
        "success": true,
        "data": { ... 记录详情（包含stocks数组）... }
    }
    """
    try:
        data = request.get_json()
        user = request.current_user
        user_id = user['id']

        required_fields = ['core_idea']
        for field in required_fields:
            if field not in data or not data[field].strip():
                return jsonify({
                    "success": False,
                    "error": f"缺少必需字段: {field}"
                }), 400

        # 准备插入投资机会数据
        record = {
            'core_idea': data['core_idea'].strip(),
            'source_url': data.get('source_url', '').strip(),
            'summary': data.get('summary', '').strip(),
            'trigger_words': data.get('trigger_words', []) if isinstance(data.get('trigger_words'), list) else [],
            'recorded_at': datetime.now().isoformat(),
            'user_id': user_id
        }

        # 插入数据库
        user_supabase = get_user_supabase_client()
        if not user_supabase:
            return jsonify({
                "success": False,
                "error": "数据库连接失败"
            }), 500

        # 插入投资机会记录
        response = user_supabase.table('investment_opportunities').insert(record).execute()
        
        if not response.data:
            return jsonify({
                "success": False,
                "error": "创建投资机会失败"
            }), 500

        opportunity_id = response.data[0]['id']
        stocks = data.get('stocks', [])
        
        # 插入关联的股票
        if stocks and isinstance(stocks, list):
            stock_records = []
            for stock in stocks:
                if stock.get('stock_code') and stock.get('stock_name'):
                    stock_records.append({
                        'opportunity_id': opportunity_id,
                        'stock_code': stock['stock_code'].strip(),
                        'stock_name': stock['stock_name'].strip(),
                        'market': stock.get('market', 'A').upper(),
                        'current_price': float(stock['current_price']) if stock.get('current_price') is not None else None
                    })
            
            if stock_records:
                user_supabase.table('investment_opportunity_stocks').insert(stock_records).execute()

        # 查询完整的记录（包含关联的股票）
        opportunity = response.data[0]
        stocks_response = user_supabase.table('investment_opportunity_stocks').select('*').eq('opportunity_id', opportunity_id).execute()
        stocks = stocks_response.data if stocks_response.data else []
        
        # 为每个股票计算涨幅
        for stock in stocks:
            enrich_stock_with_price_change(stock)
        
        opportunity['stocks'] = stocks

        return jsonify({
            "success": True,
            "data": opportunity
        })

    except ValueError as e:
        return jsonify({
            "success": False,
            "error": f"数据格式错误: {str(e)}"
        }), 400
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"创建投资机会记录失败: {str(e)}"
        }), 500

@investment_opportunities_bp.route('', methods=['GET'])
@optional_token
def get_investment_opportunities():
    """
    获取投资机会记录列表
    
    对于已登录用户：返回该用户的所有投资机会记录（包含股票信息）
    对于未登录用户：返回所有用户的投资机会记录（支持分页），但：
        - 最新的一条记录显示完整信息（不包含股票信息）
        - 其他记录进行信息隐藏处理（隐藏 core_idea, summary, source_url, trigger_words）

    查询参数:
    - page: 页码 (默认1)
    - limit: 每页数量 (默认10)

    响应:
    {
        "success": true,
        "data": [ ... 记录列表（已登录用户包含stocks数组，未登录用户stocks为空）... ],
        "pagination": {
            "page": 1,
            "limit": 10,
            "total": 25
        }
    }
    """
    try:
        user = request.current_user
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        offset = (page - 1) * limit

        supabase_client = get_user_supabase_client()
        if not supabase_client:
            return jsonify({
                "success": False,
                "error": "数据库连接失败"
            }), 500

        if user:
            query = supabase_client.table('investment_opportunities').select('*', count='exact')
        else:
            query = supabase_client.table('investment_opportunities').select(
                'id, core_idea, source_url, summary, trigger_words, recorded_at, created_at, updated_at',
                count='exact'
            )
        
        response = query.order('created_at', desc=True).range(offset, offset + limit - 1).execute()
        opportunities = response.data if response.data else []

        if not user:
            opportunity_ids = [opp['id'] for opp in opportunities]
            stocks_by_opportunity = {}
            
            if opportunity_ids:
                try:
                    stocks_response = supabase_client.table('investment_opportunity_stocks').select('*').in_('opportunity_id', opportunity_ids).execute()
                    if stocks_response.data:
                        for stock in stocks_response.data:
                            opp_id = stock['opportunity_id']
                            if opp_id not in stocks_by_opportunity:
                                stocks_by_opportunity[opp_id] = []
                            stocks_by_opportunity[opp_id].append(stock)
                except Exception as e:
                    logger.warning(f"查询股票信息失败: {str(e)}")
            
            for index, opp in enumerate(opportunities):
                if index > 0:
                    opportunities[index] = hide_opportunity_info(opp)
                    opportunities[index]['stocks'] = []
                else:
                    opp_id = opp.get('id')
                    stocks = stocks_by_opportunity.get(opp_id, []) if opp_id else []
                    for stock in stocks:
                        enrich_stock_with_price_change(stock)
                    opportunities[index]['stocks'] = stocks
        else:
            opportunity_ids = [opp['id'] for opp in opportunities]
            
            if opportunity_ids:
                stocks_response = supabase_client.table('investment_opportunity_stocks').select('*').in_('opportunity_id', opportunity_ids).execute()
                stocks_by_opportunity = {}
                for stock in stocks_response.data:
                    opp_id = stock['opportunity_id']
                    if opp_id not in stocks_by_opportunity:
                        stocks_by_opportunity[opp_id] = []
                    stocks_by_opportunity[opp_id].append(stock)
                
                for opp in opportunities:
                    stocks = stocks_by_opportunity.get(opp['id'], [])
                    for stock in stocks:
                        enrich_stock_with_price_change(stock)
                    opp['stocks'] = stocks
            else:
                for opp in opportunities:
                    opp['stocks'] = []

        total_count = getattr(response, 'count', None)
        if total_count is None:
            total_count = len(opportunities) if page == 1 else None

        return jsonify({
            "success": True,
            "data": opportunities,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count
            }
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"获取投资机会记录失败: {str(e)}"
        }), 500

@investment_opportunities_bp.route('/<int:opportunity_id>', methods=['GET'])
@optional_token
def get_investment_opportunity(opportunity_id):
    """
    获取单条投资机会记录详情

    对于已登录用户：只能访问自己的记录（包含股票信息）
    对于未登录用户：
        - 如果是最新记录，返回完整信息（包含股票信息）
        - 其他记录进行信息隐藏处理（隐藏 summary, source_url，stocks 为空）
    """
    try:
        user = request.current_user
        supabase_client = get_user_supabase_client()
        if not supabase_client:
            return jsonify({
                "success": False,
                "error": "数据库连接失败"
            }), 500

        if user:
            # 已登录用户：只能访问自己的记录
            response = supabase_client.table('investment_opportunities').select('*').eq('id', opportunity_id).eq('user_id', user['id']).execute()
            if not response.data:
                return jsonify({
                    "success": False,
                    "error": "记录不存在或无权限访问"
                }), 404
            opportunity = response.data[0]
        else:
            # 未登录用户：不返回 user_id 字段
            response = supabase_client.table('investment_opportunities').select(
                'id, core_idea, source_url, summary, trigger_words, recorded_at, created_at, updated_at'
            ).eq('id', opportunity_id).execute()
            if not response.data:
                return jsonify({
                    "success": False,
                    "error": "记录不存在"
                }), 404
            opportunity = response.data[0]

        # 判断是否为最新记录（仅未登录用户需要）
        is_latest = False
        if not user:
            latest_response = supabase_client.table('investment_opportunities').select('id').order('created_at', desc=True).limit(1).execute()
            if latest_response.data:
                is_latest = latest_response.data[0].get('id') == opportunity_id

        # 查询关联股票并补充涨幅
        if user or is_latest:
            stocks_response = supabase_client.table('investment_opportunity_stocks').select('*').eq('opportunity_id', opportunity_id).execute()
            stocks = stocks_response.data if stocks_response.data else []
            for stock in stocks:
                enrich_stock_with_price_change(stock)
            opportunity['stocks'] = stocks
        else:
            opportunity = hide_opportunity_info(opportunity)
            opportunity['stocks'] = []

        return jsonify({
            "success": True,
            "data": opportunity
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"获取投资机会记录失败: {str(e)}"
        }), 500

@investment_opportunities_bp.route('/<int:opportunity_id>', methods=['PUT'])
@token_required
def update_investment_opportunity(opportunity_id):
    """
    更新投资机会记录

    请求体:
    {
        "core_idea": "AI代理将颠覆客服行业",
        "source_url": "https://example.com",
        "summary": "详细的描述...",
        "trigger_words": ["AI代理", "客服自动化", "人力替代"],
        "stocks": [
            {
                "stock_name": "平安银行",
                "stock_code": "000001",
                "current_price": 10.5,
                "market": "A"
            }
        ]
    }
    """
    try:
        data = request.get_json()
        user = request.current_user
        user_id = user['id']

        # 获取用户认证的数据库客户端
        user_supabase = get_user_supabase_client()
        if not user_supabase:
            return jsonify({
                "success": False,
                "error": "数据库连接失败"
            }), 500

        # 检查记录是否存在且属于当前用户
        existing = user_supabase.table('investment_opportunities').select('id').eq('id', opportunity_id).eq('user_id', user_id).execute()

        if not existing.data:
            return jsonify({
                "success": False,
                "error": "记录不存在或无权限访问"
            }), 404

        # 更新投资机会数据
        update_data = {
            'updated_at': datetime.now().isoformat()
        }

        if 'core_idea' in data:
            update_data['core_idea'] = data['core_idea'].strip()
        if 'source_url' in data:
            update_data['source_url'] = data['source_url'].strip()
        if 'summary' in data:
            update_data['summary'] = data['summary'].strip()
        if 'trigger_words' in data:
            update_data['trigger_words'] = data['trigger_words'] if isinstance(data['trigger_words'], list) else []

        response = user_supabase.table('investment_opportunities').update(update_data).eq('id', opportunity_id).execute()

        # 更新关联的股票：先删除旧的，再插入新的
        if 'stocks' in data:
            # 删除旧的股票关联
            user_supabase.table('investment_opportunity_stocks').delete().eq('opportunity_id', opportunity_id).execute()
            
            # 插入新的股票关联
            stocks = data['stocks'] if isinstance(data['stocks'], list) else []
            if stocks:
                stock_records = []
                for stock in stocks:
                    if stock.get('stock_code') and stock.get('stock_name'):
                        stock_records.append({
                            'opportunity_id': opportunity_id,
                            'stock_code': stock['stock_code'].strip(),
                            'stock_name': stock['stock_name'].strip(),
                            'market': stock.get('market', 'A').upper(),
                            'current_price': float(stock['current_price']) if stock.get('current_price') is not None else None
                        })
                
                if stock_records:
                    user_supabase.table('investment_opportunity_stocks').insert(stock_records).execute()

        # 查询完整的记录（包含关联的股票）
        opportunity = response.data[0] if response.data else update_data
        stocks_response = user_supabase.table('investment_opportunity_stocks').select('*').eq('opportunity_id', opportunity_id).execute()
        stocks = stocks_response.data if stocks_response.data else []
        
        # 为每个股票计算涨幅
        for stock in stocks:
            enrich_stock_with_price_change(stock)
        
        opportunity['stocks'] = stocks

        return jsonify({
            "success": True,
            "data": opportunity
        })

    except ValueError as e:
        return jsonify({
            "success": False,
            "error": f"数据格式错误: {str(e)}"
        }), 400
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"更新投资机会记录失败: {str(e)}"
        }), 500

@investment_opportunities_bp.route('/<int:opportunity_id>', methods=['DELETE'])
@token_required
def delete_investment_opportunity(opportunity_id):
    """
    删除投资机会记录
    """
    try:
        user = request.current_user
        user_id = user['id']

        # 获取用户认证的数据库客户端
        user_supabase = get_user_supabase_client()
        if not user_supabase:
            return jsonify({
                "success": False,
                "error": "数据库连接失败"
            }), 500

        # 删除记录
        response = user_supabase.table('investment_opportunities').delete().eq('id', opportunity_id).eq('user_id', user_id).execute()

        if not response.data:
            return jsonify({
                "success": False,
                "error": "记录不存在或无权限删除"
            }), 404

        return jsonify({
            "success": True,
            "message": "记录已删除"
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"删除投资机会记录失败: {str(e)}"
        }), 500

# 在主应用中注册Blueprint
def register_stock_analysis_api(app):
    """
    在Flask应用中注册股票分析API

    使用方法:
    from app.api.stock_analysis_api import register_stock_analysis_api

    app = Flask(__name__)
    register_stock_analysis_api(app)
    """
    app.register_blueprint(stock_analysis_bp)

def register_investment_opportunities_api(app):
    """
    在Flask应用中注册投资机会记录API

    使用方法:
    from app.api.stock_analysis_api import register_investment_opportunities_api

    app = Flask(__name__)
    register_investment_opportunities_api(app)
    """
    app.register_blueprint(investment_opportunities_bp)

