-- Supabase (PostgreSQL) 数据库DDL脚本
-- 股票数据统计系统数据库结构
-- 
-- 注意：本系统使用 Supabase Auth 进行用户认证
--       不需要自定义的 users 和 refresh_tokens 表
--       用户数据存储在 Supabase Auth 的 auth.users 表中

-- ============================================
-- 股票统计记录表
-- ============================================
CREATE TABLE IF NOT EXISTS stock_records (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,                                  -- 日期
    time TIME NOT NULL,                                  -- 时间
    data_source VARCHAR(50) NOT NULL,                    -- 数据源: 'futu' 或 'tonghuashun'
    market VARCHAR(10) NOT NULL,                         -- 市场: 'A' 或 'HK'
    data_type VARCHAR(50) NOT NULL,                      -- 数据类型: 'top_amount', 'top_change', 'top_volume_ratio', 'intersection'
    rank_order INTEGER NOT NULL,                         -- 排名
    stock_code VARCHAR(20),                              -- 股票代码
    stock_name VARCHAR(100),                             -- 股票名称
    change_ratio DOUBLE PRECISION,                       -- 涨跌幅
    volume DOUBLE PRECISION,                             -- 成交量
    amount DOUBLE PRECISION,                             -- 成交额
    pe_ratio DOUBLE PRECISION,                           -- 市盈率
    volume_ratio DOUBLE PRECISION,                       -- 量比
    turnover_rate DOUBLE PRECISION,                      -- 换手率
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()    -- 创建时间
);

-- ============================================
-- 索引
-- ============================================

-- 唯一索引：防止重复插入相同日期、数据源、市场、数据类型的股票记录
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_stock_record 
ON stock_records (date, data_source, market, data_type, stock_code);

-- 复合索引：提高按日期、数据源、市场查询的性能
CREATE INDEX IF NOT EXISTS idx_date_source_market 
ON stock_records (date, data_source, market);

-- 单列索引：提高按股票代码查询的性能
CREATE INDEX IF NOT EXISTS idx_stock_code 
ON stock_records (stock_code);

-- 日期索引：提高按日期查询的性能
CREATE INDEX IF NOT EXISTS idx_date 
ON stock_records (date DESC);

-- ============================================
-- 注释
-- ============================================
COMMENT ON TABLE stock_records IS '股票统计记录表，存储各数据源的股票排行数据';
COMMENT ON COLUMN stock_records.date IS '统计日期';
COMMENT ON COLUMN stock_records.time IS '统计时间';
COMMENT ON COLUMN stock_records.data_source IS '数据源：futu-富途，tonghuashun-同花顺';
COMMENT ON COLUMN stock_records.market IS '市场：A-A股市场，HK-港股市场';
COMMENT ON COLUMN stock_records.data_type IS '数据类型：top_amount-成交额榜，top_change-涨跌幅榜，top_volume_ratio-量比榜，intersection-交集';
COMMENT ON COLUMN stock_records.rank_order IS '在该榜单中的排名';
COMMENT ON COLUMN stock_records.stock_code IS '股票代码';
COMMENT ON COLUMN stock_records.stock_name IS '股票名称';
COMMENT ON COLUMN stock_records.change_ratio IS '涨跌幅（%）';
COMMENT ON COLUMN stock_records.volume IS '成交量';
COMMENT ON COLUMN stock_records.amount IS '成交额';
COMMENT ON COLUMN stock_records.pe_ratio IS '市盈率（PE）';
COMMENT ON COLUMN stock_records.volume_ratio IS '量比';
COMMENT ON COLUMN stock_records.turnover_rate IS '换手率（%）';

-- ============================================
-- RLS (行级安全策略) - 可选
-- ============================================
-- 如果需要启用RLS，可以取消下面的注释

-- ALTER TABLE stock_records ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取数据
-- CREATE POLICY "Allow public read access" ON stock_records
--     FOR SELECT USING (true);

-- 只允许认证用户写入数据
-- CREATE POLICY "Allow authenticated insert" ON stock_records
--     FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- CREATE POLICY "Allow authenticated update" ON stock_records
--     FOR UPDATE USING (auth.role() = 'authenticated');

-- CREATE POLICY "Allow authenticated delete" ON stock_records
--     FOR DELETE USING (auth.role() = 'authenticated');
