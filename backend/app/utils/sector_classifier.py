import json
import os
from datetime import datetime
from typing import Dict, List, Tuple

import requests

from app.db.database import db
from app.utils.futu_data import get_plate_stocks

SECTOR_DEFINITIONS = {
    '大消费': '白酒、食品、家电、零售',
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
INDEX_CODES = [
    INDEX_CODE_ZZ800,  # 中证800
    'SZ.399102',  # 创业板指数
    'SH.000688',  # 科创50指数
    'SH.000016'   # 上证50指数
]


class DeepSeekContentRiskError(Exception):
    pass


def _sanitize_stock_name(name: str) -> str:
    if not name:
        return ""
    cleaned = str(name).replace("*", "").replace("★", "").strip()
    return " ".join(cleaned.split())


def _build_sector_prompt(stock_items: List[Dict]) -> str:
    sector_list = "、".join(SECTOR_DEFINITIONS.keys())
    definitions = "\n".join([f"- {k}: {v}" for k, v in SECTOR_DEFINITIONS.items()])
    stock_lines = "\n".join([
        f"- {item['stock_code']} {_sanitize_stock_name(item['stock_name'])}"
        for item in stock_items
    ])

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
    if response.status_code == 400 and payload.get("response_format"):
        retry_payload = dict(payload)
        retry_payload.pop("response_format", None)
        response = requests.post(
            base_url + "/chat/completions",
            headers=headers,
            json=retry_payload,
            timeout=60
        )
    if response.status_code >= 400:
        print(f"❌ DeepSeek 请求失败: {response.status_code} - {response.text}")
        if "Content Exists Risk" in response.text:
            raise DeepSeekContentRiskError(response.text)
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


def _classify_stock_items(stock_items: List[Dict]) -> List[Dict]:
    prompt = _build_sector_prompt(stock_items)
    try:
        print(prompt)
        return _call_deepseek(prompt)
    except DeepSeekContentRiskError:
        if len(stock_items) <= 1:
            item = stock_items[0] if stock_items else {}
            print(
                f"⚠️ DeepSeek 内容风控，跳过: "
                f"{item.get('stock_code', '')} {item.get('stock_name', '')}"
            )
            return []
        mid = len(stock_items) // 2
        return _classify_stock_items(stock_items[:mid]) + _classify_stock_items(stock_items[mid:])


def _merge_sector_metadata(
    a_stocks: List[Dict],
    sector_map: Dict[str, Tuple[str, float]]
) -> List[Dict]:
    current_time = datetime.now().isoformat()
    records = []
    for stock in a_stocks:
        stock_code = stock.get('stock_code')
        stock_id = stock.get('id')
        if not stock_id:
            continue
        sector, confidence = sector_map.get(stock_code, ("未分类", 0))
        records.append({
            "id": stock_id,
            "sector": sector,
            "sector_confidence": confidence,
            "updated_at": current_time
        })
    return records


def _get_a_stock_basic_info(full_refresh: bool = False) -> List[Dict]:
    """
    获取A股基础信息，默认仅返回未分类股票
    """
    return [
        {
            "id": stock.get("id"),
            "stock_code": stock.get("stock_code"),
            "stock_name": stock.get("stock_name"),
            "market": stock.get("market"),
            "exchange": stock.get("exchange"),
            "sector": stock.get("sector")
        }
        for stock in db.get_stock_basic_info_paginated(
            market='A',
            columns='id,stock_code,stock_name,market,exchange,sector'
        )
        if stock.get("id")
        and stock.get("stock_code")
        and (full_refresh or not str(stock.get("sector") or "").strip() or str(stock.get("sector")).strip() == "未分类")
    ]


def _get_a_stock_basic_info_with_id() -> List[Dict]:
    return [
        {
            "id": stock.get("id"),
            "stock_code": stock.get("stock_code"),
            "market": stock.get("market")
        }
        for stock in db.get_stock_basic_info_paginated(
            market='A',
            columns='id,stock_code,market'
        )
        if stock.get("id") and stock.get("stock_code")
    ]


def _build_index_membership_map(index_codes: List[str]) -> Dict[str, List[str]]:
    membership_map: Dict[str, List[str]] = {}
    for index_code in index_codes:
        try:
            members = [
                stock for stock in get_plate_stocks(index_code)
                if stock.get('market') == 'A'
            ]
        except Exception as exc:
            print(f"❌ 获取指数成分失败: {index_code} - {exc}")
            continue
        for stock in members:
            stock_code = stock.get("code")
            if not stock_code:
                continue
            membership_map.setdefault(stock_code, []).append(index_code)
    return membership_map


def classify_and_tag_a_stocks(batch_size: int = 50, full_refresh: bool = False) -> Dict:
    """
    使用 DeepSeek 为A股股票打板块标签
    :param full_refresh: 是否全量分类（默认仅分类未分类股票）
    """
    a_stocks = _get_a_stock_basic_info(full_refresh=full_refresh)
    if not a_stocks:
        return {"total": 0, "updated": 0}

    sector_map: Dict[str, Tuple[str, float]] = {}
    for i in range(0, len(a_stocks), batch_size):
        batch = a_stocks[i:i + batch_size]
        stock_items = [
            {"stock_code": s["stock_code"], "stock_name": s["stock_name"]}
            for s in batch
            if s.get("stock_name")
        ]
        if not stock_items:
            continue
        try:
            result = _classify_stock_items(stock_items)
        except Exception as exc:
            print(f"❌ DeepSeek 板块分类失败: {exc}")
            continue

        for item in result:
            stock_code = str(item.get("stock_code", "")).strip()
            sector = _normalize_sector(str(item.get("sector", "")).strip())
            confidence = float(item.get("confidence", 0) or 0)
            if stock_code:
                sector_map[stock_code] = (sector, confidence)

    records = _merge_sector_metadata(a_stocks, sector_map)
    db.upsert_stock_basic_metadata(records)
    return {"total": len(a_stocks), "updated": len(records)}


def update_index_membership_for_a_stocks() -> Dict:
    """
    从 stock_basic_info 表中补齐指数归属信息
    """
    a_stocks = _get_a_stock_basic_info_with_id()
    if not a_stocks:
        return {"total": 0, "updated": 0}

    membership_map = _build_index_membership_map(INDEX_CODES)
    current_time = datetime.now().isoformat()
    records = []
    for stock in a_stocks:
        stock_code = stock.get("stock_code")
        records.append({
            "id": stock.get("id"),
            "index_membership": membership_map.get(stock_code, []),
            "updated_at": current_time
        })
    db.update_stock_basic_index_membership_batch(records)
    return {"total": len(a_stocks), "updated": len(records)}


__all__ = ["classify_and_tag_a_stocks", "update_index_membership_for_a_stocks"]
