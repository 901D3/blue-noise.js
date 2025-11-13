/**
 * Free JS implementation of Void and Cluster method by Robert Ulichney and other methods
 * Remember to link this script
 *
 * v0.2.21
 * https://github.com/901D3/blue-noise.js
 *
 * Copyright (c) 901D3
 * This code is licensed with GPLv3 license
 */

"use strict";

const blueNoiseUtils = (function () {
  let _gaussianSigmaRadiusMultiplier = 4;
  //Helpers

  /**
   *
   * @param {*} inArray
   */

  const _shuffle = (inArray) => {
    for (let length = inArray.length, i = length - 1; i >= 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      [inArray[i], inArray[j]] = [inArray[j], inArray[i]];
    }
  };

  /**
   * Blurring with wrap around
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} blurred
   * @param {*} kernel
   * @param {*} radiusWidth
   * @param {*} radiusHeight
   */

  const _blurWrapInPlace = (
    inArray,
    width,
    height,
    blurred,
    kernel,
    radiusWidth,
    radiusHeight
  ) => {
    const kernelHalfWidth = radiusWidth >> 1;
    const kernelHalfHeight = radiusHeight >> 1;

    for (let y = 0; y < height; y++) {
      const yOffs = y * width;
      const ykernelHalfHeight = y - kernelHalfHeight;

      for (let x = 0; x < width; x++) {
        const xkernelHalfWidth = x - kernelHalfWidth;
        let sum = 0;

        for (let kernelY = 0; kernelY < radiusHeight; kernelY++) {
          let inArrayY = (kernelY + ykernelHalfHeight) % height;
          if (inArrayY < 0) inArrayY += height;

          const inArrayYOffs = inArrayY * width;
          const kernelYOffs = kernelY * radiusWidth;

          for (let kernelX = 0; kernelX < radiusWidth; kernelX++) {
            let inArrayX = (kernelX + xkernelHalfWidth) % width;
            if (inArrayX < 0) inArrayX += width;

            sum += inArray[inArrayYOffs + inArrayX] * kernel[kernelYOffs + kernelX];
          }
        }

        blurred[yOffs + x] = sum;
      }
    }
  };

  /**
   * Blur delta updater
   *
   * @param {*} width
   * @param {*} height
   * @param {*} idx
   * @param {*} amount
   * @param {*} blurred
   * @param {*} kernel
   * @param {*} radiusWidth
   * @param {*} radiusHeight
   */

  const _deltaBlurUpdateInPlace = (
    width,
    height,
    idx,
    amount,
    blurred,
    kernel,
    radiusWidth,
    radiusHeight
  ) => {
    const inArrayX = idx - Math.floor(idx / width) * width;
    const inArrayY = Math.floor(idx / width);

    const kernelHalfWidth = -(radiusWidth >> 1) + width;
    const kernelHalfHeight = -(radiusHeight >> 1) + height;

    const inArrayYOffs = inArrayY + kernelHalfHeight;
    const inArrayXOffs = inArrayX + kernelHalfWidth;

    for (let kernelY = 0; kernelY < radiusHeight; kernelY++) {
      let blurredY = (kernelY + inArrayYOffs) % height;
      if (blurredY < 0) blurredY += height;

      const yOffs = blurredY * width;
      const kernelYOffs = kernelY * radiusWidth;

      for (let kernelX = 0; kernelX < radiusWidth; kernelX++) {
        let blurredX = (kernelX + inArrayXOffs) % width;
        if (blurredX < 0) blurredX += width;

        blurred[yOffs + blurredX] += kernel[kernelYOffs + kernelX] * amount;
      }
    }
  };

  /**
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} idx
   * @param {*} sigmaImage
   * @param {*} sigmaSample
   * @param {*} d
   * @returns
   */

  const _computeEnergySigmaAt = (inArray, width, height, idx, sigmaImage, sigmaSample, d) => {
    const x = idx - Math.floor(idx / width) * width;
    const y = Math.floor(idx / width);
    const radius = Math.ceil(_gaussianSigmaRadiusMultiplier * sigmaImage);
    const invSigmaImage2 = sigmaImage * sigmaImage;
    const invSigmaSample2 = sigmaSample * sigmaSample;
    const dimension = d / 2;

    let total = 0;
    const ps = inArray[idx];

    const yHeight = y + height;
    const xWidth = x + width;

    for (let radiusIdxY = -radius; radiusIdxY < radius; radiusIdxY++) {
      let ny = (radiusIdxY + yHeight) % height;
      if (ny < 0) ny += height;

      const rowOffs = ny * width;

      let dyWrap = Math.abs(y - ny);
      if (dyWrap > height >> 1) dyWrap = height - dyWrap;
      dyWrap *= dyWrap;

      for (let radiusIdxX = -radius; radiusIdxX < radius; radiusIdxX++) {
        let nx = (radiusIdxX + xWidth) % width;
        if (nx < 0) nx += width;

        let dxWrap = Math.abs(x - nx);
        if (dxWrap > width >> 1) dxWrap = width - dxWrap;

        total += Math.exp(
          -(dxWrap * dxWrap + dyWrap) * invSigmaImage2 -
            (Math.sqrt(Math.abs(ps - inArray[rowOffs + nx])) * invSigmaSample2) ** dimension
        );
      }
    }

    return total;
  };

  /**
   *
   * @param {*} width
   * @param {*} height
   * @param {*} equation
   * @param {*} kernel
   */

  const _generateWindowedKernelInPlace = (width, height, equation, kernel) => {
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

    for (let i = 0; i < sqSz; i++) kernel[i] = (maxValue - kernel[i]) / maxValue;
  };

  return {
    get gaussianSigmaRadiusMultiplier() {
      return _gaussianSigmaRadiusMultiplier;
    },
    set gaussianSigmaRadiusMultiplier(value) {
      _gaussianSigmaRadiusMultiplier = value;
    },

    shuffle: _shuffle,
    blurWrapInPlace: _blurWrapInPlace,
    deltaBlurUpdateInPlace: _deltaBlurUpdateInPlace,
    computeEnergySigmaAt: _computeEnergySigmaAt,
    generateWindowedKernelInPlace: _generateWindowedKernelInPlace,
  };
})();
