"""
股票分析API端点
提供基于搜索和AI的股票投资机会分析接口
"""

from flask import Blueprint, request, jsonify
from app.api.auth_middleware import token_required, get_user_supabase_client
import os
import sys
from dotenv import load_dotenv
from datetime import datetime
import re

# Add the backend directory to Python path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import db
from app.search_engine import (
    BochaSearchEngine,
    OpenAIAnalyzer,
    DeepSeekAnalyzer,
    StockAnalysisWorkflow
)

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
                "current_price": 10.5,
                "change_ratio": 2.5
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

        # 从数据库中搜索匹配的股票
        # 这里我们从最近的股票记录中搜索
        search_query = db.client.table('stock_records').select(
            'stock_code, stock_name, market, change_ratio'
        ).ilike('stock_name', f'%{query}%')

        if market_filter in ['A', 'HK']:
            search_query = search_query.eq('market', market_filter)

        # 获取最近的数据
        response = search_query.order('date', desc=True).order('time', desc=True).limit(20).execute()

        # 去重处理
        seen_codes = set()
        unique_results = []

        for row in response.data:
            code = row['stock_code']
            if code not in seen_codes:
                seen_codes.add(code)
                unique_results.append({
                    'code': code,
                    'name': row['stock_name'],
                    'market': row['market'],
                    'change_ratio': row['change_ratio']
                })

                if len(unique_results) >= 10:  # 限制返回10个结果
                    break

        # 如果没有找到匹配的记录，尝试直接从富途API获取
        if not unique_results:
            try:
                # 简单处理：如果query看起来像股票代码，直接查询
                if re.match(r'^\d{6}$', query):  # A股代码格式
                    market_code = 'SH.LIST0600' if query.startswith(('6', '5')) else 'SZ.LIST0600'
                    stock_codes = [f"{'SH' if query.startswith(('6', '5')) else 'SZ'}.{query}"]
                elif re.match(r'^\d{5}$', query):  # 港股代码格式
                    stock_codes = [f"HK.{query}"]
                else:
                    stock_codes = []

                if stock_codes:
                    # 这里需要实现富途API调用来获取实时股价
                    # 暂时返回空结果，需要进一步实现
                    pass

            except Exception as e:
                print(f"富途API查询失败: {e}")

        return jsonify({
            "success": True,
            "data": unique_results
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
            "amount": 10500000
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

        # 从数据库中获取最新价格信息
        response = db.client.table('stock_records').select(
            'stock_name, change_ratio, volume, amount'
        ).eq('stock_code', code).eq('market', market).order('date', desc=True).order('time', desc=True).limit(1).execute()

        if not response.data:
            return jsonify({
                "success": False,
                "error": "未找到该股票的价格信息"
            }), 404

        row = response.data[0]

        # 计算当前价格（这里简化处理，实际需要从富途API获取最新价格）
        # 暂时使用数据库中的数据作为参考
        result = {
            'code': code,
            'name': row['stock_name'],
            'current_price': None,  # 需要从富途API获取
            'change_ratio': row['change_ratio'],
            'volume': row['volume'],
            'amount': row['amount']
        }

        return jsonify({
            "success": True,
            "data": result
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"获取股票价格失败: {str(e)}"
        }), 500

# ============================================
# 投资机会记录API
# ============================================

investment_opportunities_bp = Blueprint('investment_opportunities', __name__, url_prefix='/api/investment-opportunities')

@investment_opportunities_bp.route('', methods=['POST'])
@token_required
def create_investment_opportunity():
    """
    创建投资机会记录

    请求体:
    {
        "core_idea": "AI代理将颠覆客服行业",
        "source": "《AI未来》P45、与张总的对话",
        "summary": "详细的描述...",
        "trigger_words": ["AI代理", "客服自动化", "人力替代"],
        "stock_name": "平安银行",
        "stock_code": "000001",
        "current_price": 10.5,
        "market": "A"
    }

    响应:
    {
        "success": true,
        "data": { ... 记录详情 ... }
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

        # 准备插入数据
        record = {
            'core_idea': data['core_idea'].strip(),
            'source_url': data.get('source_url', '').strip(),
            'summary': data.get('summary', '').strip(),
            'trigger_words': data.get('trigger_words', []) if isinstance(data.get('trigger_words'), list) else [],
            'stock_name': data.get('stock_name', '').strip(),
            'stock_code': data.get('stock_code', '').strip(),
            'current_price': float(data['current_price']) if data.get('current_price') is not None else None,
            'market': data.get('market', '').upper(),
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

        response = user_supabase.table('investment_opportunities').insert(record).execute()

        return jsonify({
            "success": True,
            "data": response.data[0] if response.data else record
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
@token_required
def get_investment_opportunities():
    """
    获取用户的投资机会记录列表

    查询参数:
    - page: 页码 (默认1)
    - limit: 每页数量 (默认10)

    响应:
    {
        "success": true,
        "data": [ ... 记录列表 ... ],
        "pagination": {
            "page": 1,
            "limit": 10,
            "total": 25
        }
    }
    """
    try:
        user = request.current_user
        user_id = user['id']

        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        offset = (page - 1) * limit

        # 获取用户认证的数据库客户端
        user_supabase = get_user_supabase_client()
        if not user_supabase:
            return jsonify({
                "success": False,
                "error": "数据库连接失败"
            }), 500

        # 查询记录
        query = user_supabase.table('investment_opportunities').select('*', count='exact').eq('user_id', user_id)
        response = query.order('created_at', desc=True).range(offset, offset + limit - 1).execute()

        return jsonify({
            "success": True,
            "data": response.data,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": response.count
            }
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

    请求体: 同创建接口
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

        # 更新数据
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
        if 'stock_name' in data:
            update_data['stock_name'] = data['stock_name'].strip()
        if 'stock_code' in data:
            update_data['stock_code'] = data['stock_code'].strip()
        if 'current_price' in data:
            update_data['current_price'] = float(data['current_price']) if data['current_price'] is not None else None
        if 'market' in data:
            update_data['market'] = data['market'].upper()

        response = user_supabase.table('investment_opportunities').update(update_data).eq('id', opportunity_id).execute()

        return jsonify({
            "success": True,
            "data": response.data[0] if response.data else update_data
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

