-- 在 Supabase SQL Editor 中执行此SQL创建斗地主游戏表

CREATE TABLE IF NOT EXISTS doudizhu_rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_code VARCHAR(8) UNIQUE NOT NULL,
    host_name TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting',
    players JSONB DEFAULT '[]'::jsonb,
    game_state JSONB,
    winner INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_code ON doudizhu_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON doudizhu_rooms(status);

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_doudizhu_rooms_modtime
    BEFORE UPDATE ON doudizhu_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

ALTER PUBLICATION supabase_realtime ADD TABLE doudizhu_rooms;
