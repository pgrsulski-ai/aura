import type { CurrentUser, Settings } from './types';

export const DEFAULT_USER: CurrentUser = {
  handle: '',
  bio: '',
  avatar: 'A',
};

export const DEFAULT_SETTINGS: Settings = {
  losslessAudio: false,
  backgroundPlay: true,
};
