"""斗地主游戏引擎 - 游戏状态机"""

from enum import Enum
from dataclasses import dataclass, field
from typing import Optional, Callable
from card import Card, Deck, sort_cards
from rules import PlayHand, classify_hand, can_beat, find_all_valid_plays


class GamePhase(Enum):
    """游戏阶段"""
    WAITING = 0
    DEALING = 1
    BIDDING = 2
    PLAYING = 3
    GAME_OVER = 4


@dataclass
class GameState:
    """游戏状态"""
    phase: GamePhase = GamePhase.WAITING
    hands: list = field(default_factory=list)  # 3个玩家的手牌
    landlord: Optional[int] = None  # 地主玩家索引
    landlord_cards: list = field(default_factory=list)  # 3张地主牌
    current_player: int = 0  # 当前出牌玩家
    last_play: Optional[PlayHand] = None  # 上一手牌
    last_player: Optional[int] = None  # 上一手牌的玩家
    pass_count: int = 0  # 连续过牌次数
    bid_scores: list = field(default_factory=lambda: [None, None, None])  # 叫分
    current_bidder: int = 0  # 当前叫分玩家
    bids_completed: int = 0  # 已叫分人数
    bomb_count: int = 0  # 炸弹计数（翻倍用）
    winner: Optional[int] = None  # 获胜玩家
    play_history: list = field(default_factory=list)  # 出牌历史


class GameController:
    """游戏控制器"""

    def __init__(self, on_state_change: Optional[Callable] = None):
        self.state = GameState()
        self.deck = Deck()
        self.on_state_change = on_state_change

    def _notify(self):
        """通知状态变化"""
        if self.on_state_change:
            self.on_state_change(self.state)

    def start_game(self):
        """开始新游戏 - 发牌"""
        self.state = GameState()
        self.deck = Deck()
        hands = self.deck.deal()
        self.state.hands = [list(hands[0]), list(hands[1]), list(hands[2])]
        self.state.landlord_cards = list(hands[3])
        self.state.phase = GamePhase.BIDDING
        # 随机决定谁先叫分
        self.state.current_bidder = __import__('random').randint(0, 2)
        self._notify()

    def place_bid(self, player: int, score: int) -> bool:
        """
        叫分
        score: 0=不叫, 1/2/3=叫分
        """
        if self.state.phase != GamePhase.BIDDING:
            return False
        if player != self.state.current_bidder:
            return False

        self.state.bid_scores[player] = score
        self.state.bids_completed += 1

        # 如果叫了3分，直接成为地主
        if score == 3:
            self._set_landlord(player)
            self._notify()
            return True

        # 下一个叫分
        self.state.current_bidder = (player + 1) % 3

        # 所有人都叫完
        if self.state.bids_completed >= 3:
            # 找最高分 (过滤None)
            valid_scores = [s for s in self.state.bid_scores if s is not None]
            if not valid_scores:
                max_score = 0
            else:
                max_score = max(valid_scores)

            if max_score == 0:
                # 都不叫，重新发牌
                self.start_game()
            else:
                # 最高分者成为地主
                for i, s in enumerate(self.state.bid_scores):
                    if s == max_score:
                        self._set_landlord(i)
                        break

        self._notify()
        return True

    def _set_landlord(self, player: int):
        """设置地主"""
        self.state.landlord = player
        # 地主获得3张牌
        self.state.hands[player].extend(self.state.landlord_cards)
        self.state.hands[player] = sort_cards(self.state.hands[player])
        # 地主先出牌
        self.state.current_player = player
        self.state.phase = GamePhase.PLAYING

    def play_cards(self, player: int, cards: list) -> bool:
        """
        出牌
        返回是否成功
        """
        if self.state.phase != GamePhase.PLAYING:
            return False
        if player != self.state.current_player:
            return False

        # 首次出牌
        if self.state.last_play is None or self.state.pass_count >= 2:
            play = classify_hand(cards)
            if play is None:
                return False
        else:
            play = classify_hand(cards)
            if play is None:
                return False
            if not can_beat(play, self.state.last_play):
                return False

        # 从手牌中移除
        for card in cards:
            self.state.hands[player].remove(card)

        self.state.last_play = play
        self.state.last_player = player
        self.state.pass_count = 0

        # 记录炸弹
        from rules import CardType
        if play.card_type in (CardType.BOMB, CardType.ROCKET):
            self.state.bomb_count += 1

        self.state.play_history.append((player, play))

        # 检查是否获胜
        if len(self.state.hands[player]) == 0:
            self.state.winner = player
            self.state.phase = GamePhase.GAME_OVER
        else:
            self.state.current_player = (player + 1) % 3

        self._notify()
        return True

    def pass_turn(self, player: int):
        """过牌"""
        if self.state.phase != GamePhase.PLAYING:
            return
        if player != self.state.current_player:
            return

        self.state.pass_count += 1
        self.state.play_history.append((player, None))

        # 连续2人过牌，下一个人重新出牌
        if self.state.pass_count >= 2:
            self.state.last_play = None
            self.state.pass_count = 0

        self.state.current_player = (player + 1) % 3
        self._notify()

    def get_game_state_for_player(self, player: int) -> dict:
        """获取特定玩家视角的游戏状态"""
        return {
            'phase': self.state.phase,
            'hand': self.state.hands[player] if player < len(self.state.hands) else [],
            'hand_count': [len(h) for h in self.state.hands],
            'landlord': self.state.landlord,
            'landlord_cards': self.state.landlord_cards,
            'current_player': self.state.current_player,
            'last_play': self.state.last_play,
            'last_player': self.state.last_player,
            'pass_count': self.state.pass_count,
            'bid_scores': self.state.bid_scores,
            'current_bidder': self.state.current_bidder,
            'bomb_count': self.state.bomb_count,
            'winner': self.state.winner,
            'play_history': self.state.play_history[-10:],  # 最近10手
        }
