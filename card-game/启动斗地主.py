"""
斗地主游戏启动器
在 PyCharm 中运行此文件启动游戏
"""

import sys
import os

# 设置工作目录
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 50)
print("🃏 斗地主 - DeepSeek AI 加强版")
print("=" * 50)
print()
print("正在启动游戏...")
print()

try:
    from gui import GameGUI
    app = GameGUI()
    app.run()
except ImportError as e:
    print(f"导入错误: {e}")
    print("请确保已安装依赖: pip install pillow requests")
except Exception as e:
    print(f"启动错误: {e}")
    import traceback
    traceback.print_exc()
