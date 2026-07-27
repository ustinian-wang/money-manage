/**
 * 登录态云同步顶栏告警：冲突 / 失败须 sticky 可见
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { profileSyncAlert } from './profileSyncAlert';

describe('profileSyncAlert', () => {
  it('idle/syncing/synced 不告警', () => {
    assert.equal(profileSyncAlert('idle'), null);
    assert.equal(profileSyncAlert('syncing'), null);
    assert.equal(profileSyncAlert('synced'), null);
  });

  it('conflict 文案 + 覆盖云端操作', () => {
    const a = profileSyncAlert('conflict');
    assert.ok(a);
    assert.equal(a!.tone, 'conflict');
    assert.match(a!.message, /云端/);
    assert.match(a!.actionLabel, /本机.*覆盖云端|覆盖云端/);
  });

  it('failed 文案 + 重试', () => {
    const a = profileSyncAlert('failed');
    assert.ok(a);
    assert.equal(a!.tone, 'failed');
    assert.match(a!.message, /同步失败|本机/);
    assert.equal(a!.actionLabel, '重试同步');
  });
});
