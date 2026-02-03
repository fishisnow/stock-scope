import logging
from datetime import datetime
from typing import Dict, List

from app.db.database import db
from app.utils.futu_data import get_above_ma20_stock_codes
from app.utils.sector_classifier import SECTOR_DEFINITIONS, INDEX_CODE_ZZ800


def _normalize_index_membership(value) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        return [value]
    return []


def compute_market_breadth_daily(index_code: str = INDEX_CODE_ZZ800) -> Dict:
    """
    计算中证800按板块的MA20市场宽度，并写入数据库
    """
    stocks = db.get_stock_basic_info(market='A')
    if not stocks:
        return {"total": 0, "records": 0}

    above_ma20_codes = get_above_ma20_stock_codes()

    sector_stats: Dict[str, Dict[str, int]] = {
        sector: {"total": 0, "above": 0} for sector in SECTOR_DEFINITIONS.keys()
    }

    for stock in stocks:
        membership = _normalize_index_membership(stock.get("index_membership"))
        if index_code not in membership:
            continue
        sector = stock.get("sector")
        if sector not in sector_stats:
            logging.warning(f"{stock.get("stock_code")} 未分类")
            continue
        sector_stats[sector]["total"] += 1
        if stock.get("stock_code") in above_ma20_codes:
            sector_stats[sector]["above"] += 1

    current_date = datetime.now().strftime('%Y-%m-%d')
    records = []
    for sector, stats in sector_stats.items():
        total = stats["total"]
        above = stats["above"]
        if total == 0:
            breadth_pct = 0
        else:
            breadth_pct = round(above / total * 100, 2)
        records.append({
            "date": current_date,
            "index_code": index_code,
            "sector": sector,
            "total_count": total,
            "above_ma20_count": above,
            "breadth_pct": breadth_pct,
            "updated_at": datetime.now().isoformat()
        })

    db.upsert_market_breadth(records)
    return {"total": len(stocks), "records": len(records)}


__all__ = ["compute_market_breadth_daily"]
