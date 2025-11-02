/**
 * Free JS implementation of Void and Cluster method by Robert Ulichney and other methods
 * Remember to link this script
 *
 * v0.2.2
 * https://github.com/901D3/blue-noise.js
 *
 * Copyright (c) 901D3
 * This code is licensed with GPLv3 license
 */

"use strict";

const blueNoiseUtils = (function () {
  let _gaussianSigmaRadiusMultiplier = 4;
  //Helpers

  // Unused
  /**
   *
   * @param {*} width
   * @param {*} height
   * @param {*} radiusX
   * @param {*} radiusY
   * @param {*} k
   * @returns
   */

  /*
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
  */

  // Updated
  /**
   *
   * @param {*} width
   * @param {*} height
   * @param {*} threshold
   * @returns
   */

  function _noiseArray(width, height, density) {
    const sqSz = width * height;
    const array = new Uint8Array(sqSz);
    for (let i = 0; i < sqSz; i++) array[i] = i < sqSz * density ? 1 : 0;

    for (let i = sqSz - 1; i >= 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
  }

  /**
   * Blurring with wrap around
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} blurred
   * @param {*} kernel
   * @param {*} kernelWidth
   * @param {*} kernelHeight
   */

  function _blurWrapInPlace(inArray, width, height, blurred, kernel, kernelWidth, kernelHeight) {
    const kernelHalfWidth = kernelWidth >> 1;
    const kernelHalfHeight = kernelHeight >> 1;

    for (let y = 0; y < height; y++) {
      const yOffs = y * width;
      const ykernelHalfHeight = y - kernelHalfHeight;

      for (let x = 0; x < width; x++) {
        const xkernelHalfWidth = x - kernelHalfWidth;
        let sum = 0;

        for (let kernelY = 0; kernelY < kernelHeight; kernelY++) {
          let inArrayY = kernelY + ykernelHalfHeight;
          while (inArrayY < 0) inArrayY += height;
          while (inArrayY >= height) inArrayY -= height;

          const inArrayYOffs = inArrayY * width;
          const kernelYOffs = kernelY * kernelWidth;

          for (let kernelX = 0; kernelX < kernelWidth; kernelX++) {
            let inArrayX = kernelX + xkernelHalfWidth;
            while (inArrayX < 0) inArrayX += width;
            while (inArrayX >= width) inArrayX -= width;

            sum += inArray[inArrayYOffs + inArrayX] * kernel[kernelYOffs + kernelX];
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
    const inArrayY = Math.floor(idx / width);
    let inArrayX = idx;
    while (inArrayX < 0) inArrayX += width;
    while (inArrayX >= width) inArrayX -= width;

    const kernelHalfWidth = -(kernelWidth >> 1) + width;
    const kernelHalfHeight = -(kernelHeight >> 1) + height;

    const inArrayYOffs = inArrayY + kernelHalfHeight;
    const inArrayXOffs = inArrayX + kernelHalfWidth;

    kernel = kernel.slice();
    const kernelSqSz = kernelWidth * kernelHeight;

    for (let i = 0; i < kernelSqSz; i++) kernel[i] *= amount;

    for (let kernelY = 0; kernelY < kernelHeight; kernelY++) {
      let blurredY = kernelY + inArrayYOffs;
      while (blurredY < 0) blurredY += height;
      while (blurredY >= height) blurredY -= height;

      const yOffs = blurredY * width;
      const kernelYOffs = kernelY * kernelWidth;

      for (let kernelX = 0; kernelX < kernelWidth; kernelX++) {
        let blurredX = kernelX + inArrayXOffs;
        while (blurredX < 0) blurredX += width;
        while (blurredX >= width) blurredX -= width;

        blurred[yOffs + blurredX] += kernel[kernelYOffs + kernelX];
      }
    }
  }

  function _computeEnergySigmaAt(inArray, width, height, idx, sigmaImage, sigmaSample, d) {
    let x = idx;
    while (x < 0) x += width;
    while (x >= width) x -= width;
    const y = Math.floor(idx / width);
    const radius = Math.ceil(_gaussianSigmaRadiusMultiplier * sigmaImage);
    const invSigmaImage2 = sigmaImage * sigmaImage;
    const invSigmaSample2 = sigmaSample * sigmaSample;
    const dimension = d / 2;

    let total = 0;
    const ps = inArray[idx];

    const yHeight = y + height;
    const xWidth = x + width;

    for (let dy = -radius; dy <= radius; dy++) {
      let ny = dy + yHeight;
      while (ny < 0) ny += height;
      while (ny >= height) ny -= height;

      const rowOffs = ny * width;

      let dyWrap = Math.abs(y - ny);
      if (dyWrap > height >> 1) dyWrap = height - dyWrap;
      dyWrap *= dyWrap;

      for (let dx = -radius; dx <= radius; dx++) {
        let nx = dx + xWidth;
        while (nx < 0) nx += width;
        while (nx >= width) nx -= width;

        let dxWrap = Math.abs(x - nx);
        if (dxWrap > width >> 1) dxWrap = width - dxWrap;

        total += Math.exp(
          -(dxWrap * dxWrap + dyWrap) * invSigmaImage2 -
            (Math.sqrt(Math.abs(ps - inArray[rowOffs + nx])) * invSigmaSample2) ** dimension
        );
      }
    }

    return total;
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

  return {
    get gaussianSigmaRadiusMultiplier() {
      return _gaussianSigmaRadiusMultiplier;
    },
    set gaussianSigmaRadiusMultiplier(value) {
      _gaussianSigmaRadiusMultiplier = value;
    },

    //poissonDiskSampling: _poissonDiskSampling,
    noiseArray: _noiseArray,
    blurWrapInPlace: _blurWrapInPlace,
    deltaBlurUpdateInPlace: _deltaBlurUpdateInPlace,
    computeEnergySigmaAt: _computeEnergySigmaAt,
    generateWindowedKernelInPlace: _generateWindowedKernelInPlace,
  };
})();
