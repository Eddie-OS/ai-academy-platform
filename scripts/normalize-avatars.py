# -*- coding: utf-8 -*-
"""把 60 张人物头像原图归一化到前端静态目录。

原图是 1254×1254 的 RGB，单张约 1.9MB，60 张合计 114MB。而《设计文档 V2.0》2.4
规定头像只有 24/32/40/56/64 五档，最大 64px —— 直接入库等于让首屏为 40px 的
方格下载 114MB。

因此按最大档的 2 倍（64 × 2 = 128）定版。视网膜屏下仍是 1:1 采样，
再大的原始像素在任何一档里都看不出差别。

命名保持 male_NN / female_NN 不变：这一层不做重命名，姓名到文件的映射由
前端 `src/fixtures/people.ts` 的人物名录承担，改名录不必动图。
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

SRC = Path(__file__).resolve().parent.parent / "头像"
DEST = Path(__file__).resolve().parent.parent / "frontend" / "public" / "assets" / "avatars"

# 2.4 头像最大档 64px 的 2 倍。视网膜屏 1:1，更大的像素在任何一档都看不出差别
TARGET = 128
EXPECTED_COUNT = 60


def main() -> int:
    sources = sorted(SRC.glob("*.png"))
    if len(sources) != EXPECTED_COUNT:
        print(f"失败：{SRC} 下有 {len(sources)} 张头像，预期 {EXPECTED_COUNT} 张")
        return 1

    DEST.mkdir(parents=True, exist_ok=True)
    total_before = 0
    total_after = 0

    for src in sources:
        total_before += src.stat().st_size
        with Image.open(src) as im:
            # 非正方形原图先居中裁成正方形，否则缩放会把脸压扁
            if im.width != im.height:
                edge = min(im.width, im.height)
                left = (im.width - edge) // 2
                top = (im.height - edge) // 2
                im = im.crop((left, top, left + edge, top + edge))
            im.convert("RGB").resize((TARGET, TARGET), Image.LANCZOS).save(
                DEST / src.name, optimize=True
            )
        total_after += (DEST / src.name).stat().st_size

    print(
        f"{len(sources)} 张头像归一化到 {TARGET}×{TARGET} → {DEST}\n"
        f"体积 {total_before / 1024 / 1024:.1f}MB → {total_after / 1024:.0f}KB"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
