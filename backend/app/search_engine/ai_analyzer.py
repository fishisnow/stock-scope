"""
AI股票分析模块
使用AI对搜索结果进行投资机会分析
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime
import json
import requests


class StockAnalysisResult(BaseModel):
    """股票分析结果"""
    analysis: str = Field(description="上涨原因详细分析")
    catalyst_type: List[str] = Field(description="利好类型：基本面/消息面/政策面/资金面/技术面/其他")
    short_term_opportunity: bool = Field(description="是否为短期投资机会")
    medium_long_term_opportunity: bool = Field(description="是否为中长期投资机会")
    investment_recommendation: str = Field(description="综合投资建议")
    confidence_score: int = Field(description="信心评分 0-100", ge=0, le=100)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "上涨原因分析": self.analysis,
            "利好类型": self.catalyst_type,
            "是否为短期机会": self.short_term_opportunity,
            "是否为中长期机会": self.medium_long_term_opportunity,
            "综合投资建议": self.investment_recommendation,
            "信心评分": self.confidence_score
        }


class AIAnalyzer:
    """AI分析器基类"""
    
    def analyze_stock(
        self, 
        stock_name: str, 
        search_context: str,
        date: Optional[str] = None
    ) -> StockAnalysisResult:
        """
        分析股票投资机会
        
        Args:
            stock_name: 股票名称
            search_context: 搜索结果上下文
            date: 日期，默认为今天
            
        Returns:
            StockAnalysisResult: 分析结果
        """
        raise NotImplementedError


class OpenAIAnalyzer(AIAnalyzer):
    """使用OpenAI API的分析器"""
    
    def __init__(
        self, 
        api_key: str, 
        base_url: str = "https://api.openai.com/v1",
        model: str = "gpt-4"
    ):
        self.api_key = api_key
        self.base_url = base_url
        self.model = model
    
    def _build_prompt(
        self, 
        stock_name: str, 
        search_context: str,
        date: str
    ) -> str:
        """构建分析提示词"""
        
        prompt = f"""你是一位资深证券分析师。

以下是关于【{stock_name}】在 {date} 上涨的最新新闻摘要，请综合分析其上涨的主要原因，并判断这是否是一个短期或中长期的投资机会。

【新闻摘要】
{search_context}

请输出结构化分析结果（严格使用JSON格式）：
```json
{{
  "analysis": "股价上涨受多重因素驱动，包括企业盈利超预期增长、行业政策利好持续释放、机构资金大幅流入以及技术面突破关键阻力位，形成多因素共振格局",
  "catalyst_type": ["基本面", "政策面", "资金面", "技术面"],
  "short_term_opportunity": true,
  "medium_long_term_opportunity": true,
  "investment_recommendation": "建议采取分批建仓策略，短期关注技术面突破带来的交易机会，中长期布局政策受益且基本面扎实的优质标的，注意控制仓位风险",
  "confidence_score": 85
}}
```

注意：
1. 请基于搜索结果进行客观分析
2. 利好类型只能从给定选项中选择一个
3. 信心评分要基于信息的可靠性和完整性, 评分范围是0-100
4. 只返回JSON格式，不要有其他说明文字
"""
        return prompt
    
    def analyze_stock(
        self, 
        stock_name: str, 
        search_context: str,
        date: Optional[str] = None
    ) -> StockAnalysisResult:
        """
        使用OpenAI分析股票投资机会
        
        Args:
            stock_name: 股票名称
            search_context: 搜索结果上下文
            date: 日期，默认为今天
            
        Returns:
            StockAnalysisResult: 分析结果
        """
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        
        prompt = self._build_prompt(stock_name, search_context, date)
        print(prompt)
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": ""
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.7,
            "response_format": {"type": "json_object"}  # 确保返回JSON
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=60
            )
            response.raise_for_status()
            
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            
            # 解析JSON结果
            # 移除可能的markdown代码块标记
            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            
            analysis_data = json.loads(content)
            
            # 创建分析结果对象
            return StockAnalysisResult(**analysis_data)
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"AI分析请求失败: {str(e)}")
        except json.JSONDecodeError as e:
            raise Exception(f"AI返回结果解析失败: {str(e)}")
        except Exception as e:
            raise Exception(f"AI分析失败: {str(e)}")


class DeepSeekAnalyzer(AIAnalyzer):
    """使用DeepSeek API的分析器（兼容OpenAI格式）"""
    
    def __init__(
        self, 
        api_key: str, 
        base_url: str = "https://api.deepseek.com/v1",
        model: str = "deepseek-chat"
    ):
        # DeepSeek API兼容OpenAI格式，直接复用OpenAI分析器
        self.openai_analyzer = OpenAIAnalyzer(
            api_key=api_key,
            base_url=base_url,
            model=model
        )
    
    def analyze_stock(
        self, 
        stock_name: str, 
        search_context: str,
        date: Optional[str] = None
    ) -> StockAnalysisResult:
        """使用DeepSeek分析股票投资机会"""
        return self.openai_analyzer.analyze_stock(stock_name, search_context, date)

