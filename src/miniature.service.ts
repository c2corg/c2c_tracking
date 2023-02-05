import { encode } from '@mapbox/polyline';
import { createId } from '@paralleldrive/cuid2';
import axios from 'axios';

import config from './config';
import { simplify } from './helpers/simplify';
import type { LineString } from './repository/geojson';
import { storage } from './storage/storage';

const miniatureSize = config.get('miniatures.size');
const mapboxToken = config.get('miniatures.mapbox.token');

export class MiniatureService {
  public async generateMiniature(geometry: LineString): Promise<string> {
    const id = createId() + '.png';
    const response = await axios.get<ArrayBuffer>(this.mapboxUrl(geometry), { responseType: 'arraybuffer' });
    await storage.put(id, Buffer.from(response.data));
    return id;
  }

  public async deleteMiniature(id: string): Promise<void> {
    await storage.delete(id);
  }

  private mapboxUrl(geometry: LineString): string {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const polyline = encode(this.simplifiedCoordinates(geometry).map(([lng, lat]) => [lat!, lng!]));
    const uriEncodedPolyline = encodeURIComponent(polyline);
    return `https://api.mapbox.com/styles/v1/mapbox/outdoors-v11/static/path-2+f00(${uriEncodedPolyline})/auto/${miniatureSize}x${miniatureSize}?access_token=${mapboxToken}&attribution=false&logo=false&padding=20`;
  }

  private simplifiedCoordinates(geometry: LineString): number[][] {
    const coordinates: number[][] = structuredClone(geometry.coordinates);
    const tolerance = this.estimateTolerance(coordinates);
    return simplify(coordinates, tolerance, false);
  }

  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  private estimateTolerance(coordinates: number[][]): number {
    const [diff1, diff2] = coordinates.reduce(
      (acc, coord) => {
        if (coord[0]! < acc[0][0]!) {
          acc[0][0] = coord[0]!;
        }
        if (coord[0]! > acc[0][1]!) {
          acc[0][1] = coord[0]!;
        }
        if (coord[1]! < acc[1][0]!) {
          acc[1][0] = coord[1]!;
        }
        if (coord[1]! > acc[1][1]!) {
          acc[1][1] = coord[1]!;
        }
        return acc;
      },
      [
        [Infinity, -Infinity],
        [Infinity, -Infinity],
      ],
    );
    const max = Math.max(diff1[1]! - diff1[0]!, diff2[1]! - diff2[0]!);
    return max / miniatureSize;
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
  }
}

export const miniatureService = new MiniatureService();
