/*
 * Copyright © 2025 Hexastack. All rights reserved.
 *
 * This software is licensed under a proprietary license.
 * Unauthorized copying, distribution, modification, or use of this software, in whole or in part, is strictly prohibited without prior written permission from Hexastack.
 *
 * 1. The name "Hexabot" is a trademark of Hexastack. You may not use this name in derivative works without express written permission.
 * 2. All derivative works must include clear attribution to the original creator and software, Hexastack and Hexabot, in a prominent location (e.g., in the software's "About" section, documentation, and README file).
 * 3. Use of this software is restricted to authorized licensees only and subject to the terms of the licensing agreement provided by Hexastack.
 */

import { HelperSetting } from '@/helper/types';
import { SettingType } from '@/setting/schemas/types';

export const INFLUXDB_HELPER_NAME = 'influxdb-helper';

export const INFLUXDB_HELPER_NAMESPACE = 'influxdb_helper';

export default [
  {
    group: INFLUXDB_HELPER_NAMESPACE,
    label: 'url',
    value: 'http://influxdb:8086/',
    type: SettingType.text,
  },
  {
    group: INFLUXDB_HELPER_NAMESPACE,
    label: 'token',
    value: 'mytoken',
    type: SettingType.secret,
    translatable: false,
  },
  {
    group: INFLUXDB_HELPER_NAMESPACE,
    label: 'organization',
    value: 'Hexastack',
    type: SettingType.text,
    translatable: false,
  },
  {
    group: INFLUXDB_HELPER_NAMESPACE,
    label: 'bucket',
    value: 'Hexabot',
    type: SettingType.text,
    translatable: false,
  },
  {
    group: INFLUXDB_HELPER_NAMESPACE,
    label: 'subjects',
    value: ['Greeting', 'Question', 'Handover'],
    type: SettingType.multiple_text,
    translatable: false,
  },
  {
    group: INFLUXDB_HELPER_NAMESPACE,
    label: 'default_subject',
    value: 'Other',
    type: SettingType.text,
    translatable: false,
  },
  {
    group: INFLUXDB_HELPER_NAMESPACE,
    label: 'subject_tagname',
    value: 'subject',
    type: SettingType.text,
    translatable: false,
  },
] as const satisfies HelperSetting<typeof INFLUXDB_HELPER_NAME>[];
