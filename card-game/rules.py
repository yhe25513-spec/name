"""斗地主规则引擎 - 牌型判断、比较、合法出牌"""

from enum import Enum
from dataclasses import dataclass
from collections import Counter
from typing import Optional
from card import Card
from settings import RANK_POWER


class CardType(Enum):
    """牌型枚举"""
    SINGLE = "单张"
    PAIR = "对子"
    TRIPLE = "三条"
    TRIPLE_ONE = "三带一"
    TRIPLE_TWO = "三带二"
    STRAIGHT = "顺子"
    STRAIGHT_PAIR = "连对"
    AIRPLANE = "飞机"
    AIRPLANE_SINGLE = "飞机带单"
    AIRPLANE_PAIR = "飞机带对"
    BOMB = "炸弹"
    ROCKET = "火箭"
    FOUR_TWO = "四带二"
    INVALID = "非法"


@dataclass(frozen=True)
class PlayHand:
    """出牌组合"""
    cards: tuple
    card_type: CardType
    main_power: int  # 主要点数权重（用于比较）
    chain_length: int = 0  # 顺子/飞机的长度

    def __repr__(self):
        return f"{self.card_type.value}({self.main_power})"


def get_rank_power(rank: str) -> int:
    """获取点数权重"""
    return RANK_POWER.get(rank, -1)


def count_ranks(cards: list) -> dict:
    """统计每个点数出现的次数"""
    rank_count = Counter()
    for card in cards:
        rank_count[card.power] += 1
    return dict(rank_count)


def classify_hand(cards: list) -> Optional[PlayHand]:
    """
    判断一组牌的牌型
    返回 PlayHand 或 None（非法牌型）
    """
    if not cards:
        return None

    n = len(cards)
    rank_count = count_ranks(cards)
    ranks = sorted(rank_count.keys())

    # 检查火箭 (双王)
    if n == 2:
        powers = {c.power for c in cards}
        if 13 in powers and 14 in powers:  # 小王和大王
            return PlayHand(tuple(cards), CardType.ROCKET, 14)

    # 检查炸弹 (四张相同)
    if n == 4:
        for rank, count in rank_count.items():
            if count == 4:
                return PlayHand(tuple(cards), CardType.BOMB, rank)

    # 单张
    if n == 1:
        return PlayHand(tuple(cards), CardType.SINGLE, cards[0].power)

    # 对子
    if n == 2 and len(rank_count) == 1:
        rank = list(rank_count.keys())[0]
        if rank_count[rank] == 2:
            return PlayHand(tuple(cards), CardType.PAIR, rank)

    # 三条
    if n == 3 and len(rank_count) == 1:
        rank = list(rank_count.keys())[0]
        if rank_count[rank] == 3:
            return PlayHand(tuple(cards), CardType.TRIPLE, rank)

    # 三带一
    if n == 4 and len(rank_count) == 2:
        for rank, count in rank_count.items():
            if count == 3:
                return PlayHand(tuple(cards), CardType.TRIPLE_ONE, rank)

    # 三带二
    if n == 5 and len(rank_count) == 2:
        triple_rank = None
        pair_rank = None
        for rank, count in rank_count.items():
            if count == 3:
                triple_rank = rank
            elif count == 2:
                pair_rank = rank
        if triple_rank is not None and pair_rank is not None:
            return PlayHand(tuple(cards), CardType.TRIPLE_TWO, triple_rank)

    # 顺子 (5张以上连续, 3-A, 不能包含2和王)
    if n >= 5 and all(c == 1 for c in rank_count.values()):
        powers = sorted(rank_count.keys())
        # 检查是否连续且不超过A(11)
        if (powers[-1] <= 11 and  # 不超过A
            powers == list(range(powers[0], powers[0] + n))):
            return PlayHand(tuple(cards), CardType.STRAIGHT, powers[0], n)

    # 连对 (3对以上连续)
    if n >= 6 and n % 2 == 0 and all(c == 2 for c in rank_count.values()):
        powers = sorted(rank_count.keys())
        pair_count = n // 2
        if (powers[-1] <= 11 and
            powers == list(range(powers[0], powers[0] + pair_count))):
            return PlayHand(tuple(cards), CardType.STRAIGHT_PAIR, powers[0], pair_count)

    # 飞机 (2组以上连续三条)
    triple_ranks = sorted([r for r, c in rank_count.items() if c >= 3])
    if len(triple_ranks) >= 2:
        # 找最长连续三条序列
        consecutive = find_consecutive(triple_ranks)
        if consecutive and len(consecutive) >= 2:
            triple_count = len(consecutive)
            remaining = n - triple_count * 3

            # 纯飞机
            if remaining == 0:
                return PlayHand(tuple(cards), CardType.AIRPLANE, consecutive[0], triple_count)

            # 飞机带单
            if remaining == triple_count:
                return PlayHand(tuple(cards), CardType.AIRPLANE_SINGLE, consecutive[0], triple_count)

            # 飞机带对
            if remaining == triple_count * 2:
                # 检查剩余是否全是对子
                non_triple = {}
                for r, c in rank_count.items():
                    if r not in consecutive or c > 3:
                        non_triple[r] = c if r not in consecutive else c - 3
                if all(v == 2 for v in non_triple.values()) and len(non_triple) == triple_count:
                    return PlayHand(tuple(cards), CardType.AIRPLANE_PAIR, consecutive[0], triple_count)

    # 四带二
    if n == 6:
        for rank, count in rank_count.items():
            if count == 4:
                return PlayHand(tuple(cards), CardType.FOUR_TWO, rank)

    return None


def find_consecutive(powers: list) -> Optional[list]:
    """找连续序列"""
    if len(powers) < 2:
        return powers if powers else None
    # 过滤掉2(12)和王(13,14)
    valid = [p for p in powers if p <= 11]
    if len(valid) < 2:
        return None
    for i in range(len(valid)):
        seq = [valid[i]]
        for j in range(i + 1, len(valid)):
            if valid[j] == seq[-1] + 1:
                seq.append(valid[j])
            else:
                break
        if len(seq) >= 2:
            return seq
    return None


def can_beat(current: PlayHand, previous: Optional[PlayHand]) -> bool:
    """
    判断 current 是否能打过 previous
    previous 为 None 表示首次出牌
    """
    if previous is None:
        return True

    # 火箭最大
    if current.card_type == CardType.ROCKET:
        return True
    if previous.card_type == CardType.ROCKET:
        return False

    # 炸弹 vs 非炸弹
    if current.card_type == CardType.BOMB and previous.card_type != CardType.BOMB:
        return True
    if current.card_type != CardType.BOMB and previous.card_type == CardType.BOMB:
        return False

    # 同类型比较
    if current.card_type != previous.card_type:
        return False

    # 顺子/连对/飞机需要长度相同
    if current.card_type in (CardType.STRAIGHT, CardType.STRAIGHT_PAIR,
                              CardType.AIRPLANE, CardType.AIRPLANE_SINGLE,
                              CardType.AIRPLANE_PAIR):
        if current.chain_length != previous.chain_length:
            return False

    return current.main_power > previous.main_power


def find_all_valid_plays(hand: list, previous: Optional[PlayHand]) -> list:
    """
    找出手牌中所有能打过 previous 的合法出牌组合
    previous 为 None 时返回所有合法出牌
    """
    valid_plays = []
    rank_count = count_ranks(hand)
    ranks = sorted(rank_count.keys())

    if previous is None:
        # 首次出牌，所有合法牌型
        valid_plays.extend(_find_all_singles(hand, rank_count))
        valid_plays.extend(_find_all_pairs(hand, rank_count))
        valid_plays.extend(_find_all_triples(hand, rank_count))
        valid_plays.extend(_find_all_straights(hand, rank_count))
        valid_plays.extend(_find_all_bombs(hand, rank_count))
        valid_plays.extend(_find_all_rockets(hand))
    else:
        # 跟牌：同类型 + 炸弹/火箭
        if previous.card_type == CardType.SINGLE:
            valid_plays.extend(_find_singles_beat(hand, previous))
        elif previous.card_type == CardType.PAIR:
            valid_plays.extend(_find_pairs_beat(hand, previous))
        elif previous.card_type == CardType.TRIPLE:
            valid_plays.extend(_find_triples_beat(hand, previous))
        elif previous.card_type == CardType.TRIPLE_ONE:
            valid_plays.extend(_find_triple_ones_beat(hand, previous))
        elif previous.card_type == CardType.TRIPLE_TWO:
            valid_plays.extend(_find_triple_twos_beat(hand, previous))
        elif previous.card_type == CardType.STRAIGHT:
            valid_plays.extend(_find_straights_beat(hand, previous))
        elif previous.card_type == CardType.STRAIGHT_PAIR:
            valid_plays.extend(_find_straight_pairs_beat(hand, previous))
        elif previous.card_type == CardType.BOMB:
            valid_plays.extend(_find_bombs_beat(hand, previous))

        # 所有情况都可以出炸弹和火箭（除非previous是更大的炸弹或火箭）
        if previous.card_type != CardType.ROCKET:
            if previous.card_type != CardType.BOMB:
                valid_plays.extend(_find_all_bombs(hand, rank_count))
            valid_plays.extend(_find_all_rockets(hand))

    return valid_plays


def _find_all_singles(hand, rank_count):
    """找出所有单张"""
    result = []
    seen = set()
    for card in hand:
        if card.power not in seen:
            seen.add(card.power)
            result.append(PlayHand((card,), CardType.SINGLE, card.power))
    return result


def _find_singles_beat(hand, previous):
    """找能打过指定单张的牌"""
    result = []
    seen = set()
    for card in hand:
        if card.power > previous.main_power and card.power not in seen:
            seen.add(card.power)
            result.append(PlayHand((card,), CardType.SINGLE, card.power))
    return result


def _find_all_pairs(hand, rank_count):
    """找出所有对子"""
    result = []
    for rank, count in rank_count.items():
        if count >= 2:
            cards = [c for c in hand if c.power == rank][:2]
            result.append(PlayHand(tuple(cards), CardType.PAIR, rank))
    return result


def _find_pairs_beat(hand, previous):
    """找能打过指定对子的牌"""
    result = []
    rank_count = count_ranks(hand)
    for rank, count in rank_count.items():
        if count >= 2 and rank > previous.main_power:
            cards = [c for c in hand if c.power == rank][:2]
            result.append(PlayHand(tuple(cards), CardType.PAIR, rank))
    return result


def _find_all_triples(hand, rank_count):
    """找出所有三条"""
    result = []
    for rank, count in rank_count.items():
        if count >= 3:
            cards = [c for c in hand if c.power == rank][:3]
            result.append(PlayHand(tuple(cards), CardType.TRIPLE, rank))
    return result


def _find_triples_beat(hand, previous):
    """找能打过指定三条的牌"""
    result = []
    rank_count = count_ranks(hand)
    for rank, count in rank_count.items():
        if count >= 3 and rank > previous.main_power:
            cards = [c for c in hand if c.power == rank][:3]
            result.append(PlayHand(tuple(cards), CardType.TRIPLE, rank))
    return result


def _find_triple_ones_beat(hand, previous):
    """找能打过指定三带一的牌"""
    result = []
    rank_count = count_ranks(hand)
    # 找所有能打过的三条
    for rank, count in rank_count.items():
        if count >= 3 and rank > previous.main_power:
            triple_cards = [c for c in hand if c.power == rank][:3]
            # 带一张其他牌
            for other_rank, other_count in rank_count.items():
                if other_rank != rank and other_count >= 1:
                    kicker = [c for c in hand if c.power == other_rank][0]
                    result.append(PlayHand(tuple(triple_cards + [kicker]),
                                          CardType.TRIPLE_ONE, rank))
                    break  # 只带最小的
    return result


def _find_triple_twos_beat(hand, previous):
    """找能打过指定三带二的牌"""
    result = []
    rank_count = count_ranks(hand)
    for rank, count in rank_count.items():
        if count >= 3 and rank > previous.main_power:
            triple_cards = [c for c in hand if c.power == rank][:3]
            # 带一对
            for other_rank, other_count in rank_count.items():
                if other_rank != rank and other_count >= 2:
                    kicker = [c for c in hand if c.power == other_rank][:2]
                    result.append(PlayHand(tuple(triple_cards + kicker),
                                          CardType.TRIPLE_TWO, rank))
                    break
    return result


def _find_all_straights(hand, rank_count):
    """找出所有顺子"""
    result = []
    valid_ranks = sorted([r for r in rank_count.keys() if r <= 11])

    for length in range(5, len(valid_ranks) + 1):
        for i in range(len(valid_ranks) - length + 1):
            seq = valid_ranks[i:i+length]
            if seq == list(range(seq[0], seq[0] + length)):
                cards = []
                for r in seq:
                    cards.extend([c for c in hand if c.power == r][:1])
                result.append(PlayHand(tuple(cards), CardType.STRAIGHT, seq[0], length))
    return result


def _find_straights_beat(hand, previous):
    """找能打过指定顺子的牌"""
    result = []
    rank_count = count_ranks(hand)
    length = previous.chain_length
    valid_ranks = sorted([r for r in rank_count.keys() if r <= 11])

    for i in range(len(valid_ranks) - length + 1):
        seq = valid_ranks[i:i+length]
        if (len(seq) == length and
            seq == list(range(seq[0], seq[0] + length)) and
            seq[0] > previous.main_power):
            cards = []
            for r in seq:
                cards.extend([c for c in hand if c.power == r][:1])
            result.append(PlayHand(tuple(cards), CardType.STRAIGHT, seq[0], length))
    return result


def _find_straight_pairs_beat(hand, previous):
    """找能打过指定连对的牌"""
    result = []
    rank_count = count_ranks(hand)
    length = previous.chain_length
    valid_ranks = sorted([r for r in rank_count.keys() if r <= 11 and rank_count[r] >= 2])

    for i in range(len(valid_ranks) - length + 1):
        seq = valid_ranks[i:i+length]
        if (len(seq) == length and
            seq == list(range(seq[0], seq[0] + length)) and
            seq[0] > previous.main_power):
            cards = []
            for r in seq:
                cards.extend([c for c in hand if c.power == r][:2])
            result.append(PlayHand(tuple(cards), CardType.STRAIGHT_PAIR, seq[0], length))
    return result


def _find_all_bombs(hand, rank_count):
    """找出所有炸弹"""
    result = []
    for rank, count in rank_count.items():
        if count == 4:
            cards = [c for c in hand if c.power == rank]
            result.append(PlayHand(tuple(cards), CardType.BOMB, rank))
    return result


def _find_bombs_beat(hand, previous):
    """找能打过指定炸弹的牌"""
    result = []
    rank_count = count_ranks(hand)
    for rank, count in rank_count.items():
        if count == 4 and rank > previous.main_power:
            cards = [c for c in hand if c.power == rank]
            result.append(PlayHand(tuple(cards), CardType.BOMB, rank))
    return result


def _find_all_rockets(hand):
    """找出火箭"""
    jokers = [c for c in hand if c.rank in ('小王', '大王')]
    if len(jokers) == 2:
        return [PlayHand(tuple(jokers), CardType.ROCKET, 14)]
    return []
