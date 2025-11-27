-- 创建获取去重日期列表的数据库函数
-- 在 Supabase SQL Editor 中执行此脚本

-- 函数：获取不重复的日期列表（按日期倒序）
CREATE OR REPLACE FUNCTION get_distinct_dates(limit_count INT DEFAULT 30)
RETURNS TABLE(date DATE) 
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT stock_records.date
  FROM stock_records
  ORDER BY stock_records.date DESC
  LIMIT limit_count;
$$;

-- 添加函数说明
COMMENT ON FUNCTION get_distinct_dates IS '获取 stock_records 表中不重复的日期列表，按日期倒序排列';

