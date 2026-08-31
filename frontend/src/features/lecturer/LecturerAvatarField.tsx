import { Upload } from 'antd';
import type { UploadFile } from 'antd';
import { attachmentApi, uploadAttachment } from '@/shared/api/attachments';
import { ApiError } from '@/shared/api/client';
import { personByNo } from '@/fixtures/people';
import {
  AVATAR_PRESETS,
  FEMALE_AVATAR_PRESETS,
  MALE_AVATAR_PRESETS,
  avatarPresetUrl,
} from './lecturerAvatars';

interface LecturerAvatarFieldProps {
  employeeNo?: string;
  preset: string | null;
  fileList: UploadFile[];
  onPresetChange: (key: string | null) => void;
  onUploaded: (file: UploadFile, attachmentId: number) => void;
  onUploadCleared: () => void;
  onError: (message: string) => void;
}

/**
 * 讲师头像：平台 60 张现成图，或自行上传。两路互斥。
 */
export function LecturerAvatarField({
  employeeNo,
  preset,
  fileList,
  onPresetChange,
  onUploaded,
  onUploadCleared,
  onError,
}: LecturerAvatarFieldProps) {
  const rosterHint = personByNo(employeeNo ?? '')?.avatar;

  return (
    <div className="lecturer-avatar-field">
      <Upload
        listType="picture-card"
        fileList={fileList}
        maxCount={1}
        accept="image/*"
        beforeUpload={async (file) => {
          try {
            const uploaded = await uploadAttachment(file, 'GENERAL', 'LECTURER');
            onUploaded(
              {
                uid: String(uploaded.id),
                name: uploaded.fileName,
                status: 'done',
                url: attachmentApi.downloadUrl(uploaded.id),
              },
              uploaded.id,
            );
          } catch (e) {
            onError(e instanceof ApiError ? e.message : '头像上传失败');
          }
          return false;
        }}
        onRemove={() => {
          onUploadCleared();
        }}
      >
        {fileList.length === 0 ? '上传' : null}
      </Upload>
      <div className="lecturer-avatar-presets">
        <p className="lecturer-avatar-presets-caption">
          从现有 {AVATAR_PRESETS.length} 张中选择，可滚动
          {rosterHint ? `（工号对应 ${rosterHint}）` : ''}
        </p>
        <div className="lecturer-avatar-presets-scroll">
          <PresetRow label="男士" keys={MALE_AVATAR_PRESETS} selected={preset} onSelect={onPresetChange} />
          <PresetRow label="女士" keys={FEMALE_AVATAR_PRESETS} selected={preset} onSelect={onPresetChange} />
        </div>
      </div>
    </div>
  );
}

function PresetRow({
  label,
  keys,
  selected,
  onSelect,
}: {
  label: string;
  keys: string[];
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  return (
    <div className="lecturer-avatar-preset-block">
      <span className="lecturer-avatar-preset-label">{label}</span>
      <div className="lecturer-avatar-grid" role="listbox" aria-label={label}>
        {keys.map((key) => {
          const active = selected === key;
          return (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={active}
              aria-label={key}
              data-testid={`avatar-preset-${key}`}
              className="lecturer-avatar-preset"
              data-selected={active ? 'true' : 'false'}
              onClick={() => onSelect(active ? null : key)}
            >
              <img src={avatarPresetUrl(key)} alt="" width={40} height={40} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
