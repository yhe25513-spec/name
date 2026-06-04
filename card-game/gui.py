"""斗地主游戏GUI - Tkinter界面"""

import tkinter as tk
from tkinter import messagebox, font
import threading
from PIL import Image, ImageTk
from card import Card, sort_cards
from card_render import CardRenderer
from game_engine import GameController, GamePhase
from ai_player import DeepSeekSuperAI, SuperSmartAIPlayer
from rules import PlayHand, CardType, find_all_valid_plays
from settings import (WINDOW_WIDTH, WINDOW_HEIGHT, CARD_STRIDE, CARD_WIDTH,
                      PLAYER_NAMES, DEEPSEEK_API_KEY, COLOR_BG,
                      COLOR_TEXT, COLOR_GOLD, COLOR_GREEN)


class GameGUI:
    """斗地主游戏界面"""

    def __init__(self):
        self.root = tk.Tk()
        self.root.title("斗地主 - DeepSeek AI")
        self.root.geometry(f"{WINDOW_WIDTH}x{WINDOW_HEIGHT}")
        self.root.configure(bg=COLOR_BG)
        self.root.resizable(True, True)

        # 游戏组件
        self.game = GameController(self.on_state_change)
        self.card_renderer = CardRenderer()
        self.selected_cards = []
        self.card_buttons = []
        self.card_images = {}  # 保持图片引用

        # AI玩家
        self.ai_players = [
            DeepSeekSuperAI(1) if DEEPSEEK_API_KEY else SuperSmartAIPlayer(1),
            DeepSeekSuperAI(2) if DEEPSEEK_API_KEY else SuperSmartAIPlayer(2),
        ]

        # AI调度锁
        self._ai_bid_running = False
        self._ai_play_running = False

        # 字体
        self.title_font = font.Font(family="Arial", size=16, weight="bold")
        self.normal_font = font.Font(family="Arial", size=12)
        self.small_font = font.Font(family="Arial", size=10)

        self._build_ui()

    def _build_ui(self):
        """构建界面"""
        # 顶部标题栏
        self._build_header()

        # 主游戏区域
        self.main_frame = tk.Frame(self.root, bg=COLOR_BG)
        self.main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        # 顶部：AI玩家2
        self.top_frame = tk.Frame(self.main_frame, bg=COLOR_BG)
        self.top_frame.pack(fill=tk.X, pady=5)
        self._build_top_area()

        # 中间区域：左右AI + 中央出牌区
        self.center_frame = tk.Frame(self.main_frame, bg=COLOR_BG)
        self.center_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self._build_center_area()

        # 底部：玩家手牌
        self.bottom_frame = tk.Frame(self.main_frame, bg=COLOR_BG)
        self.bottom_frame.pack(fill=tk.X, pady=5)
        self._build_bottom_area()

        # 按钮栏
        self.button_frame = tk.Frame(self.root, bg=COLOR_BG)
        self.button_frame.pack(fill=tk.X, padx=10, pady=5)
        self._build_buttons()

        # 状态栏
        self.status_frame = tk.Frame(self.root, bg='#0a0a1a', height=40)
        self.status_frame.pack(fill=tk.X, side=tk.BOTTOM)
        self._build_status()

    def _build_header(self):
        """构建顶部标题"""
        header = tk.Frame(self.root, bg=COLOR_BG)
        header.pack(fill=tk.X, padx=10, pady=5)

        tk.Label(header, text="🃏 斗地主", font=self.title_font,
                fg=COLOR_GOLD, bg=COLOR_BG).pack(side=tk.LEFT)

        # 新游戏按钮
        self.new_game_btn = tk.Button(header, text="新游戏", font=self.normal_font,
                                     bg=COLOR_GREEN, fg='white', relief=tk.FLAT,
                                     padx=20, pady=5, command=self._on_new_game)
        self.new_game_btn.pack(side=tk.RIGHT)

        # API状态
        api_status = "✅ DeepSeek AI" if DEEPSEEK_API_KEY else "⚠️ 规则AI"
        tk.Label(header, text=api_status, font=self.small_font,
                fg=COLOR_TEXT, bg=COLOR_BG).pack(side=tk.RIGHT, padx=20)

    def _build_top_area(self):
        """构建顶部AI区域"""
        self.ai2_frame = tk.Frame(self.top_frame, bg='#1a1a3e', relief=tk.RAISED, bd=2)
        self.ai2_frame.pack(pady=10)

        tk.Label(self.ai2_frame, text=PLAYER_NAMES[2], font=self.normal_font,
                fg=COLOR_GOLD, bg='#1a1a3e').pack(pady=5)
        self.ai2_count_label = tk.Label(self.ai2_frame, text="17张", font=self.small_font,
                                        fg='white', bg='#1a1a3e')
        self.ai2_count_label.pack(pady=5)
        self.ai2_cards_frame = tk.Frame(self.ai2_frame, bg='#1a1a3e')
        self.ai2_cards_frame.pack(pady=5)

    def _build_center_area(self):
        """构建中间区域"""
        # 左侧AI1
        self.left_frame = tk.Frame(self.center_frame, bg='#1a1a3e', relief=tk.RAISED, bd=2)
        self.left_frame.pack(side=tk.LEFT, fill=tk.Y, padx=10)

        tk.Label(self.left_frame, text=PLAYER_NAMES[1], font=self.normal_font,
                fg=COLOR_GOLD, bg='#1a1a3e').pack(pady=5)
        self.ai1_count_label = tk.Label(self.left_frame, text="17张", font=self.small_font,
                                        fg='white', bg='#1a1a3e')
        self.ai1_count_label.pack(pady=5)
        self.ai1_cards_frame = tk.Frame(self.left_frame, bg='#1a1a3e')
        self.ai1_cards_frame.pack(pady=5)

        # 中央出牌区
        self.center_area = tk.Frame(self.center_frame, bg='#0f2840', relief=tk.SUNKEN, bd=3)
        self.center_area.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=10)

        tk.Label(self.center_area, text="出牌区", font=self.normal_font,
                fg=COLOR_GOLD, bg='#0f2840').pack(pady=10)

        # 显示上一手牌
        self.last_play_frame = tk.Frame(self.center_area, bg='#0f2840')
        self.last_play_frame.pack(fill=tk.BOTH, expand=True)

        # 右侧：地主牌
        self.right_frame = tk.Frame(self.center_frame, bg='#1a1a3e', relief=tk.RAISED, bd=2)
        self.right_frame.pack(side=tk.RIGHT, fill=tk.Y, padx=10)

        tk.Label(self.right_frame, text="地主牌", font=self.normal_font,
                fg=COLOR_GOLD, bg='#1a1a3e').pack(pady=5)
        self.landlord_cards_frame = tk.Frame(self.right_frame, bg='#1a1a3e')
        self.landlord_cards_frame.pack(pady=10)

    def _build_bottom_area(self):
        """构建底部玩家手牌区域"""
        self.hand_frame = tk.Frame(self.bottom_frame, bg='#1a2a4e', relief=tk.RAISED, bd=3)
        self.hand_frame.pack(fill=tk.X, padx=10, pady=10)

        # 玩家信息
        info_frame = tk.Frame(self.hand_frame, bg='#1a2a4e')
        info_frame.pack(fill=tk.X, padx=10)

        self.player_name_label = tk.Label(info_frame, text=PLAYER_NAMES[0],
                                         font=self.normal_font, fg=COLOR_GOLD, bg='#1a2a4e')
        self.player_name_label.pack(side=tk.LEFT)

        self.player_role_label = tk.Label(info_frame, text="农民",
                                         font=self.small_font, fg='white', bg='#1a2a4e')
        self.player_role_label.pack(side=tk.LEFT, padx=10)

        # 手牌区域（简单实现）
        self.hand_display_frame = tk.Frame(self.hand_frame, bg='#0a1a30', height=130)
        self.hand_display_frame.pack(fill=tk.X, padx=5, pady=5)
        self.hand_display_frame.pack_propagate(False)  # 固定高度

        self.hand_inner = tk.Frame(self.hand_display_frame, bg='#0a1a30')
        self.hand_inner.place(relx=0, rely=0, relwidth=1, relheight=1)

    def _build_buttons(self):
        """构建按钮栏"""
        # 叫分按钮（叫分阶段显示）
        self.bid_frame = tk.Frame(self.button_frame, bg=COLOR_BG)
        self.bid_frame.pack(pady=5)

        tk.Label(self.bid_frame, text="叫分:", font=self.normal_font,
                fg='white', bg=COLOR_BG).pack(side=tk.LEFT, padx=5)

        self.bid_buttons = []
        for score in [1, 2, 3]:
            btn = tk.Button(self.bid_frame, text=f"{score}分", font=self.normal_font,
                          bg=COLOR_GREEN, fg='white', relief=tk.FLAT, width=6,
                          command=lambda s=score: self._on_bid(s))
            btn.pack(side=tk.LEFT, padx=5)
            self.bid_buttons.append(btn)

        self.pass_bid_btn = tk.Button(self.bid_frame, text="不叫", font=self.normal_font,
                                     bg='#666', fg='white', relief=tk.FLAT, width=6,
                                     command=lambda: self._on_bid(0))
        self.pass_bid_btn.pack(side=tk.LEFT, padx=5)

        # 出牌按钮（出牌阶段显示）
        self.play_frame = tk.Frame(self.button_frame, bg=COLOR_BG)
        self.play_frame.pack(pady=5)

        self.play_btn = tk.Button(self.play_frame, text="出牌", font=self.normal_font,
                                 bg=COLOR_GREEN, fg='white', relief=tk.FLAT, width=8,
                                 command=self._on_play)
        self.play_btn.pack(side=tk.LEFT, padx=10)

        self.pass_btn = tk.Button(self.play_frame, text="不出", font=self.normal_font,
                                 bg='#666', fg='white', relief=tk.FLAT, width=8,
                                 command=self._on_pass)
        self.pass_btn.pack(side=tk.LEFT, padx=10)

        self.hint_btn = tk.Button(self.play_frame, text="提示", font=self.normal_font,
                                 bg='#2196F3', fg='white', relief=tk.FLAT, width=8,
                                 command=self._on_hint)
        self.hint_btn.pack(side=tk.LEFT, padx=10)

    def _build_status(self):
        """构建状态栏"""
        self.status_label = tk.Label(self.status_frame, text="点击 '新游戏' 开始",
                                    font=self.normal_font, fg='white', bg='#0a0a1a')
        self.status_label.pack(pady=8)

    def _on_new_game(self):
        """新游戏"""
        self.selected_cards = []
        self.game.start_game()
        self._update_status("发牌完成，开始叫分")

    def _on_bid(self, score: int):
        """叫分"""
        self.game.place_bid(0, score)
        # AI叫分会在 on_state_change -> _redraw 中自动处理

    def _on_play(self):
        """出牌"""
        if not self.selected_cards:
            messagebox.showwarning("提示", "请先选择要出的牌")
            return

        # 验证出牌合法性
        play = self._game_engine_rules_classify(self.selected_cards)
        if play is None:
            messagebox.showerror("错误", "这不是合法的牌型")
            return

        if self.game.state.last_play and self.game.state.pass_count < 2:
            from rules import can_beat
            if not can_beat(play, self.game.state.last_play):
                messagebox.showerror("错误", "出的牌打不过上家")
                return

        # 记录出牌给AI算牌用
        cards_to_play = list(self.selected_cards)
        for ai in self.ai_players:
            if hasattr(ai, 'record_play'):
                ai.record_play(0, cards_to_play)

        # 出牌
        self.game.play_cards(0, cards_to_play)
        self.selected_cards = []

    def _on_pass(self):
        """过牌"""
        self.game.pass_turn(0)
        self.selected_cards = []

    def _on_hint(self):
        """提示"""
        hand = self.game.state.hands[0]
        must_follow = self.game.state.last_play
        if self.game.state.pass_count >= 2:
            must_follow = None

        valid_plays = find_all_valid_plays(hand, must_follow)
        if valid_plays:
            # 选择第一个合法出牌
            self.selected_cards = list(valid_plays[0].cards)
            self._update_hand_display()
        else:
            messagebox.showinfo("提示", "没有可以出的牌")

    def _game_engine_rules_classify(self, cards):
        """调用rules模块的classify_hand"""
        from rules import classify_hand
        return classify_hand(cards)

    def on_state_change(self, state):
        """游戏状态变化回调"""
        self.root.after(0, self._redraw)

    def _redraw(self):
        """重绘界面"""
        phase = self.game.state.phase

        # 更新手牌显示
        self._update_hand_display()

        # 更新AI手牌数
        self._update_ai_displays()

        # 更新地主牌
        self._update_landlord_cards()

        # 更新出牌区
        self._update_last_play()

        # 更新按钮状态
        self._update_buttons()

        # 更新玩家角色
        self._update_player_role()

        # 处理AI回合
        if phase == GamePhase.PLAYING:
            current = self.game.state.current_player
            if current != 0:  # AI回合
                self._update_status(f"{PLAYER_NAMES[current]} 思考中...")
                self.root.after(500, self._start_ai_turn)
        elif phase == GamePhase.BIDDING:
            current = self.game.state.current_bidder
            if current != 0:  # AI叫分
                self._update_status(f"{PLAYER_NAMES[current]} 叫分中...")
                self.root.after(500, self._start_ai_bid)
        elif phase == GamePhase.GAME_OVER:
            winner = self.game.state.winner
            if winner == 0:
                self._update_status("🎉 恭喜你赢了！")
                messagebox.showinfo("游戏结束", "恭喜你赢了！")
            else:
                self._update_status(f"😔 {PLAYER_NAMES[winner]} 获胜")
                messagebox.showinfo("游戏结束", f"{PLAYER_NAMES[winner]} 获胜！")

    def _update_hand_display(self):
        """更新手牌显示"""
        # 清空
        for widget in self.hand_inner.winfo_children():
            widget.destroy()
        self.card_buttons = []
        self.card_images = {}

        hand = self.game.state.hands[0] if self.game.state.hands else []
        hand = sort_cards(hand)

        # 计算最佳间距：让牌稍微重叠但能看清
        card_width = 70  # 牌的宽度
        hand_width = len(hand) * card_width
        window_width = 1200  # 可用宽度

        # 如果牌太多，计算重叠量
        if hand_width > window_width:
            # 需要重叠：总宽度 / 牌数 = 每张牌的间距
            card_stride = (window_width - card_width) // max(len(hand) - 1, 1)
        else:
            # 不需要重叠，使用小间距
            card_stride = card_width + 2

        start_x = 10
        start_y = 5

        for i, card in enumerate(hand):
            # 获取牌图像
            selected = card in self.selected_cards
            img = self.card_renderer.get_card_image(card, selected)
            photo = ImageTk.PhotoImage(img)
            self.card_images[card] = photo

            # 创建按钮
            btn = tk.Button(self.hand_inner, image=photo, relief=tk.FLAT,
                          bg='#0a1a30', activebackground='#1a2a4e',
                          command=lambda c=card: self._toggle_card(c))
            btn.image = photo
            # 使用place定位
            x = start_x + i * card_stride
            btn.place(x=x, y=start_y)
            self.card_buttons.append(btn)

    def _toggle_card(self, card: Card):
        """切换牌的选中状态"""
        if card in self.selected_cards:
            self.selected_cards.remove(card)
        else:
            self.selected_cards.append(card)
        self._update_hand_display()

    def _update_ai_displays(self):
        """更新AI手牌显示"""
        hands = self.game.state.hands

        # AI1
        if len(hands) > 1:
            count = len(hands[1])
            self.ai1_count_label.config(text=f"{count}张")
            # 显示牌背
            for widget in self.ai1_cards_frame.winfo_children():
                widget.destroy()
            for i in range(min(count, 8)):
                img = self.card_renderer.get_card_back()
                photo = ImageTk.PhotoImage(img)
                lbl = tk.Label(self.ai1_cards_frame, image=photo, bg='#1a1a3e')
                lbl.image = photo
                lbl.pack(side=tk.LEFT, padx=1)

        # AI2
        if len(hands) > 2:
            count = len(hands[2])
            self.ai2_count_label.config(text=f"{count}张")
            for widget in self.ai2_cards_frame.winfo_children():
                widget.destroy()
            for i in range(min(count, 8)):
                img = self.card_renderer.get_card_back()
                photo = ImageTk.PhotoImage(img)
                lbl = tk.Label(self.ai2_cards_frame, image=photo, bg='#1a1a3e')
                lbl.image = photo
                lbl.pack(side=tk.LEFT, padx=1)

    def _update_landlord_cards(self):
        """更新地主牌显示"""
        for widget in self.landlord_cards_frame.winfo_children():
            widget.destroy()

        landlord_cards = self.game.state.landlord_cards
        if landlord_cards:
            for card in landlord_cards:
                img = self.card_renderer.get_card_image(card)
                photo = ImageTk.PhotoImage(img)
                lbl = tk.Label(self.landlord_cards_frame, image=photo, bg='#1a1a3e')
                lbl.image = photo
                lbl.pack(side=tk.LEFT, padx=2, pady=2)

    def _update_last_play(self):
        """更新上一手牌显示"""
        for widget in self.last_play_frame.winfo_children():
            widget.destroy()

        last_play = self.game.state.last_play
        last_player = self.game.state.last_player

        if last_play:
            # 显示玩家名
            tk.Label(self.last_play_frame,
                    text=f"{PLAYER_NAMES[last_player]} 出牌:",
                    font=self.normal_font, fg=COLOR_GOLD, bg='#0f2840').pack(pady=5)

            # 显示牌
            cards_frame = tk.Frame(self.last_play_frame, bg='#0f2840')
            cards_frame.pack(pady=10)

            for card in last_play.cards:
                img = self.card_renderer.get_card_image(card)
                photo = ImageTk.PhotoImage(img)
                lbl = tk.Label(cards_frame, image=photo, bg='#0f2840')
                lbl.image = photo
                lbl.pack(side=tk.LEFT, padx=2)

            # 显示牌型
            tk.Label(self.last_play_frame,
                    text=last_play.card_type.value,
                    font=self.normal_font, fg='white', bg='#0f2840').pack(pady=5)
        else:
            tk.Label(self.last_play_frame,
                    text="等待出牌...",
                    font=self.normal_font, fg='#666', bg='#0f2840').pack(pady=50)

    def _update_buttons(self):
        """更新按钮状态"""
        phase = self.game.state.phase
        current = self.game.state.current_player

        # 隐藏所有按钮
        self.bid_frame.pack_forget()
        self.play_frame.pack_forget()

        if phase == GamePhase.BIDDING:
            self.bid_frame.pack(pady=5)
            is_my_bid = self.game.state.current_bidder == 0
            for btn in self.bid_buttons:
                btn.config(state=tk.NORMAL if is_my_bid else tk.DISABLED)
            self.pass_bid_btn.config(state=tk.NORMAL if is_my_bid else tk.DISABLED)

        elif phase == GamePhase.PLAYING:
            self.play_frame.pack(pady=5)
            is_my_turn = current == 0

            # 如果是首次出牌或重新出牌，不能过牌
            can_pass = self.game.state.last_play is not None and self.game.state.pass_count < 2

            self.play_btn.config(state=tk.NORMAL if is_my_turn else tk.DISABLED)
            self.pass_btn.config(state=tk.NORMAL if (is_my_turn and can_pass) else tk.DISABLED)
            self.hint_btn.config(state=tk.NORMAL if is_my_turn else tk.DISABLED)

    def _update_player_role(self):
        """更新玩家角色"""
        landlord = self.game.state.landlord
        if landlord is not None:
            if landlord == 0:
                self.player_role_label.config(text="地主 👑", fg=COLOR_GOLD)
            else:
                self.player_role_label.config(text="农民 👨‍🌾", fg='white')
        else:
            self.player_role_label.config(text="", fg='white')

    def _update_status(self, text: str):
        """更新状态栏"""
        self.status_label.config(text=text)

    def _start_ai_bid(self):
        """AI叫分"""
        current = self.game.state.current_bidder
        if current == 0 or self.game.state.phase != GamePhase.BIDDING:
            return

        # 防止重复调度
        if hasattr(self, '_ai_bid_running') and self._ai_bid_running:
            return
        self._ai_bid_running = True

        def ai_bid_task():
            try:
                ai = self.ai_players[current - 1]
                hand = self.game.state.hands[current]
                game_state = self.game.get_game_state_for_player(current)
                bid = ai.decide_bid(hand, game_state)
                self.root.after(0, lambda: self._apply_ai_bid(current, bid))
            except Exception as e:
                print(f"[AI] 叫分错误: {e}")
                self._ai_bid_running = False

        threading.Thread(target=ai_bid_task, daemon=True).start()

    def _apply_ai_bid(self, player: int, bid: int):
        """应用AI叫分结果"""
        self._ai_bid_running = False
        if self.game.state.phase == GamePhase.BIDDING:
            self.game.place_bid(player, bid)

    def _start_ai_turn(self):
        """AI出牌"""
        current = self.game.state.current_player
        if current == 0 or self.game.state.phase != GamePhase.PLAYING:
            return

        # 防止重复调度
        if hasattr(self, '_ai_play_running') and self._ai_play_running:
            return
        self._ai_play_running = True

        def ai_play_task():
            try:
                ai = self.ai_players[current - 1]
                hand = self.game.state.hands[current]
                must_follow = self.game.state.last_play
                if self.game.state.pass_count >= 2:
                    must_follow = None
                game_state = self.game.get_game_state_for_player(current)

                cards = ai.decide_play(hand, must_follow, game_state)
                self.root.after(0, lambda: self._apply_ai_play(current, cards))
            except Exception as e:
                print(f"[AI] 出牌错误: {e}")
                self._ai_play_running = False

        threading.Thread(target=ai_play_task, daemon=True).start()

    def _apply_ai_play(self, player: int, cards):
        """应用AI出牌结果"""
        self._ai_play_running = False
        if self.game.state.phase == GamePhase.PLAYING:
            # 记录出牌给AI算牌用
            for ai in self.ai_players:
                if hasattr(ai, 'record_play'):
                    ai.record_play(player, cards)

            if cards is None:
                self.game.pass_turn(player)
            else:
                self.game.play_cards(player, cards)

    def run(self):
        """运行游戏"""
        self.root.mainloop()
