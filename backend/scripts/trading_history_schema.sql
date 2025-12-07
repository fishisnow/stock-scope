-- 富途牛牛交易历史记录表
-- 用于存储用户从富途牛牛导入的股票交易历史数据

-- ============================================
-- 富途交易记录表
-- ============================================
CREATE TABLE IF NOT EXISTS futu_trading_records (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- 用户ID
    direction VARCHAR(10) NOT NULL,                    -- 方向: '买入' 或 '卖出'
    stock_code VARCHAR(20) NOT NULL,                   -- 股票代码
    stock_name VARCHAR(100) NOT NULL,                  -- 股票名称
    order_price DECIMAL(12, 4),                        -- 订单价格
    order_quantity INTEGER,                            -- 订单数量
    order_amount DECIMAL(16, 2),                       -- 订单金额
    trade_status VARCHAR(50),                          -- 交易状态: '全部成交', '已撤单', '部分成交' 等
    filled_quantity INTEGER,                           -- 成交数量
    filled_price DECIMAL(12, 4),                       -- 成交价格
    filled_amount DECIMAL(16, 2),                      -- 成交金额
    order_time TIMESTAMP WITH TIME ZONE,               -- 下单时间
    filled_time TIMESTAMP WITH TIME ZONE,              -- 成交时间
    total_fee DECIMAL(10, 4) DEFAULT 0,                -- 合计费用
    remarks TEXT,                                      -- 备注
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- 创建时间
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()  -- 更新时间
);

-- ============================================
-- 索引
-- ============================================

-- 用户索引：提高按用户查询的性能
CREATE INDEX IF NOT EXISTS idx_futu_trading_records_user_id 
ON futu_trading_records (user_id);

-- 股票代码索引：提高按股票代码查询的性能
CREATE INDEX IF NOT EXISTS idx_futu_trading_records_stock_code 
ON futu_trading_records (stock_code);

-- 时间索引：提高按时间查询的性能
CREATE INDEX IF NOT EXISTS idx_futu_trading_records_filled_time 
ON futu_trading_records (filled_time DESC);

-- 复合索引：用户+股票代码
CREATE INDEX IF NOT EXISTS idx_futu_trading_records_user_stock 
ON futu_trading_records (user_id, stock_code);

-- ============================================
-- RLS (行级安全策略)
-- ============================================
ALTER TABLE futu_trading_records ENABLE ROW LEVEL SECURITY;

-- 用户只能读取自己的数据
CREATE POLICY "Users can read own futu trading records" ON futu_trading_records
    FOR SELECT USING (auth.uid() = user_id);

-- 用户只能插入自己的数据
CREATE POLICY "Users can insert own futu trading records" ON futu_trading_records
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的数据
CREATE POLICY "Users can update own futu trading records" ON futu_trading_records
    FOR UPDATE USING (auth.uid() = user_id);

-- 用户只能删除自己的数据
CREATE POLICY "Users can delete own futu trading records" ON futu_trading_records
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 注释
-- ============================================
COMMENT ON TABLE futu_trading_records IS '富途牛牛交易历史记录表';
COMMENT ON COLUMN futu_trading_records.user_id IS '用户ID，关联 Supabase Auth';
COMMENT ON COLUMN futu_trading_records.direction IS '交易方向：买入/卖出';
COMMENT ON COLUMN futu_trading_records.stock_code IS '股票代码';
COMMENT ON COLUMN futu_trading_records.stock_name IS '股票名称';
COMMENT ON COLUMN futu_trading_records.order_price IS '订单价格';
COMMENT ON COLUMN futu_trading_records.order_quantity IS '订单数量';
COMMENT ON COLUMN futu_trading_records.order_amount IS '订单金额';
COMMENT ON COLUMN futu_trading_records.trade_status IS '交易状态：全部成交/部分成交/已撤单等';
COMMENT ON COLUMN futu_trading_records.filled_quantity IS '实际成交数量';
COMMENT ON COLUMN futu_trading_records.filled_price IS '成交价格';
COMMENT ON COLUMN futu_trading_records.filled_amount IS '成交金额';
COMMENT ON COLUMN futu_trading_records.order_time IS '下单时间';
COMMENT ON COLUMN futu_trading_records.filled_time IS '成交时间';
COMMENT ON COLUMN futu_trading_records.total_fee IS '合计交易费用';
COMMENT ON COLUMN futu_trading_records.remarks IS '备注';

-- ============================================
-- 股票持仓汇总视图（可选）
-- ============================================
CREATE OR REPLACE VIEW futu_stock_holdings_summary AS
SELECT 
    user_id,
    stock_code,
    stock_name,
    SUM(CASE WHEN direction = '买入' THEN filled_quantity ELSE 0 END) as total_bought,
    SUM(CASE WHEN direction = '卖出' THEN filled_quantity ELSE 0 END) as total_sold,
    SUM(CASE WHEN direction = '买入' THEN filled_quantity ELSE 0 END) - 
    SUM(CASE WHEN direction = '卖出' THEN filled_quantity ELSE 0 END) as current_holding,
    SUM(CASE WHEN direction = '买入' THEN filled_amount ELSE 0 END) as total_buy_amount,
    SUM(CASE WHEN direction = '卖出' THEN filled_amount ELSE 0 END) as total_sell_amount,
    SUM(CASE WHEN direction = '卖出' THEN filled_amount ELSE 0 END) - 
    SUM(CASE WHEN direction = '买入' THEN filled_amount ELSE 0 END) as realized_profit,
    SUM(total_fee) as total_fees,
    COUNT(*) as trade_count,
    MIN(filled_time) as first_trade_time,
    MAX(filled_time) as last_trade_time
FROM futu_trading_records
WHERE filled_quantity > 0  -- 只要有实际成交数量就计入（包含全部成交和部分成交）
GROUP BY user_id, stock_code, stock_name;

