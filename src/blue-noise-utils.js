/**
 * Free JS implementation of Void and Cluster method by Robert Ulichney and other methods
 * Ultra optimized while keeping it readable
 * The result is high quality blue noise but somehow very fast
 * Remember to link this script
 *
 * https://github.com/901D3/blue-noise.js
 *
 * Copyright (c) 901D3
 * This code is licensed with GPLv3 license
 */

"use strict";

var blueNoiseUtils = (function () {
  //Helpers
  function _poissonDiskSampling(width, height, radiusX, radiusY, k = 30) {
    const points = [];
    const active = [];
    const twoPI = 2 * Math.PI;
    const binArray = new Uint8Array(width * height);

    function isValid(p) {
      const pointLength = points.length;
      for (let i = 0; i < pointLength; i++) {
        const {x: pointX, y: pointY} = points[i];
        const {x, y} = p;
        let dx = Math.abs(pointX - x);
        let dy = Math.abs(pointY - y);
        dx = Math.min(dx, width - dx);
        dy = Math.min(dy, height - dy);
        if (dx < radiusX && dy < radiusY) return false;
      }
      return true;
    }

    const initial = {x: Math.random() * width, y: Math.random() * height};
    points.push(initial);
    active.push(initial);

    while (active.length > 0) {
      const idx = Math.floor(Math.random() * active.length);
      const {x: centerX, y: centerY} = active[idx];
      let found = false;

      for (let i = 0; i < k; i++) {
        const angle = Math.random() * twoPI;
        const rX = Math.cos(angle) * radiusX * (1 + Math.random());
        const rY = Math.sin(angle) * radiusY * (1 + Math.random());
        const candidate = {
          x: centerX + rX,
          y: centerY + rY,
        };

        if (candidate.x >= 0 && candidate.x < width && candidate.y >= 0 && candidate.y < height && isValid(candidate)) {
          points.push(candidate);
          active.push(candidate);
          found = true;
          break;
        }
      }

      if (!found) active.splice(idx, 1);
    }

    const pointsLength = points.length;
    for (let i = 0; i < pointsLength; i++) {
      binArray[Math.round(points[i].y) * width + Math.round(points[i].x)] = 1;
    }

    return binArray;
  }

  function _noiseArray(width, height, threshold) {
    const sqSz = width * height;
    const array = new Uint8Array(sqSz);
    for (let i = 0; i < sqSz; i++) {
      array[i] = Math.random() > threshold ? 1 : 0;
    }

    return array;
  }

  /**
   * Gaussian blurring with wrap around
   *
   * @param {array} inArray - Input array
   * @param {int} width
   * @param {int} height
   * @param {array} kernel - Input kernel
   * @param {array} blurred
   * @param {array} kernelWidth
   * @param {array} kernelHeight
   */

  function _blurWrap(inArray, width, height, kernel, blurred, kernelWidth, kernelHeight) {
    // divide by 2 + flooring
    const kHalfW = kernelWidth >> 1;
    const kHalfH = kernelHeight >> 1;

    const wMask = width - 1;
    const hMask = height - 1;

    const isPowerOf2W = (width & wMask) === 0;
    const isPowerOf2H = (height & hMask) === 0;

    for (let y = 0; y < height; y++) {
      const yOffs = y * width;

      for (let x = 0; x < width; x++) {
        let sum = 0;

        for (let ky = 0; ky < kernelHeight; ky++) {
          let iy = y + ky - kHalfH;
          if (isPowerOf2H) iy &= hMask;
          else if (iy < 0) iy += height;
          else if (iy >= height) iy -= height;

          const iyOffs = iy * width;
          const kernelYOffs = ky * kernelWidth;

          for (let kx = 0; kx < kernelWidth; kx++) {
            let ix = x + kx - kHalfW;
            if (isPowerOf2W) ix &= wMask;
            else if (ix < 0) ix += width;
            else if (ix >= width) ix -= width;

            sum += inArray[iyOffs + ix] * kernel[kernelYOffs + kx];
          }
        }

        blurred[yOffs + x] = sum;
      }
    }
  }

  /**
   * Gaussian delta updater
   *
   * @param {int} width
   * @param {int} height
   * @param {int} idx - The index of the blurred array that is going to be added by <amount>
   * @param {float} amount
   * @param {binary[]} blurredArray Blurred array input, also known as energy array
   * @param {array} kernel - Input kernel
   */

  function _deltaBlurUpdate(width, height, idx, amount, blurred, kernel, kernelWidth, kernelHeight) {
    const iy = Math.floor(idx / width);
    const ix = idx % width;
    const kHalfW = Math.floor(kernelWidth / 2);
    const kHalfH = Math.floor(kernelHeight / 2);

    for (let ky = 0; ky < kernelHeight; ky++) {
      const y = (iy + ky - kHalfH + height) % height;

      for (let kx = 0; kx < kernelWidth; kx++) {
        const x = (ix + kx - kHalfW + width) % width;

        // map 2D kernel coordinates to 1D index
        const kIdx = ky * kernelWidth + kx;
        blurred[y * width + x] += kernel[kIdx] * amount;
      }
    }
  }

  //function _gradientToCenterKernel(width, height) {
  //  if (width % 2 === 0) throw new Error("Odd width required");
  //  if (height % 2 === 0) throw new Error("Odd height required");
  //
  //  const sqSz = width * height;
  //  const halfX = (width - 1) / 2;
  //  const halfY = (height - 1) / 2;
  //  const outArray = new Float32Array(sqSz);
  //
  //  const rMax = Math.sqrt(halfX * halfX + halfY * halfY);
  //
  //  let idx = 0;
  //  for (let y = -halfY; y <= halfY; y++) {
  //    const y2 = y * y;
  //
  //    for (let x = -halfX; x <= halfX; x++) {
  //      outArray[idx++] = 1 - Math.sqrt(x * x + y2) / rMax;
  //    }
  //  }
  //
  //  return outArray;
  //}

  return {
    poissonDiskSampling: _poissonDiskSampling,
    noiseArray: _noiseArray,
    blurWrap: _blurWrap,
    deltaBlurUpdate: _deltaBlurUpdate,
    //gradientToCenterKernel: _gradientToCenterKernel,
  };
})();
