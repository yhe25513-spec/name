# 🃏 斗地主游戏

独立的斗地主游戏模块，使用 DeepSeek API 作为 AI 对手。

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动游戏
```bash
python 启动斗地主.py
```

或在 PyCharm 中直接运行 `启动斗地主.py`

## 功能特点

- 🎮 完整的斗地主游戏规则
- 🤖 DeepSeek API 驱动的智能 AI
- 🎨 精美的扑克牌界面
- 📊 算牌和胜率计算
- 🔄 自动读取父项目的 API 配置

## 配置说明

游戏会自动从父项目的 `.env.local` 文件读取 DeepSeek API Key。

如果需要单独配置，可以在本目录创建 `.env` 文件：
```
DEEPSEEK_API_KEY=your_api_key_here
```

## 文件结构

```
card-game/
├── 启动斗地主.py      # 启动入口
├── settings.py        # 配置文件
├── card.py           # 扑克牌数据
├── rules.py          # 游戏规则
├── game_engine.py    # 游戏引擎
├── card_render.py    # 牌面渲染
├── ai_player.py      # AI 玩家
├── gui.py            # 游戏界面
└── requirements.txt  # 依赖列表
```

## 无 API 运行

如果没有配置 DeepSeek API，游戏会自动使用基于规则的 AI，仍然可以正常游玩！
