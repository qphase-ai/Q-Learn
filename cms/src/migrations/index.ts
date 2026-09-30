import * as migration_20260930_022829_initial from './20260930_022829_initial';

export const migrations = [
  {
    up: migration_20260930_022829_initial.up,
    down: migration_20260930_022829_initial.down,
    name: '20260930_022829_initial'
  },
];
