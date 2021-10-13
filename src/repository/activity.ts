export type Vendor = 'strava';
export interface Activity {
  id: number;
  userId: number;
  vendor: Vendor;
  vendorId: string;
  date: string;
  name: string;
  type?: string;
}
