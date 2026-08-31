/**
 * 平台现成的 60 张讲师头像（public/assets/avatars）。
 *
 * <p>male_01～30、female_01～30 各一张。选预设不走附件上传；自行上传时清空预设。
 */

function series(prefix: 'male' | 'female'): string[] {
  return Array.from({ length: 30 }, (_, index) => `${prefix}_${String(index + 1).padStart(2, '0')}`);
}

export const MALE_AVATAR_PRESETS = series('male');
export const FEMALE_AVATAR_PRESETS = series('female');
export const AVATAR_PRESETS = [...MALE_AVATAR_PRESETS, ...FEMALE_AVATAR_PRESETS];

export function avatarPresetUrl(key: string): string {
  return `/assets/avatars/${key}.png`;
}

export function isAvatarPreset(value: string | null | undefined): boolean {
  return value != null && AVATAR_PRESETS.includes(value);
}

export function lecturerPortraitSrc(lecturer: {
  avatarAttachmentId: number | null;
  avatarPreset: string | null;
}): string | undefined {
  if (lecturer.avatarAttachmentId) {
    return `/api/attachments/${lecturer.avatarAttachmentId}/download`;
  }
  if (lecturer.avatarPreset) {
    return avatarPresetUrl(lecturer.avatarPreset);
  }
  return undefined;
}
