"""斗地主游戏配置常量和设置"""

import os
from dotenv import load_dotenv

# 加载 .env 文件
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

# DeepSeek API 配置
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY', '')
DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEEPSEEK_MODEL = "deepseek-chat"
API_TIMEOUT = 15
API_MAX_RETRIES = 2

# 扑克牌花色
SUITS = ['♠', '♥', '♣', '♦']

# 扑克牌点数 (从大到小排列用于显示)
RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '小王', '大王']

# 点数权重 (越大越强)
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
CARD_STRIDE = 30  # 牌的水平间距（重叠显示）

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
