import { $t } from 'services/i18n';
import { TPlatform } from '..';

export type TTikTokScope =
  | 'live.room.info'
  | 'live.room.manage'
  | 'research.adlib.basic'
  | 'research.data.basic'
  | 'user.info.basic'
  | 'user.info.profile'
  | 'user.info.stats'
  | 'video.list'
  | 'video.publish'
  | 'video.upload';

export enum ETikTokLiveRoomDestinations {
  OBS = 1,
  STREAMLABS = 2,
}

export enum ETikTokLiveScopeReason {
  DENIED = -1,
  NOT_APPROVED = 0,
  APPROVED = 1,
  APPROVED_OBS = 2,
}

export type TTikTokLiveScopeTypes = 'approved' | 'not-approved' | 'legacy' | 'denied';

export interface ITikTokLiveScopeResponse {
  platform: TPlatform | string;
  reason: ETikTokLiveScopeReason;
  can_be_live?: boolean;
  user?: ITikTokUserData;
  info?: any[] | null[] | undefined[] | ITikTokGame[] | ITikTokGamesData | any;
}

export interface ITikTokGamesData extends ITikTokLiveScopeResponse {
  categories: ITikTokGame[];
  platform: TPlatform | string;
  reason: ETikTokLiveScopeReason;
  can_be_live?: boolean;
  user?: ITikTokUserData;
  info?: any[] | null[] | undefined[] | ITikTokGame[] | ITikTokGamesData | any;
}

interface ITikTokGame {
  full_name: string;
  game_mask_id: string;
}

export interface ITikTokUserData {
  open_id?: string;
  union_id?: string;
  username: string;
  avatar_url?: string;
  is_verified?: false;
  likes_count?: number;
  video_count?: number;
  display_name?: string;
  follower_count?: number;
  following_count?: number;
  profile_deep_link?: string;
}

export interface ITikTokError {
  code: string;
  message: string;
  log_id: string;
  http_status_code: number;
}

export enum ETikTokErrorTypes {
  ACCESS_TOKEN_INVALID = 'access_token_invalid',
  INTERNAL_ERROR = 'internal_error',
  INVALID_FILE_UPLOAD = 'invalid_file_upload',
  INVALID_PARAMS = 'invalid_params',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SCOPE_NOT_AUTHORIZED = 'scope_not_authorized',
  SCOPE_PERMISSION_MISSED = 'scope_permission_missed',
  USER_HAS_NO_LIVE_AUTH = 'user_has_no_live_auth',
  TIKTOK_ALREADY_LIVE = 'user_already_live',
  OK = 'ok',
}

export interface ITikTokStartStreamResponse {
  key: string;
  rtmp: string;
  id: string;
}

export interface ITikTokEndStreamResponse {
  success: boolean;
}

export const tiktokErrorMessages = (error: string) => {
  return {
    TIKTOK_OAUTH_EXPIRED: $t('tiktokReAuthError'),
    TIKTOK_GENERATE_CREDENTIALS_FAILED: $t(
      'Failed to generate TikTok stream credentials. Confirm Live Access with TikTok.',
    ),
    TIKTOK_STREAM_SCOPE_MISSING: $t('Your TikTok account is not enabled for live streaming.'),
    TIKTOK_SCOPE_OUTDATED: $t(
      'Failed to update TikTok account. Please unlink and reconnect your TikTok account.',
    ),
    TIKTOK_STREAM_ACTIVE: $t('You are already live on a another device'),
  }[error];
};
