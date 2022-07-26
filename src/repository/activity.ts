export type Vendor = 'strava' | 'suunto';
export type Activity = {
  id: number;
  userId: number;
  vendor: Vendor;
  vendorId: string;
  date: string; // ISO 8601
  name: string;
  type?: string;
};
