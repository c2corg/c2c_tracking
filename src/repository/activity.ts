export interface Activity {
  id: number;
  userId: number;
  vendor: 'strava';
  vendorId: string;
  date: string;
  name: string;
  type?: string;
}
