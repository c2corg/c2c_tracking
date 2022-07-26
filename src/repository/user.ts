export type StravaInfo = {
  id: number;
  access_token?: string;
  expires_at?: number;
  refresh_token?: string;
};

export type SuuntoInfo = {
  username: string;
  access_token?: string;
  expires_at?: number;
  refresh_token?: string;
};

export type User = {
  c2cId: number;
  strava?: StravaInfo;
  suunto?: SuuntoInfo;
};
