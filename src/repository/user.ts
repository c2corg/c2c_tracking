export type StravaInfo = {
  id: number;
  accessToken?: string;
  expiresAt?: number;
  refreshToken?: string;
};

export type SuuntoInfo = {
  username: string;
  accessToken?: string;
  expiresAt?: number;
  refreshToken?: string;
};

export type GarminInfo = {
  token: string;
  tokenSecret: string;
};

export type User = {
  c2cId: number;
  strava?: StravaInfo;
  suunto?: SuuntoInfo;
  garmin?: GarminInfo;
};
