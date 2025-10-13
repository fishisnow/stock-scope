"""
股票分析API端点
提供基于搜索和AI的股票投资机会分析接口
"""

from flask import Blueprint, request, jsonify
from typing import Optional
import os
from dotenv import load_dotenv

from ..search_engine import (
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

