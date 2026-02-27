import json
import os
import re
import zipfile
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from xml.etree import ElementTree as ET

import requests

from app.db.database import db
from app.utils.futu_data import get_plate_stocks

SECTOR_INDUSTRY_MAP: Dict[str, List[str]] = {
    "科技": ["半导体", "消费电子", "光学光电子", "通信设备", "IT服务", "软件开发", "计算机设备", "自动化设备", "其他电子", "元件", "文化传媒", "影视院线", "游戏", "通信服务", "通用设备", "专用设备", "电机", "工程机械", "轨交设备"],
    "医药": ["化学制药", "生物制品", "中药", "医疗器械", "医疗服务", "医药商业"],
    "消费": ["白酒", "饮料制造", "食品加工制造", "白色家电", "黑色家电", "小家电", "厨卫电器", "服装家纺", "纺织制造", "家居用品", "包装印刷", "造纸", "种植业与林业", "农产品加工", "养殖业", "旅游及酒店", "零售", "互联网电商", "贸易", "教育", "美容护理", "其他社会服务", "综合"],
    "汽车": ["汽车整车", "汽车零部件", "汽车服务及其他"],
    "新能源": ["电池", "风电设备", "光伏设备", "其他电源设备"],
    "军工": ["军工电子", "军工装备"],
    "原材料": ["化学原料", "化学制品", "化学纤维", "农化制品", "塑料制品", "橡胶制品", "石油加工贸易", "油气开采及服务", "工业金属", "小金属", "贵金属", "能源金属", "非金属材料", "建筑材料", "钢铁", "煤炭开采加工", "金属新材料", "电子化学品"],
    "公用事业和基建": ["电力", "燃气", "环保设备", "环境治理", "建筑装饰", "房地产", "电网设备"],
    "金融": ["银行", "证券", "保险", "多元金融"],
    "交运物流": ["港口航运", "公路铁路运输", "机场航运", "物流"],
}
SECTOR_DEFINITIONS = {
    sector: "、".join(industries) for sector, industries in SECTOR_INDUSTRY_MAP.items()
}
INDUSTRY_TO_SECTOR = {
    industry: sector
    for sector, industries in SECTOR_INDUSTRY_MAP.items()
    for industry in industries
}

INDEX_CODE_ZZ800 = 'SH.000906'
INDEX_CODES = [
    INDEX_CODE_ZZ800,  # 中证800
    'SZ.399102',  # 创业板指数
    'SH.000688',  # 科创50指数
    'SH.000016'   # 上证50指数
]
SECTOR_INDUSTRY_EXCEL_ENV = "SECTOR_INDUSTRY_EXCEL_PATH"
_XLSX_NS = {'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


class DeepSeekContentRiskError(Exception):
    pass


def _normalize_stock_code(stock_code: Optional[str]) -> str:
    if stock_code is None:
        return ""
    raw = str(stock_code).strip().upper()
    if not raw:
        return ""
    # 兼容 000001、000001.SZ、SZ000001、600000.0 等格式
    digit_match = re.search(r'(\d{6})', raw)
    if digit_match:
        return digit_match.group(1)
    raw = raw.replace(".0", "")
    return raw.zfill(6) if raw.isdigit() and len(raw) <= 6 else ""


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

    return f"""你是资深A股行业研究员，请根据股票名称和常识判断一级分类和二级行业。

一级分类候选（只能从以下10个中选择）：
{sector_list}

二级行业范围：
{definitions}

请输出严格JSON对象，格式如下：
{{"items":[{{"stock_code":"000001","sector":"金融","industry":"银行","confidence":85}}]}}

items 中每个元素包含：
stock_code, sector, industry, confidence
其中 confidence 为 0-100 的整数。

要求：
1. sector 必须是上述10个一级分类之一。
2. industry 必须是对应 sector 下的二级行业之一。
3. 若信息不足，返回 sector="未分类"、industry="未分类"。

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


def _normalize_industry(industry: str, sector: str) -> str:
    valid_industries = set(SECTOR_INDUSTRY_MAP.get(sector, []))
    if industry in valid_industries:
        return industry
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


def _parse_xlsx_shared_strings(zf: zipfile.ZipFile) -> List[str]:
    if 'xl/sharedStrings.xml' not in zf.namelist():
        return []
    root = ET.fromstring(zf.read('xl/sharedStrings.xml'))
    shared_strings: List[str] = []
    for item in root.findall('a:si', _XLSX_NS):
        parts = [t.text for t in item.findall('.//a:t', _XLSX_NS) if t.text]
        shared_strings.append("".join(parts).strip())
    return shared_strings


def _parse_cell_ref_col_index(cell_ref: str) -> int:
    col_ref = ""
    for ch in cell_ref:
        if ch.isalpha():
            col_ref += ch
        else:
            break
    if not col_ref:
        return 1
    index = 0
    for ch in col_ref:
        index = index * 26 + ord(ch.upper()) - ord('A') + 1
    return index


def _extract_cell_text(cell: ET.Element, shared_strings: List[str]) -> str:
    cell_type = cell.attrib.get('t')
    if cell_type == 'inlineStr':
        node = cell.find('a:is', _XLSX_NS)
        if node is not None:
            parts = [t.text for t in node.findall('.//a:t', _XLSX_NS) if t.text]
            return "".join(parts).strip()
    value_node = cell.find('a:v', _XLSX_NS)
    if value_node is None or value_node.text is None:
        return ""
    value = value_node.text.strip()
    if cell_type == 's' and value.isdigit():
        idx = int(value)
        if 0 <= idx < len(shared_strings):
            return shared_strings[idx].strip()
    return value


def _load_sector_industry_map_from_excel(excel_path: str) -> Dict[str, Tuple[str, str]]:
    """
    从 Excel 读取 股票代码 -> (sector, industry) 映射。
    约定：sheet 名称即 industry，表头包含“代码”和“名称”列。
    """
    code_mapping: Dict[str, Tuple[str, str]] = {}

    with zipfile.ZipFile(excel_path) as zf:
        workbook_root = ET.fromstring(zf.read('xl/workbook.xml'))
        rels_root = ET.fromstring(zf.read('xl/_rels/workbook.xml.rels'))
        shared_strings = _parse_xlsx_shared_strings(zf)
        rel_map = {
            rel.attrib['Id']: rel.attrib['Target'].lstrip('/')
            for rel in rels_root
        }
        sheets = [
            (
                sheet.attrib.get('name', '').strip(),
                sheet.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            )
            for sheet in workbook_root.findall('a:sheets/a:sheet', _XLSX_NS)
        ]

        for industry_name, rel_id in sheets:
            if not industry_name or not rel_id:
                continue
            target = rel_map.get(rel_id, '')
            if not target:
                continue
            if not target.startswith('xl/'):
                target = f'xl/{target}'
            if target not in zf.namelist():
                continue

            sector_name = INDUSTRY_TO_SECTOR.get(industry_name, "未分类")
            sheet_root = ET.fromstring(zf.read(target))
            rows = sheet_root.findall('a:sheetData/a:row', _XLSX_NS)
            if not rows:
                continue

            header_map: Dict[str, int] = {}
            for cell in rows[0].findall('a:c', _XLSX_NS):
                col_idx = _parse_cell_ref_col_index(cell.attrib.get('r', 'A1'))
                col_name = _extract_cell_text(cell, shared_strings)
                if not col_name:
                    continue
                col_name = col_name.strip()
                if "代码" in col_name:
                    header_map["code"] = col_idx
                elif "名称" in col_name:
                    header_map["name"] = col_idx
            code_col = header_map.get("code")
            if not code_col:
                continue

            for row in rows[1:]:
                row_values: Dict[int, str] = {}
                for cell in row.findall('a:c', _XLSX_NS):
                    col_idx = _parse_cell_ref_col_index(cell.attrib.get('r', 'A1'))
                    row_values[col_idx] = _extract_cell_text(cell, shared_strings)
                raw_code = row_values.get(code_col, "")
                stock_code = _normalize_stock_code(raw_code)
                if not stock_code:
                    continue
                code_mapping[stock_code] = (sector_name, industry_name)

    return code_mapping


def _merge_sector_metadata(
    a_stocks: List[Dict],
    sector_map: Dict[str, Tuple[str, str, float]]
) -> List[Dict]:
    current_time = datetime.now().isoformat()
    records = []
    for stock in a_stocks:
        stock_code = stock.get('stock_code')
        stock_id = stock.get('id')
        if not stock_id:
            continue
        sector, industry, confidence = sector_map.get(stock_code, ("未分类", "未分类", 0))
        records.append({
            "id": stock_id,
            "sector": sector,
            "industry": industry,
            "sector_confidence": confidence,
            "updated_at": current_time
        })
    return records


def clean_sector_industry_by_excel(excel_path: str, full_refresh: bool = True) -> Dict:
    """
    根据同花顺行业 Excel 清洗 stock_basic_info 的 sector/industry 字段。
    """
    if not excel_path:
        raise ValueError("excel_path 不能为空")
    if not os.path.exists(excel_path):
        raise FileNotFoundError(f"Excel 文件不存在: {excel_path}")

    code_mapping = _load_sector_industry_map_from_excel(excel_path)
    if not code_mapping:
        return {"total": 0, "updated": 0, "matched": 0, "unmatched": 0}

    a_stocks = _get_a_stock_basic_info(full_refresh=full_refresh)
    if not a_stocks:
        return {"total": 0, "updated": 0, "matched": 0, "unmatched": 0}

    current_time = datetime.now().isoformat()
    records: List[Dict] = []
    matched_count = 0
    unmatched_count = 0
    for stock in a_stocks:
        stock_id = stock.get("id")
        if not stock_id:
            continue
        stock_code = _normalize_stock_code(stock.get("stock_code"))
        sector, industry = code_mapping.get(stock_code, ("未分类", "未分类"))
        if stock_code in code_mapping:
            matched_count += 1
        else:
            unmatched_count += 1
        records.append({
            "id": stock_id,
            "sector": sector,
            "industry": industry,
            "sector_confidence": 100 if stock_code in code_mapping else 0,
            "updated_at": current_time
        })

    db.upsert_stock_basic_metadata(records)
    return {
        "total": len(a_stocks),
        "updated": len(records),
        "matched": matched_count,
        "unmatched": unmatched_count
    }


def _get_a_stock_basic_info(full_refresh: bool = False) -> List[Dict]:
    """
    获取A股基础信息，默认仅返回待补齐行业分类的股票
    """
    return [
        {
            "id": stock.get("id"),
            "stock_code": stock.get("stock_code"),
            "stock_name": stock.get("stock_name"),
            "market": stock.get("market"),
            "exchange": stock.get("exchange"),
            "sector": stock.get("sector"),
            "industry": stock.get("industry"),
        }
        for stock in db.get_stock_basic_info_paginated(
            market='A',
            columns='id,stock_code,stock_name,market,exchange,sector,industry'
        )
        if stock.get("id")
        and stock.get("stock_code")
        and (
            full_refresh
            or not str(stock.get("sector") or "").strip()
            or str(stock.get("sector")).strip() not in SECTOR_DEFINITIONS
            or not str(stock.get("industry") or "").strip()
            or str(stock.get("industry")).strip() not in INDUSTRY_TO_SECTOR
            or INDUSTRY_TO_SECTOR.get(str(stock.get("industry")).strip())
            != str(stock.get("sector") or "").strip()
        )
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
    使用 DeepSeek 为A股股票打一级分类/二级行业标签
    :param full_refresh: 是否全量分类（默认仅分类未补齐或旧分类股票）
    """
    excel_path = os.getenv(SECTOR_INDUSTRY_EXCEL_ENV, "").strip()
    if excel_path:
        try:
            print(f"📘 使用 Excel 清洗行业分类: {excel_path}")
            return clean_sector_industry_by_excel(excel_path=excel_path, full_refresh=True)
        except Exception as exc:
            print(f"⚠️ Excel 清洗失败，回退 DeepSeek 分类: {exc}")

    a_stocks = _get_a_stock_basic_info(full_refresh=full_refresh)
    if not a_stocks:
        return {"total": 0, "updated": 0}

    updated_count = 0
    for i in range(0, len(a_stocks), batch_size):
        batch = a_stocks[i:i + batch_size]
        batch_codes = {s.get("stock_code") for s in batch if s.get("stock_code")}
        batch_sector_map: Dict[str, Tuple[str, str, float]] = {}
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
            print(f"❌ DeepSeek 行业分类失败: {exc}")
            continue

        for item in result:
            stock_code = str(item.get("stock_code", "")).strip()
            raw_sector = str(item.get("sector", "")).strip()
            raw_industry = str(item.get("industry", "")).strip()
            mapped_sector = INDUSTRY_TO_SECTOR.get(raw_industry)
            if mapped_sector:
                sector = mapped_sector
            else:
                sector = _normalize_sector(raw_sector)
            industry = _normalize_industry(raw_industry, sector)
            confidence = float(item.get("confidence", 0) or 0)
            if stock_code in batch_codes:
                batch_sector_map[stock_code] = (sector, industry, confidence)

        # 每个批次分类完成后立即落库，避免全部批次结束后才更新
        batch_records = _merge_sector_metadata(batch, batch_sector_map)
        db.upsert_stock_basic_metadata(batch_records)
        updated_count += len(batch_records)

    return {"total": len(a_stocks), "updated": updated_count}


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


__all__ = [
    "classify_and_tag_a_stocks",
    "clean_sector_industry_by_excel",
    "update_index_membership_for_a_stocks"
]
