# -*- coding: utf-8 -*-
"""
SQLite 到 Supabase 数据迁移脚本

使用方法:
    python scripts/migrate_sqlite_to_supabase.py

注意:
    1. 确保已配置好 .env 文件
    2. 确保 Supabase 数据库表已创建
    3. 建议先备份 SQLite 数据库
"""

import sqlite3
import os
import sys
from datetime import datetime

# 添加父目录到路径以便导入 app 模块
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import db as supabase_db
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()


def migrate_data(sqlite_db_path: str = 'stock_data.db', batch_size: int = 100):
    """
    从 SQLite 迁移数据到 Supabase

    :param sqlite_db_path: SQLite 数据库文件路径
    :param batch_size: 批量插入的记录数
    """

    if not os.path.exists(sqlite_db_path):
        print(f"❌ 错误: SQLite 数据库文件不存在: {sqlite_db_path}")
        return

    print("=" * 60)
    print("📦 开始数据迁移: SQLite → Supabase")
    print("=" * 60)

    try:
        # 连接 SQLite
        print(f"\n📖 正在读取 SQLite 数据库: {sqlite_db_path}")
        conn = sqlite3.connect(sqlite_db_path)
        cursor = conn.cursor()

        # 获取总记录数
        cursor.execute('SELECT COUNT(*) FROM stock_records')
        total_count = cursor.fetchone()[0]
        print(f"✅ 找到 {total_count} 条记录需要迁移")

        if total_count == 0:
            print("⚠️  没有数据需要迁移")
            return

        # 询问确认
        confirm = input(f"\n是否继续迁移这 {total_count} 条记录？(yes/no): ")
        if confirm.lower() not in ['yes', 'y', '是']:
            print("❌ 迁移已取消")
            return

        # 分批读取并迁移数据
        print(f"\n🔄 开始迁移数据（批次大小: {batch_size}）...")
        cursor.execute('''
                       SELECT date, time, data_source, market, data_type, rank_order, stock_code, stock_name, change_ratio, volume, amount, pe_ratio, volume_ratio, turnover_rate
                       FROM stock_records
                       ORDER BY date DESC, id
                       ''')

        migrated_count = 0
        error_count = 0
        batch_records = []

        for row in cursor:
            # 解析 SQLite 记录
            date, time, data_source, market, data_type, rank_order, \
                stock_code, stock_name, change_ratio, volume, amount, \
                pe_ratio, volume_ratio, turnover_rate = row

            # 准备 Supabase 记录
            record = {
                'date': date,
                'time': time,
                'data_source': data_source,
                'market': market,
                'data_type': data_type,
                'rank_order': rank_order,
                'stock_code': stock_code,
                'stock_name': stock_name,
                'change_ratio': float(change_ratio) if change_ratio is not None else 0.0,
                'volume': float(volume) if volume is not None else 0.0,
                'amount': float(amount) if amount is not None else 0.0,
                'pe_ratio': float(pe_ratio) if pe_ratio is not None else 0.0,
                'volume_ratio': float(volume_ratio) if volume_ratio is not None else 0.0,
                'turnover_rate': float(turnover_rate) if turnover_rate is not None else 0.0
            }

            batch_records.append(record)

            # 批量插入
            if len(batch_records) >= batch_size:
                try:
                    supabase_db.client.table('stock_records').upsert(
                        batch_records,
                        on_conflict='date,data_source,market,data_type,stock_code'
                    ).execute()
                    migrated_count += len(batch_records)
                    print(f"✅ 已迁移: {migrated_count}/{total_count} ({migrated_count * 100 / total_count:.1f}%)")
                except Exception as e:
                    print(f"❌ 批次插入失败: {e}")
                    error_count += len(batch_records)

                batch_records = []

        # 插入剩余记录
        if batch_records:
            try:
                supabase_db.client.table('stock_records').upsert(
                    batch_records,
                    on_conflict='date,data_source,market,data_type,stock_code'
                ).execute()
                migrated_count += len(batch_records)
                print(f"✅ 已迁移: {migrated_count}/{total_count} ({migrated_count * 100 / total_count:.1f}%)")
            except Exception as e:
                print(f"❌ 最后批次插入失败: {e}")
                error_count += len(batch_records)

        # 关闭 SQLite 连接
        conn.close()

        # 输出结果
        print("\n" + "=" * 60)
        print("📊 迁移完成统计")
        print("=" * 60)
        print(f"✅ 成功迁移: {migrated_count} 条记录")
        print(f"❌ 失败记录: {error_count} 条")
        print(f"📈 成功率: {migrated_count * 100 / total_count:.1f}%")

        # 验证数据
        print("\n🔍 验证 Supabase 数据...")
        dates = supabase_db.get_available_dates(limit=5)
        print(f"✅ Supabase 中有 {len(dates)} 个不同日期的数据")
        print(f"   最新日期: {dates}")

    except Exception as e:
        print(f"❌ 迁移过程出错: {e}")
        import traceback
        traceback.print_exc()


def verify_migration(sqlite_db_path: str = 'stock_data.db'):
    """
    验证迁移结果

    :param sqlite_db_path: SQLite 数据库文件路径
    """
    print("\n" + "=" * 60)
    print("🔍 验证迁移结果")
    print("=" * 60)

    try:
        # SQLite 统计
        conn = sqlite3.connect(sqlite_db_path)
        cursor = conn.cursor()

        cursor.execute('SELECT COUNT(*) FROM stock_records')
        sqlite_count = cursor.fetchone()[0]

        cursor.execute('SELECT COUNT(DISTINCT date) FROM stock_records')
        sqlite_dates = cursor.fetchone()[0]

        conn.close()

        # Supabase 统计
        dates = supabase_db.get_available_dates(limit=1000)
        supabase_dates_count = len(dates)

        # 获取总记录数（需要实现一个简单的计数方法）
        response = supabase_db.client.table('stock_records').select('id', count='exact').limit(1).execute()
        supabase_count = response.count if hasattr(response, 'count') else 0

        print(f"\n📊 SQLite:")
        print(f"   总记录数: {sqlite_count}")
        print(f"   日期数量: {sqlite_dates}")

        print(f"\n📊 Supabase:")
        print(f"   总记录数: {supabase_count}")
        print(f"   日期数量: {supabase_dates_count}")

        if sqlite_count == supabase_count:
            print(f"\n✅ 数据完全一致！")
        else:
            print(f"\n⚠️  记录数不一致，差异: {abs(sqlite_count - supabase_count)} 条")

    except Exception as e:
        print(f"❌ 验证过程出错: {e}")


if __name__ == '__main__':
    print("🚀 SQLite → Supabase 迁移工具")
    print("=" * 60)

    # 检查 .env 配置
    if not os.getenv('SUPABASE_URL') or not os.getenv('SUPABASE_KEY'):
        print("❌ 错误: 请先配置 .env 文件中的 SUPABASE_URL 和 SUPABASE_KEY")
        sys.exit(1)

    # SQLite 数据库路径
    sqlite_path = os.path.join(os.path.dirname(__file__), '..', 'app', 'stock_data.db')

    # 检查文件是否存在
    if not os.path.exists(sqlite_path):
        sqlite_path = input("请输入 SQLite 数据库文件路径: ").strip()

    # 执行迁移
    migrate_data(sqlite_path, batch_size=100)

    # 验证迁移
    verify_input = input("\n是否验证迁移结果？(yes/no): ")
    if verify_input.lower() in ['yes', 'y', '是']:
        verify_migration(sqlite_path)

    print("\n✅ 完成！")