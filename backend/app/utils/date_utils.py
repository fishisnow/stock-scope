"""
交易日期工具模块
提供交易日判断、日期过滤等功能
支持A股、美股等不同市场的交易日历
"""
from datetime import datetime, timedelta
from typing import List, Tuple, Optional, Union
import pandas as pd


class TradingDateUtils:
    """交易日期工具类"""

    def __init__(self):
        """初始化交易日期工具"""
        self._pandas_market_calendars = None
        self._init_calendars()

    def _init_calendars(self):
        """初始化交易日历库"""
        # 导入 pandas-market-calendars
        try:
            import pandas_market_calendars as mcal
            self._pandas_market_calendars = mcal
            print("已加载 pandas-market-calendars")
        except ImportError:
            print("pandas-market-calendars 未安装，建议安装: conda install -c conda-forge pandas-market-calendars")

    def is_trading_day(self, date: Union[str, datetime], market: str = "CN") -> bool:
        """
        判断指定日期是否为交易日
        
        Args:
            date: 日期字符串或datetime对象
            market: 市场类型 ("CN"=中国, "US"=美国, "HK"=香港)
        
        Returns:
            bool: 是否为交易日
        """
        if isinstance(date, str):
            date = datetime.strptime(date.replace('-', ''), '%Y%m%d')

        # 使用 pandas-market-calendars
        if self._pandas_market_calendars:
            try:
                if market == "CN":
                    # 中国市场 - 使用上交所日历
                    cal = self._pandas_market_calendars.get_calendar('XSHG')
                elif market == "US":
                    # 美国市场 - 纽交所日历
                    cal = self._pandas_market_calendars.get_calendar('XNYS')
                elif market == "HK":
                    # 香港市场 - 港交所日历
                    cal = self._pandas_market_calendars.get_calendar('XHKG')
                else:
                    print(f"不支持的市场类型: {market}")
                    return self._is_weekday(date)

                # 使用 valid_days 方法
                pd_date = pd.Timestamp(date)
                valid_days = cal.valid_days(start_date=pd_date, end_date=pd_date)
                return len(valid_days) > 0

            except Exception as e:
                print(f"使用 pandas-market-calendars 判断失败: {e}")

        # 回退到简单的工作日判断
        return self._is_weekday(date)

    def _is_weekday(self, date: datetime) -> bool:
        """简单的工作日判断（周一到周五）"""
        return date.weekday() < 5

    def filter_trading_days(self, date_ranges: List[Tuple[str, str]], market: str = "CN") -> List[Tuple[str, str]]:
        """
        过滤日期范围，只保留包含交易日的范围
        
        Args:
            date_ranges: 日期范围列表 [(start_date, end_date), ...]
            market: 市场类型
        
        Returns:
            List[Tuple[str, str]]: 过滤后的日期范围
        """
        filtered_ranges = []

        for start_date, end_date in date_ranges:
            # 检查这个范围内是否有交易日
            if self._has_trading_days_in_range(start_date, end_date, market):
                filtered_ranges.append((start_date, end_date))
            else:
                print(f"跳过非交易日范围: {start_date} ~ {end_date}")

        return filtered_ranges

    def _has_trading_days_in_range(self, start_date: str, end_date: str, market: str) -> bool:
        """检查日期范围内是否有交易日"""
        start_dt = datetime.strptime(start_date.replace('-', ''), '%Y%m%d')
        end_dt = datetime.strptime(end_date.replace('-', ''), '%Y%m%d')

        # 逐日检查（最多检查30天，避免效率问题）
        current_dt = start_dt
        check_count = 0
        max_checks = 30

        while current_dt <= end_dt and check_count < max_checks:
            if self.is_trading_day(current_dt, market):
                return True
            current_dt += timedelta(days=1)
            check_count += 1

        return False

    def get_next_trading_day(self, date: Union[str, datetime], market: str = "CN") -> Optional[datetime]:
        """
        获取下一个交易日
        
        Args:
            date: 基准日期
            market: 市场类型
        
        Returns:
            Optional[datetime]: 下一个交易日，如果找不到则返回None
        """
        if isinstance(date, str):
            date = datetime.strptime(date.replace('-', ''), '%Y%m%d')

        # 使用 pandas-market-calendars
        if self._pandas_market_calendars:
            try:
                if market == "CN":
                    cal = self._pandas_market_calendars.get_calendar('XSHG')
                elif market == "US":
                    cal = self._pandas_market_calendars.get_calendar('XNYS')
                elif market == "HK":
                    cal = self._pandas_market_calendars.get_calendar('XHKG')
                else:
                    return self._simple_next_trading_day(date)

                # 获取未来30天内的交易日
                start_date = date + timedelta(days=1)
                end_date = date + timedelta(days=30)
                valid_days = cal.valid_days(start_date=start_date, end_date=end_date)

                if len(valid_days) > 0:
                    return valid_days[0].to_pydatetime()

            except Exception as e:
                print(f"使用 pandas-market-calendars 获取下一交易日失败: {e}")

        # 回退到简单搜索
        return self._simple_next_trading_day(date)

    def _simple_next_trading_day(self, date: datetime) -> Optional[datetime]:
        """简单的下一交易日搜索"""
        current_date = date + timedelta(days=1)
        max_search_days = 30  # 最多搜索30天

        for _ in range(max_search_days):
            if self.is_trading_day(current_date):
                return current_date
            current_date += timedelta(days=1)

        return None

    def get_trading_days_in_range(self, start_date: str, end_date: str, market: str = "CN") -> List[str]:
        """
        获取指定日期范围内的所有交易日
        
        Args:
            start_date: 开始日期
            end_date: 结束日期
            market: 市场类型
        
        Returns:
            List[str]: 交易日列表
        """
        # 使用 pandas-market-calendars
        if self._pandas_market_calendars:
            try:
                if market == "CN":
                    cal = self._pandas_market_calendars.get_calendar('XSHG')
                elif market == "US":
                    cal = self._pandas_market_calendars.get_calendar('XNYS')
                elif market == "HK":
                    cal = self._pandas_market_calendars.get_calendar('XHKG')
                else:
                    return self._get_weekdays_in_range(start_date, end_date)

                # 使用 valid_days 方法
                start_dt = pd.Timestamp(start_date)
                end_dt = pd.Timestamp(end_date)
                trading_days = cal.valid_days(start_date=start_dt, end_date=end_dt)
                return [day.strftime('%Y-%m-%d') for day in trading_days]

            except Exception as e:
                print(f"使用 pandas-market-calendars 获取交易日列表失败: {e}")

        # 回退到工作日
        return self._get_weekdays_in_range(start_date, end_date)

    def _get_weekdays_in_range(self, start_date: str, end_date: str) -> List[str]:
        """获取日期范围内的工作日"""
        start_dt = datetime.strptime(start_date.replace('-', ''), '%Y%m%d')
        end_dt = datetime.strptime(end_date.replace('-', ''), '%Y%m%d')

        weekdays = []
        current_dt = start_dt

        while current_dt <= end_dt:
            if current_dt.weekday() < 5:  # 周一到周五
                weekdays.append(current_dt.strftime('%Y-%m-%d'))
            current_dt += timedelta(days=1)

        return weekdays


# 创建全局实例
trading_date_utils = TradingDateUtils()


def is_trading_day(date: Union[str, datetime], market: str = "CN") -> bool:
    """
    判断是否为交易日（便捷函数）
    
    Args:
        date: 日期
        market: 市场类型 ("CN"=中国, "US"=美国, "HK"=香港)
    
    Returns:
        bool: 是否为交易日
    """
    return trading_date_utils.is_trading_day(date, market)


def filter_trading_date_ranges(date_ranges: List[Tuple[str, str]], market: str = "CN") -> List[Tuple[str, str]]:
    """
    过滤日期范围，只保留包含交易日的范围（便捷函数）
    
    Args:
        date_ranges: 日期范围列表
        market: 市场类型
    
    Returns:
        List[Tuple[str, str]]: 过滤后的日期范围
    """
    return trading_date_utils.filter_trading_days(date_ranges, market)


if __name__ == "__main__":
    # 测试代码
    utils = TradingDateUtils()

    # 测试交易日判断
    test_dates = [
        "2024-01-01",  # 元旦，非交易日
        "2024-01-02",  # 工作日，可能是交易日
        "2024-01-06",  # 周六，非交易日
        "2024-01-07",  # 周日，非交易日
        "2024-01-08",  # 周一，可能是交易日
    ]

    print("交易日判断测试:")
    for date in test_dates:
        is_trading = utils.is_trading_day(date, "CN")
        print(f"{date}: {'交易日' if is_trading else '非交易日'}")

    print("\n获取交易日列表测试:")
    trading_days = utils.get_trading_days_in_range("2025-05-01", "2025-06-10", "CN")
    print(f"2024-01-01 到 2024-01-10 的交易日: {trading_days}")

    print("\n香港市场交易日测试:")
    hk_trading_days = utils.get_trading_days_in_range("2024-01-01", "2024-01-10", "HK")
    print(f"香港市场 2024-01-01 到 2024-01-10 的交易日: {hk_trading_days}")
