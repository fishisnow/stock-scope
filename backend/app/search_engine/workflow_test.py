"""
快速测试脚本 - 验证工作流是否正常工作
"""

import os
import sys
import json
from dotenv import load_dotenv

# 添加项目根目录到路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.search_engine import (
    BochaSearchEngine,
    OpenAIAnalyzer,
    DeepSeekAnalyzer,
    StockAnalysisWorkflow
)


def test_full_workflow(stock_name: str):
    """测试完整工作流"""

    try:
        load_dotenv()
        bocha_api_key = os.getenv("BOCHA_API_KEY")
        deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")
        openai_api_key = os.getenv("OPENAI_API_KEY")
        
        if not bocha_api_key:
            print("✗ 跳过: 未配置BOCHA_API_KEY")
            return False
        
        if not (deepseek_api_key or openai_api_key):
            print("✗ 跳过: 未配置AI API密钥")
            return False
        
        # 初始化组件
        search_engine = BochaSearchEngine(api_key=bocha_api_key)
        
        if deepseek_api_key:
            print("使用 DeepSeek 分析器")
            deepseek_base_url = os.getenv("DEEPSEEK_BASE_URL")
            deepseek_model = os.getenv("DEEPSEEK_MODEL")
            ai_analyzer = DeepSeekAnalyzer(api_key=deepseek_api_key, base_url=deepseek_base_url, model=deepseek_model)
        else:
            print("使用 OpenAI 分析器")
            ai_analyzer = OpenAIAnalyzer(api_key=openai_api_key, model="gpt-3.5-turbo")
        
        workflow = StockAnalysisWorkflow(
            search_engine=search_engine,
            ai_analyzer=ai_analyzer
        )
        
        print("✓ 工作流初始化成功")
        
        # 执行完整分析
        print(f"\n执行完整分析: {stock_name}")
        print("这可能需要30-60秒...")
        
        result = workflow.analyze_stock_rise(
            stock_name=stock_name,
            search_freshness="oneMonth",
            search_count=10
        )
        
        print("\n✓ 完整工作流测试成功!")
        
        # 打印结果摘要
        print("\n" + "-"*60)
        print("分析结果摘要:")
        print("-"*60)
        
        analysis = result['analysis']
        print(f"\n【{stock_name}】")
        print(f"上涨原因: {analysis['上涨原因分析'][:1024]}...")
        print(f"利好类型: {analysis['利好类型']}")
        print(f"短期机会: {'✓ 是' if analysis['是否为短期机会'] else '✗ 否'}")
        print(f"中长期机会: {'✓ 是' if analysis['是否为中长期机会'] else '✗ 否'}")
        print(f"信心评分: {analysis['信心评分']}/100")
        print(f"\n投资建议:\n{analysis['综合投资建议']}")
        
        # 保存完整结果到文件
        output_file = "test_result.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"\n完整结果已保存到: {output_file}")
        
        return True
        
    except Exception as e:
        print(f"✗ 完整工作流测试失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    test_full_workflow(stock_name='华虹公司')