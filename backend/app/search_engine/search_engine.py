from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from abc import ABC, abstractmethod
import requests
import json
from datetime import datetime


class WebPage(BaseModel):
    """网页搜索结果"""
    name: str = Field(description="网页标题")
    url: str = Field(description="网页URL")
    snippet: str = Field(description="网页摘要")
    summary: str = Field(description="网页总结")
    siteName: Optional[str] = None
    dateLastCrawled: Optional[str] = None


class SearchResult(BaseModel):
    """搜索结果模型"""
    query: str = Field(description="搜索查询")
    webPages: List[WebPage] = Field(default_factory=list, description="网页结果列表")
    totalEstimatedMatches: int = Field(default=0, description="估计总匹配数")
    
    def to_context_str(self) -> str:
        context = ""
        for webPage in self.webPages:
            context = context + f"### {webPage.siteName} | {webPage.dateLastCrawled}\n"
            context = context + f"#### {webPage.name}\n"
            if webPage.summary:
                context = context + webPage.summary + "\n"
            else:
                context = context + webPage.snippet + "\n"
            context = context + "=" * 50 + "\n"
        return context


class SearchEngine(ABC):
    """搜索引擎抽象基类"""

    @abstractmethod
    def search(self, query: str, **kwargs) -> SearchResult:
        """
        执行搜索
        
        Args:
            query: 搜索查询
            **kwargs: 其他搜索参数
            
        Returns:
            SearchResult: 搜索结果
        """
        pass


class BochaSearchEngine(SearchEngine):
    """博查AI搜索引擎实现"""
    
    def __init__(self, api_key: str, base_url: str = "https://api.bochaai.com/v1"):
        self.api_key = api_key
        self.base_url = base_url
        self.search_url = f"{base_url}/web-search"
    
    def search(
        self, 
        query: str, 
        summary: bool = True, 
        count: int = 10,
        freshness: Optional[str] = None
    ) -> SearchResult:
        """
        使用博查API执行搜索
        
        Args:
            query: 搜索查询
            summary: 是否返回摘要
            count: 返回结果数量
            freshness: 时效性过滤 (oneDay/oneWeek/oneMonth等)
            
        Returns:
            SearchResult: 搜索结果
        """
        payload = {
            "query": query,
            "summary": summary,
            "count": count
        }
        
        if freshness:
            payload["freshness"] = freshness
        
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }
        
        try:
            response = requests.post(
                self.search_url,
                headers=headers,
                data=json.dumps(payload),
                timeout=30
            )
            response.raise_for_status()
            
            result_data = response.json()
            
            # 解析响应
            if result_data.get("code") != 200:
                raise Exception(f"API返回错误: {result_data.get('msg', '未知错误')}")
            
            data = result_data.get("data", {})
            web_pages_data = data.get("webPages", {})
            web_values = web_pages_data.get("value", [])
            
            # 转换为WebPage对象
            web_pages = [
                WebPage(
                    name=page.get("name", ""),
                    url=page.get("url", ""),
                    snippet=page.get("snippet", ""),
                    summary=page.get("summary", ""),
                    siteName=page.get("siteName"),
                    dateLastCrawled=page.get("dateLastCrawled")
                )
                for page in web_values
            ]
            
            return SearchResult(
                query=query,
                webPages=web_pages,
                totalEstimatedMatches=web_pages_data.get("totalEstimatedMatches", 0),
            )
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"搜索请求失败: {str(e)}")
        except Exception as e:
            raise Exception(f"搜索失败: {str(e)}")