import { readFileSync } from 'fs';
import { resolve } from 'path';

import { readFitFile } from '../../../src/helpers/fit';

const samplesDir = resolve(__dirname, './samples');

describe('FIT', () => {
  describe.each([
    'Activity',
    'activity_developerdata',
    'activity_lowbattery',
    'activity_multisport',
    'activity_poolswim',
    'activity_poolswim_with_hr',
    'activity_truncated',
    'DeveloperData',
    'MonitoringFile',
    'Settings',
    'WeightScaleMultiUser',
    'WeightScaleSingleUser',
    'WorkoutCustomTargetValues',
    'WorkoutIndividualSteps',
    'WorkoutRepeatGreaterThanStep',
    'WorkoutRepeatSteps',
  ])('loads FIT file', (name) => {
    it('expects an empty geometry', () => {
      // each of these files have either no record, or insufficient data (e.g. no coordinates)
      // but it shoud not fail...
      const geometry = readFitFile(readFileSync(resolve(samplesDir, name + '.fit')));
      expect(geometry.coordinates).toHaveLength(0);
    });
  });

  it('retrieves geomtry', () => {
    const geometry = readFitFile(readFileSync(resolve(samplesDir, 'records.fit')));
    expect(geometry.coordinates).not.toHaveLength(0);
  });
});
