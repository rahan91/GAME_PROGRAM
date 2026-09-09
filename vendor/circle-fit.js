/*
The MIT License (MIT)

Copyright (c) 2015 Michael MIGLIORE

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// Vendored from the "circle-fit" npm package (v1.0.2, MIT) by Michael MIGLIORE.
// Least-squares algebraic circle fit: solves the linear system of the implicit
// circle equation for the center and radius in closed form. Adapted to accept
// points as [[x, y], ...] and to expose a module/global like the rest of the
// site's scripts.
(function (global, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else global.Circlefit = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  class Circlefit {
    constructor() {}

    /** Linear solve of a 2x2 system. Returns false when singular. */
    static _linearSolve2x2(matrix, vector) {
      let det = matrix[0] * matrix[3] - matrix[1] * matrix[2];
      if (Math.abs(det) < 1e-8) return false; // no solution (collinear, etc.)
      let y = (matrix[0] * vector[1] - matrix[2] * vector[0]) / det;
      let x = (vector[0] - matrix[1] * y) / matrix[0];
      return [x, y];
    }

    /**
     * Fit a circle through a set of points.
     * @param {Array<Array<number>>} points array of [x, y] pairs
     * @returns {{success, center:{x,y}, radius, distances, residue}}
     *   distances[i] = distance of point i from the fitted circle (d_i - r).
     */
    static compute(points) {
      const n = points.length;
      let result = {
        success: false,
        center: { x: 0, y: 0 },
        radius: 0,
        residue: 0,
        distances: []
      };
      if (n < 3) return result;

      // means
      let m = { x: 0, y: 0 };
      for (let i = 0; i < n; i++) { m.x += points[i][0] / n; m.y += points[i][1] / n; }

      // centered points
      let Sxx = 0, Sxy = 0, Syy = 0, v1 = 0, v2 = 0;
      let u;
      for (let i = 0; i < n; i++) {
        u = { x: points[i][0] - m.x, y: points[i][1] - m.y };
        Sxx += u.x * u.x;
        Sxy += u.x * u.y;
        Syy += u.y * u.y;
        v1 += 0.5 * (u.x * u.x * u.x + u.x * u.y * u.y);
        v2 += 0.5 * (u.y * u.y * u.y + u.x * u.x * u.y);
      }

      let sol = this._linearSolve2x2([Sxx, Sxy, Sxy, Syy], [v1, v2]);
      if (sol === false) return result;

      result.success = true;
      let radius2 = sol[0] * sol[0] + sol[1] * sol[1] + (Sxx + Syy) / n;
      result.radius = Math.sqrt(Math.max(0, radius2));
      result.center.x = sol[0] + m.x;
      result.center.y = sol[1] + m.y;

      for (let i = 0; i < n; i++) {
        let v = { x: points[i][0] - result.center.x, y: points[i][1] - result.center.y };
        let len2 = v.x * v.x + v.y * v.y;
        result.residue += radius2 - len2;
        let len = Math.sqrt(len2);
        result.distances.push(len - result.radius);
      }
      return result;
    }
  }

  return Circlefit;
});