import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIELD_ENUM_KEYS } from '@/shared/api/meta';

/**
 * 字段枚举键的漂移门禁（CLAUDE.md STK-1 的另一半）。
 *
 * <p>{@link FIELD_ENUM_KEYS} 与后端 {@code /api/meta/field-enums} 下发的键是<b>两张手工维护的表</b>，
 * 它们靠中文字符串对上号。对不上时 TypeScript 一无所知：{@code enums.data?.['需求所属领域']}
 * 只是返回 undefined，下拉框安静地空掉，没有报错、没有红字。已经发生过一次——后端补了 13 个
 * 字段枚举，前端这张表没跟上，13 个键在 18 处被引用，直到有人手动跑 tsc 才暴露。
 *
 * <p>所以这里不比对「前端写了什么」，而是拿后端源码里真实 put 进去的键做交叉验证。
 * 后端改名、前端笔误、两边各加一半，都会在这条用例上停住。
 *
 * <p>解析的是 Java 源码而不是启动后端调接口：门禁必须能在没有数据库、没有容器的环境里跑，
 * 否则它进不了 CI，进不了 CI 就等于不存在。同样的取舍见 {@code stateLiteralGuard.test.ts}。
 */

const BACKEND = resolve(process.cwd(), '../backend');

const ENUM_SOURCES = [
  'business/demand/src/main/java/com/aiacademy/business/demand/domain/DemandEnums.java',
  'business/course/src/main/java/com/aiacademy/business/course/domain/CourseEnums.java',
  'business/training/src/main/java/com/aiacademy/business/training/domain/TrainingEnums.java',
  'business/lecturer/src/main/java/com/aiacademy/business/lecturer/domain/LecturerEnums.java',
  'business/kase/src/main/java/com/aiacademy/business/kase/domain/CaseEnums.java',
];

const META_CONTROLLER = 'app/src/main/java/com/aiacademy/app/web/controller/MetaController.java';

/**
 * 截出一个 Java 方法体。只认四空格缩进的收尾花括号——这是本项目 Java 代码的统一缩进，
 * 用它定位比配对花括号简单得多，且方法签名找不到时直接抛错，不会静默返回空串。
 */
function methodBody(source: string, signature: string, file: string): string {
  const start = source.indexOf(signature);
  if (start < 0) {
    throw new Error(`${file} 里没有找到方法 ${signature}；后端重构后请同步更新本门禁`);
  }
  const end = source.indexOf('\n    }', start);
  return source.slice(start, end < 0 ? undefined : end);
}

/** 方法体里 put 进 map 的字面量键。变量键（如按轨道循环 put 的）不在此列，由前缀匹配覆盖。 */
function literalPutKeys(body: string): string[] {
  return [...body.matchAll(/\.put\("([^"]+)"/g)].flatMap((match) =>
    match[1] ? [match[1]] : [],
  );
}

function backendFieldEnumKeys(): string[] {
  const keys = ENUM_SOURCES.flatMap((relativePath) => {
    const source = readFileSync(resolve(BACKEND, relativePath), 'utf8');
    return literalPutKeys(methodBody(source, 'forMetaApi()', relativePath));
  });

  // 灯色不放在任何 business Enums 里：业务模块不能依赖 warning（AR-2），
  // 所以它由 MetaController 直接 put。只截 fieldEnums() 那一段，
  // 免得把 dicts() 里的「自检CheckList清单项」也算成字段枚举
  const controller = readFileSync(resolve(BACKEND, META_CONTROLLER), 'utf8');
  keys.push(...literalPutKeys(methodBody(controller, 'fieldEnums()', META_CONTROLLER)));

  return keys;
}

describe('FIELD_ENUM_KEYS 与后端 /api/meta/field-enums 对齐', () => {
  const backendKeys = backendFieldEnumKeys();

  it('后端源码能解析出字段枚举键（解析失败时不许静默放行）', () => {
    expect(backendKeys.length).toBeGreaterThan(20);
  });

  it.each(Object.entries(FIELD_ENUM_KEYS))(
    '%s 在后端下发的键里存在',
    (name, key) => {
      // 以「·」结尾的是前缀键（试讲验收标准·<轨道>），后端按轨道循环 put，
      // 完整键名取决于运行时数据，只能校验前缀确实被使用
      const hit = key.endsWith('·')
        ? backendKeys.some((backendKey) => backendKey.startsWith(key))
        : backendKeys.includes(key);

      expect(
        hit,
        `前端 FIELD_ENUM_KEYS.${name} = 「${key}」，后端 field-enums 没有这个键。\n` +
          '两边必须同时改：只改一边不会报错，表现为下拉框空白。\n' +
          `后端当前下发：${backendKeys.join('、')}`,
      ).toBe(true);
    },
  );
});
