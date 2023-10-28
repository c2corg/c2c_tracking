/* eslint-disable security/detect-object-injection */
/*
 (c) 2017, Vladimir Agafonkin
 Simplify.js, a high-performance JS polyline simplification library
 mourner.github.io/simplify-js
*/

// square distance between 2 points
function getSqDist(p1: number[], p2: number[]): number {
  const dx = p1[0]! - p2[0]!;
  const dy = p1[1]! - p2[1]!;

  return dx * dx + dy * dy;
}

// square distance from a point to a segment
function getSqSegDist(p: number[], p1: number[], p2: number[]): number {
  let x = p1[0]!;
  let y = p1[1]!;
  let dx = p2[0]! - x;
  let dy = p2[1]! - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((p[0]! - x) * dx + (p[1]! - y) * dy) / (dx * dx + dy * dy);

    if (t > 1) {
      x = p2[0]!;
      y = p2[1]!;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = p[0]! - x;
  dy = p[1]! - y;

  return dx * dx + dy * dy;
}

// basic distance-based simplification
function simplifyRadialDist(points: number[][], sqTolerance: number): number[][] {
  let prevPoint = points[0]!;
  const newPoints = [prevPoint];
  let point: number[] | undefined;

  for (let i = 1, len = points.length; i < len; i++) {
    point = points[i]!;
    if (getSqDist(point, prevPoint) > sqTolerance) {
      newPoints.push(point);
      prevPoint = point;
    }
  }

  if (prevPoint !== point) newPoints.push(point!);

  return newPoints;
}

function simplifyDPStep(
  points: number[][],
  first: number,
  last: number,
  sqTolerance: number,
  simplified: number[][],
): void {
  let maxSqDist = sqTolerance;
  let index: number | undefined;

  for (let i = first + 1; i < last; i++) {
    const sqDist = getSqSegDist(points[i]!, points[first]!, points[last]!);

    if (sqDist > maxSqDist) {
      index = i;
      maxSqDist = sqDist;
    }
  }

  if (maxSqDist > sqTolerance) {
    if (index! - first > 1) simplifyDPStep(points, first, index!, sqTolerance, simplified);
    simplified.push(points[index!]!);
    if (last - index! > 1) simplifyDPStep(points, index!, last, sqTolerance, simplified);
  }
}

// simplification using Ramer-Douglas-Peucker algorithm
function simplifyDouglasPeucker(points: number[][], sqTolerance: number): number[][] {
  const last = points.length - 1;

  const simplified = [points[0]!];
  simplifyDPStep(points, 0, last, sqTolerance, simplified);
  simplified.push(points[last]!);

  return simplified;
}

// both algorithms combined for awesome performance
export function simplify(points: number[][], tolerance: number, highestQuality: boolean): number[][] {
  if (points.length <= 2) {
    return points;
  }

  const sqTolerance = tolerance !== undefined ? tolerance * tolerance : 1;

  points = highestQuality ? points : simplifyRadialDist(points, sqTolerance);
  points = simplifyDouglasPeucker(points, sqTolerance);

  return points;
}
