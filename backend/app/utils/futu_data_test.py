from futu import *
from futu.common.pb.Qot_StockFilter_pb2 import BaseFilter, CustomIndicatorField

# 连接行情API
quote_ctx = OpenQuoteContext(host='127.0.0.1', port=11111)
#
# try:
#     # 方法1：直接查询中证800板块的成分股
#     # 先找到中证800的板块代码
#     ret, plate_list = quote_ctx.get_plate_list(Market.SH, Plate.ALL)
#     if ret == RET_OK:
#         # 查找中证800
#         for plate in plate_list.itertuples():
#             if '中证' in plate.plate_name or '沪深' in plate.plate_name:
#                 print(f"找到板块: {plate.plate_name}, 代码: {plate.code}")
#
#                 # 查询该板块的成分股
#                 # ret, data = quote_ctx.get_plate_stock(plate.code)
#                 # if ret == RET_OK:
#                 #     print(f"中证800成分股数量: {len(data)}")
#                 #     print(data[['code', 'stock_name', 'lot_size', 'stock_type']].head(10))
#                 #     print("...")
#                 # else:
#                 #     print(f"获取成分股失败: {data}")
#                 # break
#     else:
#         print('获取板块列表失败:', plate_list)
#
# except Exception as e:
#     print(f"发生错误: {e}")
# finally:
#     quote_ctx.close()


# try:
#     # 沪深300指数的标准代码
#     csi300_code = 'SH.000300'  # 上证沪深300指数代码
#     # 或者使用: 'SZ.399300'  # 深证沪深300指数代码
#
#     # 获取沪深300成分股
#     ret, data = quote_ctx.get_plate_stock(csi300_code)
#
#     if ret == RET_OK:
#         print(f"沪深300成分股数量: {len(data)}")
#         print("=" * 60)
#
#         # 显示所有列名
#         print("可用列:", list(data.columns))
#         print("=" * 60)
#
#         # 显示前20只成分股的主要信息
#         print("前20只成分股:")
#         for i, row in data.head(20).iterrows():
#             print(f"{i + 1:3d}. {row['code']:10s} {row['stock_name']:15s} "
#                   f"类型: {row.get('stock_type', 'N/A'):5s} "
#                   f"每手: {row.get('lot_size', 'N/A'):>5}")
#
#         # 统计信息
#         sh_count = len(data[data['code'].str.startswith('SH')])
#         sz_count = len(data[data['code'].str.startswith('SZ')])
#         print(f"\n统计信息:")
#         print(f"总股票数: {len(data)}")
#         print(f"沪市股票: {sh_count}")
#         print(f"深市股票: {sz_count}")
#
#         # 保存到CSV文件
#         # data.to_csv('csi300_constituents.csv', index=False, encoding='utf-8-sig')
#         # print("已保存到 csi300_constituents.csv")
#
#     else:
#         print(f"获取失败: {data}")
#
# except Exception as e:
#     print(f"发生错误: {e}")
# finally:
#     quote_ctx.close()


# 获取中证800成分股
ret, stocks = quote_ctx.get_plate_stock('SZ.399102')
if ret == RET_OK:
    print(f"SH.000906 stocks count: {len(stocks)}")
else:
    print(stocks)
# 获取每只股票的申万行业信息
# for code in stocks['code'].head(10):
#     ret, info = quote_ctx.get_stock_basicinfo(Market.SH, SecurityType.STOCK, code)
#     if ret == RET_OK:
#         industry = info.iloc[0].get('industry_sw', '未知')  # 申万行业
#         print(f"{code}: {industry}")
#
# quote_ctx.close()

# 假设已创建 quote_ctx 连接

# 2. 设置自定义指标筛选：要求返回价格和MA20，同样不进行条件过滤
# custom_filter = CustomIndicatorFilter()
# custom_filter.ktype = KLType.K_DAY
# custom_filter.stock_field1 = StockField.PRICE
# custom_filter.stock_field2 = StockField.MA
# custom_filter.stock_field2_para = [20]
# custom_filter.relative_position = RelativePosition.MORE
# custom_filter.is_no_filter = False
#
# # 3. 发起请求 (例如请求A股市场前100只股票的数据)
# ret, ls = quote_ctx.get_stock_filter(market=Market.SH,
#                                      filter_list=[custom_filter],
#                                      begin=0)
# if ret == RET_OK:
#     last_page, all_count, ret_list = ls
#     print('all count = ', all_count)
#     for item in ret_list:
#         print(item.stock_code)  # 取股票代码
#         print(item.stock_name)  # 取股票名称
#         print(item[custom_filter])  # 获取 custom_filter 的数值
# else:
#     print(ls)
