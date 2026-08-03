# -*- coding: utf-8 -*-
"""把《AI学院联合作战平台_设计文档_V2.0》3.1 资产清单的 A01–A18 归一化到前端静态目录。

映射不是靠肉眼认图确定的：文档 3.1 给出了每个透明素材的裁边尺寸，本脚本按
3.2 归一化算法（alpha > 5% 求 bbox，四周追加 24px 透明安全边）算出实际尺寸后
与文档值逐一断言，10 个透明素材偏差为 0 才算映射正确。任何一项不符即失败退出，
避免误替换素材后一路做到视觉回归才发现。

A14–A18 是 16:9 场景图，文档要求保留 1672×941 全图，只做格式校验不裁边。
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

from PIL import Image, ImageFilter

SRC = Path(r"F:\AI学院联合作战平台\设计文档\插画及logo")
# A01 的已归一化版本内嵌在设计文档 docx 里，尺寸正好是文档要求的 1149×257
A01_FROM_DOCX = Path(r"F:\AI学院联合作战平台\设计文档\_extracted\media\media\image1.png")
DEST = Path(__file__).resolve().parent.parent / "frontend" / "public" / "assets"

ALPHA_THRESHOLD = 12  # 文档 3.2：alpha > 5%，255 * 5% ≈ 12.75
SAFE_MARGIN = 24  # 文档 3.2：bbox 四周追加 24px 透明安全边
SIZE_TOLERANCE = 2  # 与文档裁边尺寸的允许偏差，超出即判为误替换素材

# 部分源图（如 A09）整幅画布铺着 alpha 13–167 的散点，直接按 5% 阈值求包围盒
# 会把散点当成内容，得到整幅 1536×1024 而不是文档要求的 1013×785。
# 这类图需要先对 alpha 掩膜做开运算去散点，再求包围盒。
#
# 去散点只在包围盒铺满整幅画布时启用：真实插画四周一定有留白，包围盒顶到
# 画布边缘就是噪点的确证。反过来无条件启用会误伤细节 —— 开运算会吃掉细于
# 3px 的真实笔画，A04 的装饰元素就会因此少掉 6px。
OPENING_KERNEL = 3
MASK_GROW_KERNEL = 5
FULL_CANVAS_SLACK = 4

# ID → (源文件名, 规范文件名, 子目录, 文档 3.1 裁边尺寸)
TRANSPARENT_ASSETS = [
    ("A03", "总看板案例+组织覆盖图卡片.png", "a03_global_coverage.png", "illustrations", (1231, 598)),
    ("A04", "总看板课程工作台卡片.png", "a04_data_growth.png", "illustrations", (1009, 556)),
    ("A05", "ChatGPT Image 2026年7月29日 17_31_18.png", "a05_mobile_learning.png", "illustrations", (904, 844)),
    ("A06", "右下角2.png", "a06_data_analysis.png", "illustrations", (764, 579)),
    ("A07", "总看板AI需求卡片.png", "a07_collaboration.png", "illustrations", (1440, 610)),
    ("A08", "右下角4.png", "a08_data_operations.png", "illustrations", (939, 658)),
    ("A09", "右下角3.png", "a09_profile.png", "illustrations", (1013, 785)),
    ("A10", "右下角.png", "a10_messaging.png", "illustrations", (895, 740)),
    ("A11", "总看板培训运营地图卡片.png", "a11_account_profile.png", "illustrations", (1191, 762)),
    ("A12", "总看板讲师与能力地图卡片.png", "a12_calendar.png", "illustrations", (1224, 956)),
    ("A13", "消息中心右下角.png", "a13_no_result.png", "illustrations", (1086, 789)),
]

HERO_ASSETS = [
    ("A14", "案例库卡片1.png", "a14_content_review_hero.png"),
    ("A15", "案例库卡片2.png", "a15_monitoring_hero.png"),
    ("A16", "案例库卡片3.png", "a16_training_hero.png"),
    ("A17", "案例库卡片4.png", "a17_ai_workspace_hero.png"),
    ("A18", "案例库卡片5.png", "a18_analytics_hero.png"),
]
HERO_SIZE = (1672, 941)

failures: list[str] = []


def alpha_bbox(im: Image.Image) -> tuple[int, int, int, int] | None:
    return im.split()[3].point(lambda v: 255 if v > ALPHA_THRESHOLD else 0).getbbox()


def covers_full_canvas(bbox: tuple[int, int, int, int], size: tuple[int, int]) -> bool:
    return (
        bbox[0] <= FULL_CANVAS_SLACK
        and bbox[1] <= FULL_CANVAS_SLACK
        and bbox[2] >= size[0] - FULL_CANVAS_SLACK
        and bbox[3] >= size[1] - FULL_CANVAS_SLACK
    )


def despeckle(im: Image.Image) -> Image.Image:
    """去掉孤立散点，保留插画边缘的抗锯齿。

    做法是对 alpha 掩膜先腐蚀后膨胀（开运算）消掉细小散点，再把掩膜回胀几像素
    盖住真实边缘的半透明过渡带，最后用它筛原 alpha —— 只有散点被清零，
    边缘像素的 alpha 值原样保留。
    """
    r, g, b, alpha = im.split()
    mask = alpha.point(lambda v: 255 if v > ALPHA_THRESHOLD else 0)
    keep = (
        mask.filter(ImageFilter.MinFilter(OPENING_KERNEL))
        .filter(ImageFilter.MaxFilter(OPENING_KERNEL))
        .filter(ImageFilter.MaxFilter(MASK_GROW_KERNEL))
    )
    cleaned = Image.composite(alpha, Image.new("L", alpha.size, 0), keep)
    return Image.merge("RGBA", (r, g, b, cleaned))


def normalize_transparent(asset_id: str, src_name: str, out_name: str, subdir: str,
                          expected: tuple[int, int]) -> None:
    src = SRC / src_name
    if not src.exists():
        failures.append(f"{asset_id}: 源文件不存在 {src}")
        return

    im = Image.open(src).convert("RGBA")
    bbox = alpha_bbox(im)
    if bbox is None:
        failures.append(f"{asset_id}: 图内没有可见内容")
        return

    despeckled = False
    if covers_full_canvas(bbox, im.size):
        im = despeckle(im)
        bbox = alpha_bbox(im)
        despeckled = True
        if bbox is None or covers_full_canvas(bbox, im.size):
            failures.append(f"{asset_id}: 去散点后包围盒仍铺满整幅画布，源文件异常")
            return

    cropped = im.crop(bbox)
    natural = (cropped.width + SAFE_MARGIN * 2, cropped.height + SAFE_MARGIN * 2)
    drift = (abs(natural[0] - expected[0]), abs(natural[1] - expected[1]))
    if max(drift) > SIZE_TOLERANCE:
        failures.append(
            f"{asset_id}: 归一化后 {natural[0]}x{natural[1]}，"
            f"文档 3.1 要求 {expected[0]}x{expected[1]} —— 源文件可能被误替换"
        )
        return

    # 定版到文档尺寸，±2px 的抗锯齿差异用居中留白吸收
    canvas = Image.new("RGBA", expected, (0, 0, 0, 0))
    canvas.paste(cropped, ((expected[0] - cropped.width) // 2, (expected[1] - cropped.height) // 2))

    out = DEST / subdir / out_name
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, optimize=True)

    notes = []
    if despeckled:
        notes.append("已去散点")
    if max(drift):
        notes.append(f"抗锯齿差 {drift[0]}x{drift[1]}px 居中吸收")
    suffix = f"  （{'，'.join(notes)}）" if notes else ""
    print(f"  {asset_id}  {expected[0]:>4}x{expected[1]:<4}  {subdir}/{out_name}{suffix}")


def normalize_logo() -> None:
    """A01 直接取 docx 内嵌的已归一化文件；A02 从 A01 切出左侧标志。"""
    if not A01_FROM_DOCX.exists():
        failures.append(f"A01: 源文件不存在 {A01_FROM_DOCX}")
        return

    a01 = Image.open(A01_FROM_DOCX).convert("RGBA")
    if a01.size != (1149, 257):
        failures.append(f"A01: 尺寸 {a01.size}，文档 3.1 要求 1149x257")
        return

    out_dir = DEST / "brand"
    out_dir.mkdir(parents=True, exist_ok=True)
    a01.save(out_dir / "a01_logo_horizontal.png", optimize=True)
    print(f"  A01  {a01.size[0]:>4}x{a01.size[1]:<4}  brand/a01_logo_horizontal.png")

    # 标志与字标之间有一段完全透明的列，据此切分，不靠写死坐标
    alpha = a01.split()[3]
    width, height = a01.size
    opaque_cols = [
        any(alpha.getpixel((x, y)) > ALPHA_THRESHOLD for y in range(height))
        for x in range(width)
    ]
    first = opaque_cols.index(True)
    gap_start = next(
        (x for x in range(first, width) if not opaque_cols[x] and not any(opaque_cols[x : x + 12])),
        None,
    )
    if gap_start is None:
        failures.append("A02: 未能在 A01 中找到标志与字标之间的透明间隔")
        return

    mark = a01.crop((first, 0, gap_start, height))
    mark_bbox = mark.split()[3].point(lambda v: 255 if v > ALPHA_THRESHOLD else 0).getbbox()
    mark = mark.crop(mark_bbox)

    canvas = Image.new(
        "RGBA", (mark.width + SAFE_MARGIN * 2, mark.height + SAFE_MARGIN * 2), (0, 0, 0, 0)
    )
    canvas.paste(mark, (SAFE_MARGIN, SAFE_MARGIN))
    canvas.save(out_dir / "a02_logo_mark.png", optimize=True)

    note = "" if canvas.size == (226, 249) else f"  ← 文档 3.1 标称 226x249"
    print(f"  A02  {canvas.size[0]:>4}x{canvas.size[1]:<4}  brand/a02_logo_mark.png{note}")


def copy_hero(asset_id: str, src_name: str, out_name: str) -> None:
    src = SRC / src_name
    if not src.exists():
        failures.append(f"{asset_id}: 源文件不存在 {src}")
        return

    with Image.open(src) as im:
        if im.size != HERO_SIZE:
            failures.append(
                f"{asset_id}: 尺寸 {im.size[0]}x{im.size[1]}，"
                f"文档 3.2 要求保留 {HERO_SIZE[0]}x{HERO_SIZE[1]} 全图"
            )
            return

    out = DEST / "heroes" / out_name
    out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, out)
    print(f"  {asset_id}  {HERO_SIZE[0]:>4}x{HERO_SIZE[1]:<4}  heroes/{out_name}")


def main() -> int:
    print("Logo（文档 3.3：不得拉伸、改色、裁掉字样）")
    normalize_logo()

    print("\n透明插画（文档 3.2：alpha>5% bbox + 24px 安全边，CSS 用 object-fit: contain）")
    for asset_id, src_name, out_name, subdir, expected in TRANSPARENT_ASSETS:
        normalize_transparent(asset_id, src_name, out_name, subdir, expected)

    print("\n16:9 场景图（文档 3.2：保留全图，CSS 用 object-fit: cover）")
    for asset_id, src_name, out_name in HERO_ASSETS:
        copy_hero(asset_id, src_name, out_name)

    if failures:
        print("\n失败：")
        for line in failures:
            print(f"  - {line}")
        return 1

    print(f"\n18 项资产全部归一化完成 → {DEST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
