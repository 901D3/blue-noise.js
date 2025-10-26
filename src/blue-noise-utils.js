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

  /**
   *
   * @param {*} width
   * @param {*} height
   * @param {*} radiusX
   * @param {*} radiusY
   * @param {*} k
   * @returns
   */

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
      array[i] = Math.random() < threshold ? 0 : 1;
    }

    return array;
  }

  /**
   * Blurring with wrap around
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} kernel
   * @param {*} blurred
   * @param {*} kernelWidth
   * @param {*} kernelHeight
   */

  function _blurWrapInPlace(inArray, width, height, kernel, blurred, kernelWidth, kernelHeight) {
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
   * Blur delta updater
   *
   * @param {*} width
   * @param {*} height
   * @param {*} idx
   * @param {*} amount
   * @param {*} blurred
   * @param {*} kernel
   * @param {*} kernelWidth
   * @param {*} kernelHeight
   */

  function _deltaBlurUpdateInPlace(width, height, idx, amount, blurred, kernel, kernelWidth, kernelHeight) {
    const iy = Math.floor(idx / width);
    const ix = idx % width;
    const kHalfW = -(kernelWidth >> 1) + width;
    const kHalfH = -(kernelHeight >> 1) + height;

    const iyOffs = iy + kHalfH;
    const ixOffs = ix + kHalfW;

    for (let ky = 0; ky < kernelHeight; ky++) {
      const yOffs = ((ky + iyOffs) % height) * width;
      const kyOffs = ky * kernelWidth;

      for (let kx = 0; kx < kernelWidth; kx++) {
        blurred[yOffs + ((kx + ixOffs) % width)] += kernel[kyOffs + kx] * amount;
      }
    }
  }

  const gaussianKernelLUTArrayLiteral = new Map();

  /**
   *
   * @param {*} sigma
   * @returns
   */

  function _getGaussianKernelLUTArrayLiteral(sigma) {
    const radius = Math.ceil(3 * sigma);

    if (!gaussianKernelLUTArrayLiteral.has(sigma)) {
      const kernelSize = 2 * radius + 1;
      const kernel = Array(kernelSize)
        .fill(null)
        .map(() => Array(kernelSize).fill(0));
      const denom = 2 * sigma * sigma;

      for (let y = -radius; y <= radius; y++) {
        const dbY = y * y;
        const yOffs = y + radius;

        for (let x = -radius; x <= radius; x++) {
          kernel[yOffs][x + radius] = Math.exp(-(x * x + dbY) / denom);
        }
      }

      gaussianKernelLUTArrayLiteral.set(sigma, kernel);
    }

    return gaussianKernelLUTArrayLiteral.get(sigma);
  }

  /**
   *
   * @param {*} width
   * @param {*} height
   * @param {*} equation
   * @param {*} kernel
   * @param {*} normalize
   */

  function _generateWindowedKernelInPlace(width, height, equation, kernel, normalize) {
    if ((width & 1) === 0) throw new Error("Odd width required");
    if ((height & 2) === 0) throw new Error("Odd height required");
    const cp = new Function("r", "N", "return " + equation);

    const sqSz = width * height;
    const halfX = (width - 1) / 2;
    const halfY = (height - 1) / 2;

    const N = Math.sqrt(halfX * halfX + halfY * halfY);

    let idx = 0;
    let maxValue = 0;
    for (let y = -halfY; y <= halfY; y++) {
      const y2 = y * y;

      for (let x = -halfX; x <= halfX; x++) {
        const r = Math.sqrt(x * x + y2);
        const calculated = cp(r, N);
        kernel[idx++] = calculated;
        if (maxValue < calculated) maxValue = calculated;
      }
    }

    for (let i = 0; i < sqSz; i++) kernel[i] = maxValue - kernel[i];

    if (normalize) {
      for (let i = 0; i < sqSz; i++) kernel[i] /= maxValue;
    }
  }

  /**
   *
   * @param {*} width
   * @param {*} height
   * @param {*} equation
   * @param {*} normalize
   * @returns
   */

  function _generateWindowedKernelArrayLiteral(width, height, equation, normalize) {
    if ((width & 1) === 0) throw new Error("Odd width required");
    if ((height & 1) === 0) throw new Error("Odd height required");
    const cp = new Function("r", "N", "return " + equation);

    const halfX = (width - 1) / 2;
    const halfY = (height - 1) / 2;
    const kernel = Array(height)
      .fill(null)
      .map(() => Array(width).fill(0));

    const N = Math.sqrt(halfX * halfX + halfY * halfY);

    let maxValue = 0;
    for (let y = -halfY; y <= halfY; y++) {
      const y2 = y * y;

      for (let x = -halfX; x <= halfX; x++) {
        const r = Math.sqrt(x * x + y2);
        const calculated = cp(r, N * 2);
        kernel[y + halfY][x + halfX] = calculated;
        if (maxValue < calculated) maxValue = calculated;
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        kernel[y][x] = maxValue - kernel[y][x];
      }
    }

    if (normalize) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          kernel[y][x] /= maxValue;
        }
      }
    }

    return kernel;
  }

  return {
    poissonDiskSampling: _poissonDiskSampling,
    noiseArray: _noiseArray,
    blurWrapInPlace: _blurWrapInPlace,
    deltaBlurUpdateInPlace: _deltaBlurUpdateInPlace,
    getGaussianKernelLUTArrayLiteral: _getGaussianKernelLUTArrayLiteral,
    generateWindowedKernelInPlace: _generateWindowedKernelInPlace,
    generateWindowedKernelArrayLiteral: _generateWindowedKernelArrayLiteral,
  };
})();
