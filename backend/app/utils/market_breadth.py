import logging
from datetime import datetime
from typing import Dict, List, Any

from app.db.database import db
from app.utils.futu_data import get_above_ma20_stock_codes, get_plate_stocks
from app.utils.sector_classifier import SECTOR_DEFINITIONS, INDEX_CODES, INDEX_CODE_ZZ800
from app.utils.date_utils import is_trading_day
INDEX_LABELS = {
    "SH.000906": "中证800",
    "SZ.399102": "创业板指",
    "SH.000688": "科创50",
    "SH.000016": "上证50"
}


def _normalize_index_membership(value) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        return [value]
    return []


def _compute_index_breadth(index_code: str, above_ma20_codes: set):
    """
    计算单个指数的整体MA20市场宽度，并写入数据库
    """
    index_members_list = [
        stock for stock in get_plate_stocks(index_code)
        if stock.get('market') == 'A'
    ]
    if not index_members_list:
        return
    index_member_codes = [
        stock.get("code") for stock in index_members_list if stock.get("code")
    ]
    if not index_member_codes:
        return

    total_count = len(index_member_codes)
    above_count = sum(1 for code in index_member_codes if code in above_ma20_codes)
    breadth_pct = 0 if total_count == 0 else round(above_count / total_count * 100, 2)

    current_date = datetime.now().strftime('%Y-%m-%d')
    label = INDEX_LABELS.get(index_code, index_code)
    records = [{
        "date": current_date,
        "breadth_type": "index",
        "sector": label,
        "total_count": total_count,
        "above_ma20_count": above_count,
        "breadth_pct": breadth_pct,
        "updated_at": datetime.now().isoformat()
    }]

    db.upsert_market_breadth(records)


def _compute_sector_breadth_by_zz800(above_ma20_codes: set):
    """
    使用中证800成分股计算各行业的MA20市场宽度
    """
    index_members_list = [
        stock for stock in get_plate_stocks(INDEX_CODE_ZZ800)
        if stock.get('market') == 'A'
    ]
    if not index_members_list:
        return
    index_member_codes = [
        stock.get("code") for stock in index_members_list if stock.get("code")
    ]
    if not index_member_codes:
        return

    stocks = db.get_stock_basic_info_by_codes(index_member_codes, market='A')
    if not stocks:
        return

    sector_stats: Dict[str, Dict[str, int]] = {
        sector: {"total": 0, "above": 0} for sector in SECTOR_DEFINITIONS.keys()
    }

    for stock in stocks:
        sector = stock.get("sector")
        if sector not in sector_stats:
            logging.warning(f"{stock.get('stock_code')} 未分类")
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
            "breadth_type": "sector",
            "sector": sector,
            "total_count": total,
            "above_ma20_count": above,
            "breadth_pct": breadth_pct,
            "updated_at": datetime.now().isoformat()
        })

    db.upsert_market_breadth(records)


def compute_market_breadth_daily(index_codes: List[str] = None):
    """
    计算指数整体宽度 + 中证800行业宽度，并写入数据库
    """
    if not is_trading_day(datetime.now()):
        # 非交易时间，直接返回
        return

    if index_codes is None:
        index_codes = INDEX_CODES
    above_ma20_codes = set(get_above_ma20_stock_codes())
    for index_code in index_codes:
        try:
            _compute_index_breadth(index_code, above_ma20_codes)
        except Exception as exc:
            logging.error(f"❌ 计算市场宽度失败: {index_code} - {exc}")
            continue
    try:
        _compute_sector_breadth_by_zz800(above_ma20_codes)
    except Exception as exc:
        logging.error(f"❌ 计算行业宽度失败: {exc}")


__all__ = ["compute_market_breadth_daily"]
