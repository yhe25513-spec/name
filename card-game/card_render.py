"""扑克牌图像渲染 - 使用Pillow生成牌面"""

from PIL import Image, ImageDraw, ImageFont
from card import Card
from settings import CARD_WIDTH, CARD_HEIGHT


class CardRenderer:
    """扑克牌渲染器"""

    def __init__(self):
        self.card_width = CARD_WIDTH
        self.card_height = CARD_HEIGHT
        self._cache = {}
        self._back_cache = None
        self._selected_back_cache = None

    def get_card_image(self, card: Card, selected: bool = False) -> Image.Image:
        """获取牌面图像 (带缓存)"""
        cache_key = (card.suit, card.rank, selected)
        if cache_key not in self._cache:
            self._cache[cache_key] = self._draw_card(card, selected)
        return self._cache[cache_key]

    def get_card_back(self) -> Image.Image:
        """获取牌背图像"""
        if self._back_cache is None:
            self._back_cache = self._draw_card_back()
        return self._back_cache

    def _draw_card(self, card: Card, selected: bool = False) -> Image.Image:
        """绘制牌面"""
        w, h = self.card_width, self.card_height
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # 牌背景
        if selected:
            bg_color = (255, 255, 200)  # 选中时黄色
            border_color = (255, 200, 0)
        else:
            bg_color = (255, 255, 255)
            border_color = (100, 100, 100)

        # 绘制圆角矩形
        draw.rounded_rectangle([2, 2, w-2, h-2], radius=8,
                              fill=bg_color, outline=border_color, width=2)

        # 判断颜色
        is_red = card.suit in ('♥', '♦')
        color = (200, 0, 0) if is_red else (0, 0, 0)

        # 特殊处理大小王
        if card.rank == '小王':
            color = (0, 0, 0)
            self._draw_joker(draw, w, h, color, '小')
        elif card.rank == '大王':
            color = (200, 0, 0)
            self._draw_joker(draw, w, h, color, '大')
        else:
            # 绘制点数和花色
            try:
                font_large = ImageFont.truetype("arial.ttf", 24)
                font_small = ImageFont.truetype("arial.ttf", 12)
            except:
                font_large = ImageFont.load_default()
                font_small = ImageFont.load_default()

            # 左上角点数
            draw.text((6, 6), card.rank, fill=color, font=font_small)
            # 左上角花色
            draw.text((6, 20), card.suit, fill=color, font=font_small)

            # 中间大花色
            try:
                font_center = ImageFont.truetype("arial.ttf", 30)
            except:
                font_center = ImageFont.load_default()
            draw.text((w//2 - 8, h//2 - 18), card.suit, fill=color, font=font_center)

            # 中间大点数
            draw.text((w//2 - 8, h//2 + 12), card.rank, fill=color, font=font_center)

        return img

    def _draw_joker(self, draw, w, h, color, label):
        """绘制大小王"""
        try:
            font = ImageFont.truetype("arial.ttf", 16)
            font_large = ImageFont.truetype("arial.ttf", 20)
        except:
            font = ImageFont.load_default()
            font_large = ImageFont.load_default()

        # 绘制 JOKER 文字
        draw.text((8, 8), "JOKER", fill=color, font=font)

        # 绘制大小标记
        draw.text((w//2 - 8, h//2 - 25), label, fill=color, font=font_large)

        # 绘制星星装饰
        star_points = [
            (w//2, h//2 + 5),
            (w//2 + 12, h//2 + 18),
            (w//2 + 5, h//2 + 30),
            (w//2 - 5, h//2 + 30),
            (w//2 - 12, h//2 + 18),
        ]
        draw.polygon(star_points, fill=color)

    def _draw_card_back(self) -> Image.Image:
        """绘制牌背"""
        w, h = self.card_width, self.card_height
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # 蓝色背景
        draw.rounded_rectangle([2, 2, w-2, h-2], radius=6,
                              fill=(20, 60, 120), outline=(10, 30, 60), width=2)

        # 中间菱形图案
        center_x, center_y = w // 2, h // 2
        diamond_size = 20
        points = [
            (center_x, center_y - diamond_size),
            (center_x + diamond_size, center_y),
            (center_x, center_y + diamond_size),
            (center_x - diamond_size, center_y),
        ]
        draw.polygon(points, fill=(40, 80, 140))

        # 小菱形
        small_size = 12
        points2 = [
            (center_x, center_y - small_size),
            (center_x + small_size, center_y),
            (center_x, center_y + small_size),
            (center_x - small_size, center_y),
        ]
        draw.polygon(points2, fill=(60, 100, 160))

        return img
