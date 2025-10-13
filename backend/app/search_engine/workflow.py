"""
股票投资机会分析工作流
整合搜索引擎和AI分析器
"""

from typing import Optional, Dict, Any
from datetime import datetime
from .search_engine import SearchEngine, SearchResult
from .ai_analyzer import AIAnalyzer, StockAnalysisResult


class StockAnalysisWorkflow:
    """股票分析工作流"""
    
    def __init__(
        self, 
        search_engine: SearchEngine, 
        ai_analyzer: AIAnalyzer
    ):
        """
        初始化工作流
        
        Args:
            search_engine: 搜索引擎实例
            ai_analyzer: AI分析器实例
        """
        self.search_engine = search_engine
        self.ai_analyzer = ai_analyzer
    
    def analyze_stock_rise(
        self,
        stock_name: str,
        date: Optional[str] = None,
        search_freshness: Optional[str] = "oneMonth",
        search_count: int = 10
    ) -> Dict[str, Any]:
        """
        分析股票上涨原因和投资机会
        
        工作流步骤：
        1. 使用搜索引擎查询股票上涨原因
        2. 整合搜索结果
        3. 使用AI分析投资机会
        
        Args:
            stock_name: 股票名称
            date: 日期，默认为今天
            search_freshness: 搜索时效性 (oneDay/oneWeek/oneMonth)
            search_count: 搜索结果数量
            
        Returns:
            Dict包含：
                - search_result: 搜索结果
                - analysis: AI分析结果
                - metadata: 元数据
        """
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        
        # 步骤1: 构建搜索查询
        search_query = f"{stock_name} 今日上涨原因"
        
        print(f"[工作流] 步骤1: 搜索 '{search_query}'")
        
        # 执行搜索
        search_result: SearchResult = self.search_engine.search(
            query=search_query,
            summary=True,
            count=search_count,
            freshness=search_freshness
        )
        
        print(f"[工作流] 搜索完成，找到 {len(search_result.webPages)} 条结果")
        
        # 步骤2: 整合搜索结果为上下文
        print(f"[工作流] 步骤2: 整合搜索结果")
        
        search_context = search_result.to_context_str()
        
        # 步骤3: 使用AI分析
        print(f"[工作流] 步骤3: AI分析投资机会")
        
        analysis_result: StockAnalysisResult = self.ai_analyzer.analyze_stock(
            stock_name=stock_name,
            search_context=search_context,
            date=date
        )
        
        print(f"[工作流] 分析完成，信心评分: {analysis_result.confidence_score}")
        return {
            "analysis": analysis_result.to_dict(),
        }

    
    def batch_analyze_stocks(
        self,
        stock_names: list[str],
        date: Optional[str] = None,
        search_freshness: Optional[str] = "oneMonth"
    ) -> Dict[str, Dict[str, Any]]:
        """
        批量分析多只股票
        
        Args:
            stock_names: 股票名称列表
            date: 日期，默认为今天
            search_freshness: 搜索时效性
            
        Returns:
            Dict，key为股票名称，value为分析结果
        """
        results = {}
        
        for stock_name in stock_names:
            try:
                print(f"\n[批量分析] 开始分析: {stock_name}")
                result = self.analyze_stock_rise(
                    stock_name=stock_name,
                    date=date,
                    search_freshness=search_freshness
                )
                results[stock_name] = result
                print(f"[批量分析] {stock_name} 分析完成")
            except Exception as e:
                print(f"[批量分析] {stock_name} 分析失败: {str(e)}")
                results[stock_name] = {
                    "error": str(e)
                }
        
        return results

