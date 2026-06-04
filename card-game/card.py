"""扑克牌数据模型"""

from dataclasses import dataclass
import random
from settings import SUITS, RANKS, RANK_POWER


@dataclass(frozen=True)
class Card:
    """扑克牌类 (不可变)"""
    suit: str  # ♠, ♥, ♣, ♦, '' (小王大王)
    rank: str  # '3'..'2', '小王', '大王'

    @property
    def power(self) -> int:
        """返回点数权重"""
        return RANK_POWER.get(self.rank, -1)

    @property
    def display_name(self) -> str:
        """返回显示名称"""
        if self.rank in ('小王', '大王'):
            return '🃏'
        return f"{self.suit}{self.rank}"

    @property
    def short_name(self) -> str:
        """返回简短名称"""
        return self.rank

    def __repr__(self):
        return self.display_name

    def __str__(self):
        return self.display_name


class Deck:
    """扑克牌组"""

    def __init__(self):
        self.cards = []
        self._init_deck()

    def _init_deck(self):
        """初始化54张牌"""
        self.cards = []
        # 普通牌
        for suit in SUITS:
            for rank in RANKS[:-2]:  # 3 到 2
                self.cards.append(Card(suit, rank))
        # 大小王
        self.cards.append(Card('', '小王'))
        self.cards.append(Card('', '大王'))

    def shuffle(self):
        """洗牌"""
        random.shuffle(self.cards)

    def deal(self) -> tuple:
        """
        发牌：返回 (玩家1手牌, 玩家2手牌, 玩家3手牌, 地主牌)
        每人17张，剩3张给地主
        """
        self.shuffle()
        hand1 = sorted(self.cards[0:17], key=lambda c: c.power)
        hand2 = sorted(self.cards[17:34], key=lambda c: c.power)
        hand3 = sorted(self.cards[34:51], key=lambda c: c.power)
        landlord_cards = self.cards[51:54]
        return hand1, hand2, hand3, landlord_cards


def sort_cards(cards: list) -> list:
    """按点数权重排序牌"""
    return sorted(cards, key=lambda c: (c.power, c.suit))
