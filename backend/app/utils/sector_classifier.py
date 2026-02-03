import json
import os
from datetime import datetime
from typing import Dict, List, Tuple

import requests

from app.db.database import db
from app.utils.futu_data import get_plate_stocks

SECTOR_DEFINITIONS = {
    '大消费': '白酒、食品、家电、零售等',
    '医药健康': '医药、医疗、生物制药',
    '科技成长': '半导体、软件、互联网、通信',
    '大金融': '银行、证券、保险',
    '新能源': '光伏、锂电、储能、新能源汽车',
    '周期资源': '煤炭、钢铁、有色、化工',
    '高端制造': '军工、机械、自动化',
    '公用事业': '电力、燃气、环保',
    '房地产基建': '房地产、建筑、建材',
    '交通运输': '物流、航运、港口、航空'
}

INDEX_CODE_ZZ800 = 'SH.000906'


def _build_sector_prompt(stock_items: List[Dict]) -> str:
    sector_list = "、".join(SECTOR_DEFINITIONS.keys())
    definitions = "\n".join([f"- {k}: {v}" for k, v in SECTOR_DEFINITIONS.items()])
    stock_lines = "\n".join([f"- {item['stock_code']} {item['stock_name']}" for item in stock_items])

    return f"""你是资深A股行业研究员，请根据股票名称和常识判断板块归属。

板块候选（只能从以下10个中选择）：
{sector_list}

板块定义：
{definitions}

请输出严格JSON对象，格式如下：
{{"items":[{{"stock_code":"000001","sector":"大金融","confidence":85}}]}}

items 中每个元素包含：
stock_code, sector, confidence
其中 confidence 为 0-100 的整数。

股票列表：
{stock_lines}
"""


def _call_deepseek(prompt: str) -> List[Dict]:
    base_url = os.getenv('DEEPSEEK_BASE_URL', "https://api.deepseek.com/v1")
    api_key = os.getenv('DEEPSEEK_API_KEY')
    if not api_key:
        raise ValueError("未配置 DEEPSEEK_API_KEY 环境变量")

    payload = {
        "model": os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
        "messages": [
            {"role": "system", "content": ""},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"}
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    response = requests.post(
        base_url + "/chat/completions",
        headers=headers,
        json=payload,
        timeout=60
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"].strip()
    print(content)
    print("============================================================")
    if content.startswith("```"):
        content = content.strip("`")
    parsed = json.loads(content)
    if isinstance(parsed, dict) and "items" in parsed:
        return parsed["items"]
    if isinstance(parsed, list):
        return parsed
    return []


def _normalize_sector(sector: str) -> str:
    if sector in SECTOR_DEFINITIONS:
        return sector
    return "未分类"


def _merge_metadata(
    a_stocks: List[Dict],
    sector_map: Dict[str, Tuple[str, float]],
    index_members: set
) -> List[Dict]:
    current_time = datetime.now().isoformat()
    records = []
    for stock in a_stocks:
        stock_code = stock.get('stock_code')
        sector, confidence = sector_map.get(stock_code, ("未分类", 0))
        index_membership = [INDEX_CODE_ZZ800] if stock_code in index_members else []
        records.append({
            "stock_code": stock_code,
            "stock_name": stock.get('stock_name'),
            "market": stock.get('market'),
            "exchange": stock.get('exchange'),
            "sector": sector,
            "sector_confidence": confidence,
            "index_membership": index_membership,
            "updated_at": current_time
        })
    return records


def classify_and_tag_a_stocks(batch_size: int = 50) -> Dict:
    """
    使用 DeepSeek 为A股股票打板块标签，并标记中证800成分股
    """
    a_stocks = db.get_stock_basic_info(market='A')
    if not a_stocks:
        return {"total": 0, "updated": 0}

    sector_map: Dict[str, Tuple[str, float]] = {}
    for i in range(0, len(a_stocks), batch_size):
        batch = a_stocks[i:i + batch_size]
        stock_items = [{"stock_code": s["stock_code"], "stock_name": s["stock_name"]} for s in batch]
        prompt = _build_sector_prompt(stock_items)
        try:
            result = _call_deepseek(prompt)
        except Exception as exc:
            print(f"❌ DeepSeek 板块分类失败: {exc}")
            continue

        for item in result:
            stock_code = str(item.get("stock_code", "")).strip()
            sector = _normalize_sector(str(item.get("sector", "")).strip())
            confidence = float(item.get("confidence", 0) or 0)
            if stock_code:
                sector_map[stock_code] = (sector, confidence)

    index_members = {
        stock['code'] for stock in get_plate_stocks(INDEX_CODE_ZZ800)
        if stock.get('market') == 'A'
    }

    records = _merge_metadata(a_stocks, sector_map, index_members)
    db.upsert_stock_basic_metadata(records)
    return {"total": len(a_stocks), "updated": len(records)}


__all__ = ["classify_and_tag_a_stocks"]
