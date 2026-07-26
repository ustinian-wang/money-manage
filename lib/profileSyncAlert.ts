/**
 * 登录态云同步顶栏告警文案
 * 409 冲突 / 同步失败须 sticky 可见，不只藏在「更多」
 */

import type { ProfileSyncPhase } from './persistence/profileSync';

export type ProfileSyncAlert = {
  tone: 'conflict' | 'failed';
  message: string;
  actionLabel: string;
};

/** conflict / failed 返回告警；其余 phase 不展示条 */
export function profileSyncAlert(phase: ProfileSyncPhase): ProfileSyncAlert | null {
  if (phase === 'conflict') {
    return {
      tone: 'conflict',
      message: '云端数据有更新，本机草稿未丢失；继续将覆盖云端版本',
      actionLabel: '以本机数据覆盖云端',
    };
  }
  if (phase === 'failed') {
    return {
      tone: 'failed',
      message: '已保存到本机，云端同步失败',
      actionLabel: '重试同步',
    };
  }
  return null;
}
