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
    data_type VARCHAR(50) NOT NULL,                      -- 数据类型: 'top_turnover', 'top_change', 'intersection'
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
COMMENT ON COLUMN stock_records.data_type IS '数据类型：top_turnover-成交额榜（前50），top_change-涨跌幅榜，intersection-交集';
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


-- ============================================
-- 投资机会记录表（如果不存在则创建）
-- ============================================
CREATE TABLE IF NOT EXISTS investment_opportunities (
    id BIGSERIAL PRIMARY KEY,
    core_idea TEXT NOT NULL,                              -- 核心观点：一句话概括机会
    source_url TEXT,                                       -- 来源URL：灵感来源链接
    summary TEXT,                                         -- 概要：详细描述
    trigger_words TEXT[],                                 -- 触发词：3-5个关键词数组
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),   -- 记录时间
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- 用户ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),    -- 创建时间
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()     -- 更新时间
);

-- ============================================
-- 投资机会关联股票表
-- ============================================
CREATE TABLE IF NOT EXISTS investment_opportunity_stocks (
    id BIGSERIAL PRIMARY KEY,
    opportunity_id BIGINT NOT NULL REFERENCES investment_opportunities(id) ON DELETE CASCADE, -- 投资机会ID
    stock_code VARCHAR(20) NOT NULL,                       -- 股票代码
    stock_name VARCHAR(100) NOT NULL,                     -- 股票名称
    market VARCHAR(10) NOT NULL,                          -- 市场：'A' 或 'HK'
    current_price DOUBLE PRECISION,                        -- 记录时的当前股价
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()     -- 创建时间
);

-- ============================================
-- 投资机会记录表的索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_investment_opportunities_user_id
ON investment_opportunities (user_id);

CREATE INDEX IF NOT EXISTS idx_investment_opportunities_created_at
ON investment_opportunities (created_at DESC);

-- ============================================
-- 投资机会关联股票表的索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_investment_opportunity_stocks_opportunity_id
ON investment_opportunity_stocks (opportunity_id);

CREATE INDEX IF NOT EXISTS idx_investment_opportunity_stocks_stock_code
ON investment_opportunity_stocks (stock_code);

-- ============================================
-- 注释
-- ============================================
COMMENT ON TABLE investment_opportunities IS '投资机会记录表，存储用户记录的投资机会和灵感';
COMMENT ON COLUMN investment_opportunities.core_idea IS '核心观点：一句话概括投资机会';
COMMENT ON COLUMN investment_opportunities.source_url IS '来源URL：灵感来源链接地址';
COMMENT ON COLUMN investment_opportunities.summary IS '概要：投资机会的详细描述';
COMMENT ON COLUMN investment_opportunities.trigger_words IS '触发词：3-5个关键词数组';
COMMENT ON COLUMN investment_opportunities.recorded_at IS '记录时间';
COMMENT ON COLUMN investment_opportunities.user_id IS '用户ID，关联Supabase Auth用户';

COMMENT ON TABLE investment_opportunity_stocks IS '投资机会关联股票表，一个投资机会可以关联多个股票';
COMMENT ON COLUMN investment_opportunity_stocks.opportunity_id IS '投资机会ID，关联investment_opportunities表';
COMMENT ON COLUMN investment_opportunity_stocks.stock_code IS '股票代码';
COMMENT ON COLUMN investment_opportunity_stocks.stock_name IS '股票名称';
COMMENT ON COLUMN investment_opportunity_stocks.market IS '市场：A-A股市场，HK-港股市场';
COMMENT ON COLUMN investment_opportunity_stocks.current_price IS '记录时的当前股价';

-- ============================================
-- RLS (行级安全策略)
-- ============================================
ALTER TABLE investment_opportunities ENABLE ROW LEVEL SECURITY;

-- 允许所有人查看投资机会记录
CREATE POLICY "Allow public to view all investment opportunities" ON investment_opportunities
    FOR SELECT USING (true);

-- 用户只能插入自己的投资机会记录
CREATE POLICY "Users can insert own investment opportunities" ON investment_opportunities
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的投资机会记录
CREATE POLICY "Users can update own investment opportunities" ON investment_opportunities
    FOR UPDATE USING (auth.uid() = user_id);

-- 用户只能删除自己的投资机会记录
CREATE POLICY "Users can delete own investment opportunities" ON investment_opportunities
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 投资机会关联股票表的RLS (行级安全策略)
-- ============================================
ALTER TABLE investment_opportunity_stocks ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己投资机会关联的股票
CREATE POLICY "Allow public to view all opportunity stocks" ON investment_opportunity_stocks
    FOR SELECT USING (true);

-- 用户只能插入自己投资机会关联的股票
CREATE POLICY "Users can insert own opportunity stocks" ON investment_opportunity_stocks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM investment_opportunities
            WHERE investment_opportunities.id = investment_opportunity_stocks.opportunity_id
            AND investment_opportunities.user_id = auth.uid()
        )
    );

-- 用户只能更新自己投资机会关联的股票
CREATE POLICY "Users can update own opportunity stocks" ON investment_opportunity_stocks
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM investment_opportunities
            WHERE investment_opportunities.id = investment_opportunity_stocks.opportunity_id
            AND investment_opportunities.user_id = auth.uid()
        )
    );

-- 用户只能删除自己投资机会关联的股票
CREATE POLICY "Users can delete own opportunity stocks" ON investment_opportunity_stocks
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM investment_opportunities
            WHERE investment_opportunities.id = investment_opportunity_stocks.opportunity_id
            AND investment_opportunities.user_id = auth.uid()
        )
    );

-- ============================================
-- 股票基础信息表
-- ============================================
CREATE TABLE IF NOT EXISTS stock_basic_info (
    id BIGSERIAL PRIMARY KEY,
    stock_code VARCHAR(20) NOT NULL,                          -- 股票代码
    stock_name VARCHAR(100) NOT NULL,                         -- 股票名称
    market VARCHAR(10) NOT NULL,                              -- 市场: 'A' 或 'HK'
    exchange VARCHAR(10) NOT NULL,                            -- 交易所: 'SH'(上海), 'SZ'(深圳), 'HK'(香港)
    sector VARCHAR(50),                                       -- 一级分类
    industry VARCHAR(50),                                     -- 二级行业
    sector_confidence NUMERIC(5,2),                           -- 板块识别置信度
    index_membership JSONB,                                   -- 指数归属(JSON数组)
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),   -- 最后同步时间
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),        -- 创建时间
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()        -- 更新时间
);

-- 已存在表的增量字段补齐（幂等）
ALTER TABLE stock_basic_info
ADD COLUMN IF NOT EXISTS industry VARCHAR(50);

-- ============================================
-- 股票基础信息表的索引
-- ============================================
-- 唯一索引：股票代码+市场唯一
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_basic_info_code_market
ON stock_basic_info (stock_code, market);

-- 索引：提高按市场查询的性能
CREATE INDEX IF NOT EXISTS idx_stock_basic_info_market
ON stock_basic_info (market);

-- 索引：提高按股票代码查询的性能
CREATE INDEX IF NOT EXISTS idx_stock_basic_info_code
ON stock_basic_info (stock_code);

-- 索引：提高按交易所查询的性能
CREATE INDEX IF NOT EXISTS idx_stock_basic_info_exchange
ON stock_basic_info (exchange);

-- ============================================
-- 注释
-- ============================================
COMMENT ON TABLE stock_basic_info IS '股票基础信息表，存储所有股票的基本信息（代码、名称、市场等）';
COMMENT ON COLUMN stock_basic_info.stock_code IS '股票代码，如 000001';
COMMENT ON COLUMN stock_basic_info.stock_name IS '股票名称';

-- ============================================
-- 批量更新指数归属（仅更新，不插入）
-- ============================================
CREATE OR REPLACE FUNCTION update_stock_basic_index_membership_batch(p_records JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    WITH input_data AS (
        SELECT
            (elem->>'id')::BIGINT AS id,
            elem->'index_membership' AS index_membership,
            (elem->>'updated_at')::TIMESTAMPTZ AS updated_at
        FROM jsonb_array_elements(p_records) AS elem
    ),
    updated AS (
        UPDATE stock_basic_info s
        SET
            index_membership = i.index_membership,
            updated_at = COALESCE(i.updated_at, NOW())
        FROM input_data i
        WHERE s.id = i.id
        RETURNING s.id
    )
    SELECT COUNT(*) INTO updated_count FROM updated;

    RETURN updated_count;
END;
$$;

-- ============================================
-- 按主键批量更新板块扩展信息（仅更新，不插入）
-- ============================================
CREATE OR REPLACE FUNCTION update_stock_basic_metadata_batch(p_records JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    WITH input_data AS (
        SELECT
            (elem->>'id')::BIGINT AS id,
            elem->>'sector' AS sector,
            elem->>'industry' AS industry,
            (elem->>'sector_confidence')::NUMERIC AS sector_confidence,
            (elem->>'updated_at')::TIMESTAMPTZ AS updated_at
        FROM jsonb_array_elements(p_records) AS elem
        WHERE elem ? 'id'
    ),
    updated AS (
        UPDATE stock_basic_info s
        SET
            sector = i.sector,
            industry = i.industry,
            sector_confidence = i.sector_confidence,
            updated_at = COALESCE(i.updated_at, NOW())
        FROM input_data i
        WHERE s.id = i.id
        RETURNING s.id
    )
    SELECT COUNT(*) INTO updated_count FROM updated;

    RETURN updated_count;
END;
$$;
COMMENT ON COLUMN stock_basic_info.market IS '市场：A-A股市场，HK-港股市场';
COMMENT ON COLUMN stock_basic_info.exchange IS '交易所：SH-上海交易所，SZ-深圳交易所，HK-香港交易所';
COMMENT ON COLUMN stock_basic_info.sector IS '一级分类（如 科技、医药、金融）';
COMMENT ON COLUMN stock_basic_info.industry IS '二级行业（如 半导体、银行）';
COMMENT ON COLUMN stock_basic_info.sector_confidence IS '行业分类置信度';
COMMENT ON COLUMN stock_basic_info.index_membership IS '指数归属，JSON数组';
COMMENT ON COLUMN stock_basic_info.last_synced_at IS '最后同步时间';

-- ============================================
-- 市场宽度（日度）
-- ============================================
CREATE TABLE IF NOT EXISTS market_breadth_daily (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    breadth_type VARCHAR(20) NOT NULL,                        -- 宽度类型: index/sector/industry
    sector VARCHAR(50) NOT NULL,                              -- 指数名称或行业名称
    total_count INTEGER NOT NULL DEFAULT 0,                   -- 板块内总股票数
    above_ma20_count INTEGER NOT NULL DEFAULT 0,              -- 高于MA20数量
    breadth_pct NUMERIC(5,2) NOT NULL DEFAULT 0,              -- 宽度比例(0-100)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_breadth_daily_unique
ON market_breadth_daily (date, breadth_type, sector);

CREATE INDEX IF NOT EXISTS idx_market_breadth_daily_date
ON market_breadth_daily (date);

COMMENT ON TABLE market_breadth_daily IS '市场宽度日度统计';
COMMENT ON COLUMN market_breadth_daily.breadth_type IS '宽度类型：index-指数，sector-一级分类，industry-二级行业';
COMMENT ON COLUMN market_breadth_daily.sector IS '指数或行业名称';
COMMENT ON COLUMN market_breadth_daily.total_count IS '板块内总股票数';
COMMENT ON COLUMN market_breadth_daily.above_ma20_count IS '高于MA20数量';
COMMENT ON COLUMN market_breadth_daily.breadth_pct IS '宽度比例(%)';



