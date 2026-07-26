/**
 * 城市社保基数快捷表：广州有数、选城填入、缺省 id
 * 需求：退休区「社保基数」可自定义 + 城市快捷
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CITY_SOCIAL_BASE_PRESETS,
  DEFAULT_CITY_SOCIAL_BASE_ID,
  defaultSocialBase,
  getCitySocialBasePreset,
  resolveCitySocialBase,
} from './city-bases';
import { GUANGZHOU_SOCIAL_RULE_2026 } from './retirement';

test('预设至少含广州且当年有基数', () => {
  const gz = getCitySocialBasePreset('guangzhou');
  assert.ok(gz);
  assert.equal(gz.name, '广州');
  assert.equal(gz.year, 2026);
  assert.ok(gz.base > 0);
  assert.ok(CITY_SOCIAL_BASE_PRESETS.length >= 2);
});

// 快捷填入只取 base；与退休规则默认值同源，避免两套广州数
test('广州快捷基数对齐 GUANGZHOU_SOCIAL_RULE_2026', () => {
  assert.equal(resolveCitySocialBase('guangzhou'), GUANGZHOU_SOCIAL_RULE_2026.defaultContributionBase);
  assert.equal(getCitySocialBasePreset('guangzhou')?.min, GUANGZHOU_SOCIAL_RULE_2026.minContributionBase);
  assert.equal(getCitySocialBasePreset('guangzhou')?.max, GUANGZHOU_SOCIAL_RULE_2026.maxContributionBase);
});

test('缺省城市与 resolve；未知 id 为 null', () => {
  assert.equal(DEFAULT_CITY_SOCIAL_BASE_ID, 'guangzhou');
  assert.equal(defaultSocialBase(), resolveCitySocialBase('guangzhou'));
  assert.equal(resolveCitySocialBase('no-such-city'), null);
});
