"""斗地主游戏配置 - 独立模块"""

import os


# 从父项目的 .env.local 读取配置
def _load_env():
    """加载环境变量"""
    env_paths = [
        os.path.join(os.path.dirname(__file__), '..', '.env.local'),
        os.path.join(os.path.dirname(__file__), '..', '.env'),
        os.path.join(os.path.dirname(__file__), '.env'),
    ]

    for env_path in env_paths:
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if '=' in line and not line.startswith('#'):
                        key, value = line.split('=', 1)
                        os.environ[key.strip()] = value.strip()
            break


_load_env()

# DeepSeek API 配置 (从 .env.local 读取)
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY', '')
DEEPSEEK_BASE_URL = os.getenv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com')
DEEPSEEK_MODEL = 'deepseek-chat'
API_TIMEOUT = 15
API_MAX_RETRIES = 2

# Supabase 配置 (从 .env.local 读取)
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL', '')
SUPABASE_ANON_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')

# 扑克牌花色
SUITS = ['♠', '♥', '♣', '♦']

# 扑克牌点数
RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '小王', '大王']

# 点数权重
RANK_POWER = {
    '3': 0, '4': 1, '5': 2, '6': 3, '7': 4,
    '8': 5, '9': 6, '10': 7, 'J': 8, 'Q': 9,
    'K': 10, 'A': 11, '2': 12, '小王': 13, '大王': 14
}

# GUI 配置
WINDOW_WIDTH = 1300
WINDOW_HEIGHT = 800
CARD_WIDTH = 70
CARD_HEIGHT = 100
CARD_STRIDE = 30

# 颜色配置
COLOR_BG = '#1a1a2e'
COLOR_CARD_BACK = '#16213e'
COLOR_CARD_FRONT = '#ffffff'
COLOR_TEXT = '#e94560'
COLOR_GREEN = '#0f3460'
COLOR_GOLD = '#f1c40f'
COLOR_BUTTON = '#e94560'
COLOR_BUTTON_HOVER = '#c0392b'

# 玩家名称
PLAYER_NAMES = ['你', '电脑1', '电脑2']
