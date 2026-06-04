"""超强AI玩家 - 算牌 + 胜率计算 + DeepSeek API"""

import json
import requests
from typing import Optional, List, Dict, Tuple
from collections import Counter
from card import Card, sort_cards
from rules import (PlayHand, classify_hand, can_beat, find_all_valid_plays,
                   CardType, count_ranks)
from settings import (DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL,
                      API_TIMEOUT, API_MAX_RETRIES, RANK_POWER)


class AIPlayer:
    """AI玩家基类"""

    def __init__(self, player_index: int):
        self.player_index = player_index

    def decide_bid(self, hand: list, game_state: dict) -> int:
        raise NotImplementedError

    def decide_play(self, hand: list, must_follow: Optional[PlayHand],
                    game_state: dict) -> Optional[list]:
        raise NotImplementedError


class CardCounter:
    """算牌器 - 跟踪已出的牌"""

    def __init__(self):
        self.reset()

    def reset(self):
        """重置算牌器"""
        # 所有54张牌
        self.all_cards = []
        for suit in ['♠', '♥', '♣', '♦']:
            for rank in ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']:
                self.all_cards.append(Card(suit, rank))
        self.all_cards.append(Card('', '小王'))
        self.all_cards.append(Card('', '大王'))

        # 已出的牌
        self.played_cards: List[Card] = []

        # 各玩家手牌数
        self.hand_counts = [17, 17, 17]

    def record_play(self, player: int, cards: List[Card]):
        """记录出牌"""
        if cards:
            self.played_cards.extend(cards)
            self.hand_counts[player] -= len(cards)

    def get_remaining_cards(self) -> List[Card]:
        """获取剩余的牌"""
        remaining = list(self.all_cards)
        for card in self.played_cards:
            if card in remaining:
                remaining.remove(card)
        return remaining

    def get_remaining_count(self) -> Dict[int, int]:
        """获取各点数剩余数量"""
        remaining = self.get_remaining_cards()
        return count_ranks(remaining)

    def estimate_hand(self, player: int, known_cards: List[Card]) -> Dict[int, int]:
        """估算对手手牌"""
        remaining = self.get_remaining_cards()
        # 移除自己已知的牌
        for card in known_cards:
            if card in remaining:
                remaining.remove(card)
        return count_ranks(remaining)

    def calculate_bomb_probability(self) -> float:
        """计算炸弹概率"""
        remaining = self.get_remaining_cards()
        rank_count = count_ranks(remaining)
        bombs = sum(1 for count in rank_count.values() if count >= 4)
        return bombs / max(len(remaining), 1)


class WinRateCalculator:
    """胜率计算器"""

    def __init__(self, card_counter: CardCounter):
        self.counter = card_counter

    def estimate_win_rate(self, hand: List[Card], is_landlord: bool,
                          hand_counts: List[int], player_index: int = 0) -> float:
        """估算胜率 (0-1)"""
        score = 0.5  # 基础胜率

        # 手牌数量优势
        my_count = len(hand)
        avg_others = sum(hand_counts) / max(len(hand_counts) - 1, 1)
        if my_count < avg_others:
            score += 0.1
        elif my_count > avg_others:
            score -= 0.1

        # 手牌质量
        hand_score = self._evaluate_hand_quality(hand)
        score += (hand_score - 50) / 200  # 归一化

        # 地主/农民修正
        if is_landlord:
            score += 0.05  # 地主略占优
        else:
            # 农民有配合优势
            teammate_count = sum(1 for i, c in enumerate(hand_counts)
                                if i != player_index and c < 10)
            score += teammate_count * 0.05

        return max(0.1, min(0.9, score))

    def _evaluate_hand_quality(self, hand: List[Card]) -> float:
        """评估手牌质量 (0-100)"""
        score = 50
        rank_count = count_ranks(hand)

        # 大牌加分
        for card in hand:
            if card.rank == '大王':
                score += 15
            elif card.rank == '小王':
                score += 10
            elif card.rank == '2':
                score += 5
            elif card.rank in ('A', 'K'):
                score += 2

        # 炸弹加分
        for count in rank_count.values():
            if count == 4:
                score += 20

        # 顺子/连对加分
        powers = sorted([r for r in rank_count.keys() if r <= 11])
        if len(powers) >= 5:
            consecutive = self._find_longest_consecutive(powers)
            if consecutive >= 5:
                score += consecutive * 2

        return min(100, score)

    def _find_longest_consecutive(self, powers: List[int]) -> int:
        """找最长连续序列"""
        if not powers:
            return 0
        max_len = 1
        current_len = 1
        for i in range(1, len(powers)):
            if powers[i] == powers[i-1] + 1:
                current_len += 1
                max_len = max(max_len, current_len)
            else:
                current_len = 1
        return max_len


class SuperSmartAIPlayer(AIPlayer):
    """超强AI - 算牌 + 胜率计算 + 策略出牌"""

    def __init__(self, player_index: int):
        super().__init__(player_index)
        self.card_counter = CardCounter()
        self.win_calculator = WinRateCalculator(self.card_counter)
        self.play_history = []  # 出牌历史

        # 牌力权重
        self.card_weights = {
            '3': 1, '4': 1, '5': 1, '6': 1, '7': 1,
            '8': 2, '9': 2, '10': 2, 'J': 3, 'Q': 3,
            'K': 4, 'A': 5, '2': 8, '小王': 10, '大王': 12
        }

    def reset(self):
        """重置AI状态"""
        self.card_counter.reset()
        self.play_history = []

    def record_play(self, player: int, cards: List[Card]):
        """记录出牌"""
        self.card_counter.record_play(player, cards)
        self.play_history.append((player, cards))

    def decide_bid(self, hand: list, game_state: dict) -> int:
        """智能叫分 - 基于手牌质量和胜率估算"""
        score = self._evaluate_hand_for_bid(hand)

        # 估算胜率
        hand_counts = game_state.get('hand_count', [17, 17, 17])
        win_rate = self.win_calculator.estimate_win_rate(hand, False, hand_counts, self.player_index)

        # 综合评分
        total_score = score + win_rate * 10

        if total_score >= 25:
            return 3
        elif total_score >= 18:
            return 2
        elif total_score >= 12:
            return 1
        return 0

    def _evaluate_hand_for_bid(self, hand: list) -> int:
        """评估手牌强度用于叫分 (0-30分)"""
        score = 0
        rank_count = count_ranks(hand)

        # 基础牌力
        for card in hand:
            score += self.card_weights.get(card.rank, 0)

        # 炸弹加分
        for rank, count in rank_count.items():
            if count == 4:
                score += 8

        # 大小王组合
        has_big = any(c.rank == '大王' for c in hand)
        has_small = any(c.rank == '小王' for c in hand)
        if has_big and has_small:
            score += 10
        elif has_big:
            score += 6
        elif has_small:
            score += 4

        return min(score, 30)

    def decide_play(self, hand: list, must_follow: Optional[PlayHand],
                    game_state: dict) -> Optional[list]:
        """超强出牌策略"""
        # 更新算牌器
        for player, cards in game_state.get('play_history', []):
            if cards and (player, cards) not in self.play_history:
                self.record_play(player, cards)

        valid_plays = find_all_valid_plays(hand, must_follow)
        if not valid_plays:
            return None

        # 获取游戏状态
        is_landlord = game_state.get('landlord') == self.player_index
        hand_counts = game_state.get('hand_count', [])
        my_hand_count = len(hand)

        # 计算胜率
        win_rate = self.win_calculator.estimate_win_rate(hand, is_landlord, hand_counts, self.player_index)

        # 分析剩余牌
        remaining_count = self.card_counter.get_remaining_count()

        # 首出策略
        if must_follow is None:
            return self._lead_play(hand, valid_plays, is_landlord,
                                   hand_counts, my_hand_count, win_rate, remaining_count)

        # 跟牌策略
        return self._follow_play(hand, valid_plays, must_follow, is_landlord,
                                 hand_counts, my_hand_count, win_rate, remaining_count)

    def _lead_play(self, hand, valid_plays, is_landlord, hand_counts,
                   my_hand_count, win_rate, remaining_count):
        """首出策略"""
        # 如果手牌很少（<=3张），尝试一次出完
        if my_hand_count <= 3:
            for play in valid_plays:
                if len(play.cards) == my_hand_count:
                    return list(play.cards)

        # 计算各种牌型的价值
        scored_plays = []
        for play in valid_plays:
            score = self._evaluate_lead_play(play, hand, is_landlord,
                                            hand_counts, my_hand_count, win_rate, hand_counts)
            scored_plays.append((score, play))

        # 按分数排序，选择最佳
        scored_plays.sort(key=lambda x: x[0], reverse=True)
        return list(scored_plays[0][1].cards)

    def _evaluate_lead_play(self, play, hand, is_landlord, hand_counts,
                           my_hand_count, win_rate, landlord=None):
        """评估首出牌的价值"""
        score = 0
        card_type = play.card_type
        power = play.main_power

        # 基础分：出小牌更好
        if card_type == CardType.SINGLE:
            score = 100 - power * 5
        elif card_type == CardType.PAIR:
            score = 90 - power * 4
        elif card_type in (CardType.TRIPLE_ONE, CardType.TRIPLE_TWO):
            score = 80 - power * 3
        elif card_type == CardType.STRAIGHT:
            score = 70 + play.chain_length * 5 - power * 2
        elif card_type == CardType.STRAIGHT_PAIR:
            score = 65 + play.chain_length * 5 - power * 2
        elif card_type == CardType.BOMB:
            # 炸弹一般不首出，除非快赢了
            if my_hand_count <= 4:
                score = 150
            else:
                score = 20
        elif card_type == CardType.ROCKET:
            if my_hand_count <= 2:
                score = 200
            else:
                score = 30
        else:
            score = 50

        # 手牌数量修正：手牌少时更积极
        if my_hand_count <= 5:
            score += 30
        elif my_hand_count <= 10:
            score += 15

        # 胜率修正
        score += win_rate * 20

        # 地主/农民修正
        if is_landlord:
            score += 10  # 地主更积极
        else:
            # 农民配合：如果队友手牌少，更积极
            for i, count in enumerate(hand_counts):
                if i != self.player_index and i != landlord:
                    if count <= 5:
                        score += 20  # 帮队友

        return score

    def _follow_play(self, hand, valid_plays, must_follow, is_landlord,
                     hand_counts, my_hand_count, win_rate, remaining_count):
        """跟牌策略"""
        # 分类：能打过的非炸弹牌
        non_bombs = [p for p in valid_plays
                     if p.card_type not in (CardType.BOMB, CardType.ROCKET)]
        bombs = [p for p in valid_plays if p.card_type == CardType.BOMB]
        rockets = [p for p in valid_plays if p.card_type == CardType.ROCKET]

        # 评估每个选择
        best_play = None
        best_score = -1000

        # 评估过牌
        pass_score = self._evaluate_pass(hand, must_follow, is_landlord,
                                        hand_counts, my_hand_count, win_rate)
        if pass_score > best_score:
            best_score = pass_score
            best_play = None

        # 评估非炸弹出牌
        for play in non_bombs:
            score = self._evaluate_follow_play(play, hand, must_follow, is_landlord,
                                              hand_counts, my_hand_count, win_rate)
            if score > best_score:
                best_score = score
                best_play = play

        # 评估炸弹（一般不用）
        for play in bombs:
            score = self._evaluate_bomb_play(play, hand, must_follow, is_landlord,
                                            hand_counts, my_hand_count, win_rate)
            if score > best_score:
                best_score = score
                best_play = play

        # 评估火箭
        for play in rockets:
            score = self._evaluate_rocket_play(play, hand, must_follow, is_landlord,
                                              hand_counts, my_hand_count, win_rate)
            if score > best_score:
                best_score = score
                best_play = play

        if best_play is None:
            return None
        return list(best_play.cards)

    def _evaluate_pass(self, hand, must_follow, is_landlord, hand_counts,
                      my_hand_count, win_rate):
        """评估过牌的价值"""
        score = 0

        # 手牌多时更愿意过牌
        score += my_hand_count * 2

        # 上家出的大牌更愿意过
        if must_follow:
            score += must_follow.main_power * 3

        # 地主一般不过牌
        if is_landlord:
            score -= 30

        # 农民：如果队友出的牌，可以过
        # 这里简化处理，实际应该判断出牌者

        return score

    def _evaluate_follow_play(self, play, hand, must_follow, is_landlord,
                             hand_counts, my_hand_count, win_rate):
        """评估跟牌的价值"""
        score = 0

        # 出小牌更好
        score = 100 - play.main_power * 5

        # 手牌数量：手牌少时更积极
        if my_hand_count <= 5:
            score += 40
        elif my_hand_count <= 10:
            score += 20

        # 地主：对手手牌少时更积极
        if is_landlord:
            for i, count in enumerate(hand_counts):
                if i != self.player_index and count <= 3:
                    score += 50  # 对手快赢了

        # 农民：队友手牌少时更积极
        if not is_landlord:
            for i, count in enumerate(hand_counts):
                if i != self.player_index and count <= 5:
                    score += 30  # 帮队友

        return score

    def _evaluate_bomb_play(self, play, hand, must_follow, is_landlord,
                           hand_counts, my_hand_count, win_rate):
        """评估炸弹的价值"""
        score = 0

        # 炸弹很珍贵，一般不用
        score = -50

        # 手牌很少时用炸弹
        if my_hand_count <= 4:
            score += 80

        # 对手快赢时用炸弹
        for i, count in enumerate(hand_counts):
            if i != self.player_index and count <= 2:
                score += 100

        # 胜率低时更愿意用炸弹
        if win_rate < 0.4:
            score += 30

        return score

    def _evaluate_rocket_play(self, play, hand, must_follow, is_landlord,
                             hand_counts, my_hand_count, win_rate):
        """评估火箭的价值"""
        score = 0

        # 火箭是最大的牌，很珍贵
        score = -30

        # 手牌很少时用火箭
        if my_hand_count <= 2:
            score += 100

        # 对手快赢时用火箭
        for i, count in enumerate(hand_counts):
            if i != self.player_index and count <= 2:
                score += 120

        # 胜率很低时用火箭
        if win_rate < 0.3:
            score += 50

        return score


class DeepSeekSuperAI(AIPlayer):
    """使用DeepSeek API的超强AI"""

    SYSTEM_PROMPT = """你是世界顶级的斗地主AI玩家，精通算牌、概率计算和策略分析。

牌力排序:
3(0) < 4(1) < 5(2) < 6(3) < 7(4) < 8(5) < 9(6) < 10(7) < J(8) < Q(9) < K(10) < A(11) < 2(12) < 小王(13) < 大王(14)

牌型:
- SINGLE: 单张
- PAIR: 对子
- TRIPLE: 三条
- TRIPLE_ONE: 三带一
- TRIPLE_TWO: 三带二
- STRAIGHT: 顺子 (5+连续, 3到A)
- STRAIGHT_PAIR: 连对 (3+连续对)
- AIRPLANE: 飞机 (2+连续三条)
- BOMB: 炸弹 (4同)
- ROCKET: 火箭 (双王)

核心策略:
1. 算牌：跟踪已出的牌，估算对手手牌
2. 概率：计算各种出牌的胜率
3. 配合：农民要配合队友，不要互相压制
4. 控制：保留大牌控制关键局面
5. 炸弹：只在关键时刻使用（对手快赢或自己快赢时）

你的回复必须是JSON格式:
{"action": "play" 或 "pass", "cards": ["牌1", "牌2"] 或 null, "reason": "简短说明策略"}"""

    def __init__(self, player_index: int, api_key: str = None):
        super().__init__(player_index)
        self.api_key = api_key or DEEPSEEK_API_KEY
        self.base_url = DEEPSEEK_BASE_URL
        self.model = DEEPSEEK_MODEL
        self.timeout = API_TIMEOUT
        self.fallback = SuperSmartAIPlayer(player_index)

    def _call_api(self, system_prompt: str, user_prompt: str) -> str:
        """调用DeepSeek API"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.2,  # 低温度更稳定
            "max_tokens": 600,
        }

        for attempt in range(API_MAX_RETRIES):
            try:
                response = requests.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=self.timeout
                )
                response.raise_for_status()
                return response.json()["choices"][0]["message"]["content"]
            except Exception as e:
                if attempt == API_MAX_RETRIES - 1:
                    raise
                continue

    def _build_play_prompt(self, hand: list, must_follow: Optional[PlayHand],
                           game_state: dict) -> str:
        """构建超强出牌提示"""
        hand_str = json.dumps([c.display_name for c in hand], ensure_ascii=False)

        # 分析手牌
        rank_count = {}
        for card in hand:
            rank_count[card.short_name] = rank_count.get(card.short_name, 0) + 1

        # 分析游戏状态
        role = "地主" if game_state.get('landlord') == self.player_index else "农民"
        hand_counts = game_state.get('hand_count', [])
        landlord = game_state.get('landlord')

        # 计算胜率
        win_rate = self.fallback.win_calculator.estimate_win_rate(
            hand, role == "地主", hand_counts, self.player_index
        )

        # 分析剩余牌
        remaining = self.fallback.card_counter.get_remaining_count()
        remaining_str = json.dumps(remaining, ensure_ascii=False)

        if must_follow:
            last_play_str = json.dumps([c.display_name for c in must_follow.cards],
                                      ensure_ascii=False)
            must_beat = f"""上家出了: {last_play_str}
牌型: {must_follow.card_type.value}
你必须出同类型但更大的牌，或者炸弹/火箭"""
        else:
            must_beat = "你是首出，可以出任意合法牌型"

        # 出牌历史
        history_str = ""
        if game_state.get('play_history'):
            last_moves = game_state['play_history'][-8:]
            history_str = "\n最近出牌历史:\n" + "\n".join([
                f"玩家{p}: {[c.display_name for c in play.cards] if play else '过牌'}"
                for p, play in last_moves
            ])

        # 农民配合信息
        partner_info = ""
        if role == "农民":
            for i, count in enumerate(hand_counts):
                if i != self.player_index and i != landlord:
                    partner_info = f"\n队友手牌数: {count}张"

        return f"""=== 斗地主AI决策分析 ===

身份: {role}
手牌: {hand_str}
手牌数: {len(hand)}
剩余牌分析: {remaining_str}
当前胜率: {win_rate:.1%}

{must_beat}
{partner_info}
{history_str}

请分析并决策:
1. 如果首出：选择最能快速出完手牌的组合
2. 如果跟牌：考虑是否值得跟，还是过牌保留实力
3. 农民：配合队友，帮队友出完牌
4. 地主：积极出牌，控制局面
5. 炸弹/火箭：只在关键时刻使用

回复JSON:
{{"action": "play" 或 "pass", "cards": [...] 或 null, "reason": "策略说明"}}"""

    def decide_bid(self, hand: list, game_state: dict) -> int:
        """使用API决定叫分"""
        try:
            hand_str = json.dumps([c.display_name for c in hand], ensure_ascii=False)
            hand_counts = game_state.get('hand_count', [17, 17, 17])
            win_rate = self.fallback.win_calculator.estimate_win_rate(hand, False, hand_counts, self.player_index)

            prompt = f"""手牌: {hand_str}
手牌数: {len(hand)}
估算胜率: {win_rate:.1%}

请评估手牌强度并叫分 (0=不叫, 1/2/3=叫分)。
手牌强(有王、炸弹、大牌多)叫高分。

回复JSON: {{"bid": 0-3}}"""

            response = self._call_api(self.SYSTEM_PROMPT, prompt)
            result = json.loads(response)
            bid = result.get("bid", 0)
            if isinstance(bid, int) and 0 <= bid <= 3:
                return bid
            return self.fallback.decide_bid(hand, game_state)
        except Exception as e:
            print(f"[AI] DeepSeek叫分失败: {e}")
            return self.fallback.decide_bid(hand, game_state)

    def decide_play(self, hand: list, must_follow: Optional[PlayHand],
                    game_state: dict) -> Optional[list]:
        """使用API决定出牌"""
        try:
            # 先用规则AI分析
            fallback_result = self.fallback.decide_play(hand, must_follow, game_state)

            # 如果规则AI有很好的选择，直接用
            if fallback_result:
                play = classify_hand(fallback_result)
                if play and play.card_type in (CardType.ROCKET,):
                    return fallback_result  # 火箭直接用

            # 调用API获取策略
            prompt = self._build_play_prompt(hand, must_follow, game_state)
            response = self._call_api(self.SYSTEM_PROMPT, prompt)
            result = json.loads(response)

            action = result.get("action", "pass")
            if action == "pass":
                return None

            card_names = result.get("cards", [])
            if not card_names:
                return None

            # 解析牌
            cards = self._parse_cards(card_names, hand)
            if cards is None:
                raise ValueError("无法解析牌")

            # 验证合法性
            play = classify_hand(cards)
            if play is None:
                raise ValueError("不是合法牌型")

            if must_follow and not can_beat(play, must_follow):
                raise ValueError("打不过上家")

            return cards
        except Exception as e:
            print(f"[AI] DeepSeek出牌失败: {e}, 使用规则AI")
            return self.fallback.decide_play(hand, must_follow, game_state)

    def _parse_cards(self, card_names: list, hand: list) -> Optional[list]:
        """解析牌名"""
        result = []
        available = list(hand)

        for name in card_names:
            name = name.strip()
            found = False
            for card in available:
                if (card.display_name == name or
                    card.short_name == name or
                    (card.rank == '小王' and '小' in name) or
                    (card.rank == '大王' and '大' in name) or
                    (card.rank == '2' and name in ('2', '♠2', '♥2', '♣2', '♦2'))):
                    result.append(card)
                    available.remove(card)
                    found = True
                    break
            if not found:
                return None

        return result if result else None


# 为了向后兼容
SmartRuleAIPlayer = SuperSmartAIPlayer
RuleBasedAIPlayer = SuperSmartAIPlayer
