/**
 * Free JS implementation of Void and Cluster method by Robert Ulichney
 * Ultra optimized while keeping it readable
 * The result is high quality blue noise but somehow very fast
 *
 * Utilities for blue noise
 * https://github.com/901D3/blue-noise.js
 *
 * Copyright (c) 901D3
 * This code and the whole project is licensed with GPLv3 license
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
   * Simple function for getting Gaussian kernel + LUT
   * Float16Array
   *
   * @param {float} sigma
   * @returns {array}
   */

  const gaussianKernelLUTFloat16 = new Map();

  function _getGaussianKernelLUTFloat16(sigma) {
    const radius = Math.ceil(3 * sigma);

    if (!gaussianKernelLUTFloat16.has(sigma)) {
      const kernelSize = 2 * radius + 1;
      const kernel = new Float16Array(Math.pow(kernelSize, 2));
      let sum = 0;
      const denom = 2 * Math.pow(sigma, 2);

      for (let y = -radius; y <= radius; y++) {
        const yOffs = (y + radius) * kernelSize;

        for (let x = -radius; x <= radius; x++) {
          const val = Math.exp(-(x * x + y * y) / denom);
          kernel[yOffs + (x + radius)] = val;
          sum += val;
        }
      }

      for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

      gaussianKernelLUTFloat16.set(sigma, kernel);
    }

    return gaussianKernelLUTFloat16.get(sigma);
  }

  /**
   * Simple function for getting Gaussian kernel + LUT
   * Float32Array
   *
   * @param {float} sigma
   * @returns {array}
   */

  const gaussianKernelLUTFloat32 = new Map();

  function _getGaussianKernelLUTFloat32(sigma) {
    const radius = Math.ceil(3 * sigma);

    if (!gaussianKernelLUTFloat32.has(sigma)) {
      const kernelSize = 2 * radius + 1;
      const kernel = new Float32Array(Math.pow(kernelSize, 2));
      let sum = 0;
      const denom = 2 * Math.pow(sigma, 2);

      for (let y = -radius; y <= radius; y++) {
        const yOffs = (y + radius) * kernelSize;

        for (let x = -radius; x <= radius; x++) {
          const val = Math.exp(-(x * x + y * y) / denom);
          kernel[yOffs + (x + radius)] = val;
          sum += val;
        }
      }

      for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

      gaussianKernelLUTFloat32.set(sigma, kernel);
    }

    return gaussianKernelLUTFloat32.get(sigma);
  }

  /**
   * Simple function for getting Gaussian kernel + LUT
   * Float64Array
   *
   * @param {float} sigma
   * @returns {array}
   */

  const gaussianKernelLUTFloat64 = new Map();

  function _getGaussianKernelLUTFloat64(sigma) {
    const radius = Math.ceil(3 * sigma);

    if (!gaussianKernelLUTFloat64.has(sigma)) {
      const kernelSize = 2 * radius + 1;
      const kernel = new Float64Array(Math.pow(kernelSize, 2));
      let sum = 0;
      const denom = 2 * Math.pow(sigma, 2);

      for (let y = -radius; y <= radius; y++) {
        const yOffs = (y + radius) * kernelSize;

        for (let x = -radius; x <= radius; x++) {
          const val = Math.exp(-(x * x + y * y) / denom);
          kernel[yOffs + (x + radius)] = val;
          sum += val;
        }
      }

      for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

      gaussianKernelLUTFloat64.set(sigma, kernel);
    }

    return gaussianKernelLUTFloat64.get(sigma);
  }

  /**
   * Gaussian blurring with wrap around
   *
   * @param {array} inArray - Input array that is going to go through blurring
   * @param {int} width
   * @param {int} height
   * @param {array} kernel - Input kernel
   * @param {array} outArray - Output array, parse an existing array to this arg and after blurring, the result is stored inside that existing array
   */

  function _blurWrap(inArray, width, height, kernel, blurred, kernelWidth, kernelHeight) {
    const kHalfW = Math.floor(kernelWidth / 2);
    const kHalfH = Math.floor(kernelHeight / 2);

    for (let y = 0; y < height; y++) {
      const yOffs = y * width;

      for (let x = 0; x < width; x++) {
        let sum = 0;

        for (let ky = 0; ky < kernelHeight; ky++) {
          // wrap-around correctly
          const iy = (y + ky - kHalfH + height) % height;
          const iyOffs = iy * width;
          const kernelYOffs = ky * kernelWidth;

          for (let kx = 0; kx < kernelWidth; kx++) {
            const ix = (x + kx - kHalfW + width) % width;
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
   * @param {int} idx The index of the blurred array that is going to be added by <amount>
   * @param {float} amount
   * @param {array} blurredArray Blurred array input, also known as energy array
   * @param {array} kernel Gaussian kernel, usually from _getGaussianKernelLUT()
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

  return {
    poissonDiskSampling: _poissonDiskSampling,
    noiseArray: _noiseArray,
    getGaussianKernelLUTFloat16: _getGaussianKernelLUTFloat16,
    getGaussianKernelLUTFloat32: _getGaussianKernelLUTFloat32,
    getGaussianKernelLUTFloat64: _getGaussianKernelLUTFloat64,
    blurWrap: _blurWrap,
    deltaBlurUpdate: _deltaBlurUpdate,
  };
})();
