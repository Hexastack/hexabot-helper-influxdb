/*
 * Copyright © 2024 Hexastack. All rights reserved.
 *
 * Licensed under the GNU Affero General Public License v3.0 (AGPLv3) with the following additional terms:
 * 1. The name "Hexabot" is a trademark of Hexastack. You may not use this name in derivative works without express written permission.
 * 2. All derivative works must include clear attribution to the original creator and software, Hexastack and Hexabot, in a prominent location (e.g., in the software's "About" section, documentation, and README file).
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
    type: SettingType.text,
  },
  {
    group: INFLUXDB_HELPER_NAMESPACE,
    label: 'organization',
    value: 'Hexastack',
    type: SettingType.text,
  },
  {
    group: INFLUXDB_HELPER_NAMESPACE,
    label: 'bucket',
    value: 'Hexabot',
    type: SettingType.text,
  },
  {
    group: INFLUXDB_HELPER_NAMESPACE,
    label: 'subjects',
    value: ['Greeting', 'Question', 'Handover'],
    type: SettingType.multiple_text,
  },
  {
    group: INFLUXDB_HELPER_NAMESPACE,
    label: 'default_subject',
    value: 'Other',
    type: SettingType.text,
  },
] as const satisfies HelperSetting<typeof INFLUXDB_HELPER_NAME>[];
