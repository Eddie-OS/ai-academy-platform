import { describe, expect, it } from 'vitest';
import {
  AVATAR_PRESETS,
  FEMALE_AVATAR_PRESETS,
  MALE_AVATAR_PRESETS,
  avatarPresetUrl,
  isAvatarPreset,
  lecturerPortraitSrc,
} from './lecturerAvatars';

describe('讲师现成头像', () => {
  it('正好 60 张且不重复', () => {
    expect(MALE_AVATAR_PRESETS).toHaveLength(30);
    expect(FEMALE_AVATAR_PRESETS).toHaveLength(30);
    expect(new Set(AVATAR_PRESETS).size).toBe(60);
    expect(AVATAR_PRESETS[0]).toBe('male_01');
    expect(AVATAR_PRESETS[59]).toBe('female_30');
  });

  it('预设走静态资源，上传走附件下载', () => {
    expect(isAvatarPreset('male_07')).toBe(true);
    expect(isAvatarPreset('male_31')).toBe(false);
    expect(avatarPresetUrl('female_14')).toBe('/assets/avatars/female_14.png');
    expect(
      lecturerPortraitSrc({ avatarAttachmentId: 9, avatarPreset: 'male_01' }),
    ).toBe('/api/attachments/9/download');
    expect(
      lecturerPortraitSrc({ avatarAttachmentId: null, avatarPreset: 'male_01' }),
    ).toBe('/assets/avatars/male_01.png');
  });
});
