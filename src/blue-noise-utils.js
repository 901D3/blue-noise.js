/**
 * Free JS implementation of Void and Cluster method by Robert Ulichney and other methods
 * Remember to link this script
 *
 * v0.2.4
 * https://github.com/901D3/blue-noise.js
 *
 * Copyright (c) 901D3
 * This code is licensed with GPLv3 license
 */

"use strict";

const blueNoiseUtils = (function () {
  //Helpers

  /**
   *
   * @param {*} inArray
   */

  const _shuffle = (inArray) => {
    for (let i = inArray.length - 1; i >= 0; i--) {
      const j = (Math.random() * (i - 1)) | 0;

      const tmp = inArray[i];
      inArray[i] = inArray[j];
      inArray[j] = tmp;
    }
  };

  /**
   * Convolving with wrap around
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} blurred
   * @param {*} kernel
   * @param {*} radiusWidth
   * @param {*} radiusHeight
   */

  const _convolveWrapAroundInPlace = (
    inArray,
    width,
    height,
    blurred,
    kernel,
    radiusWidth,
    radiusHeight
  ) => {
    const halfRadiusWidth = radiusWidth >> 1;
    const halfRadiusHeight = radiusHeight >> 1;

    for (let idxY = 0; idxY < height; idxY++) {
      const yOffs = idxY * width;
      const currentKernelCenteredIdxY = idxY - halfRadiusHeight;

      for (let idxX = 0; idxX < width; idxX++) {
        const currentKernelCenteredIdxX = idxX - halfRadiusWidth;
        let sum = 0;

        for (let kernelIdxY = 0; kernelIdxY < radiusHeight; kernelIdxY++) {
          const kernelIdxYOffs = kernelIdxY * radiusWidth;

          let convolveIdxY = (kernelIdxY + currentKernelCenteredIdxY) % height;
          if (convolveIdxY < 0) convolveIdxY += height;

          const convolveIdxYOffs = convolveIdxY * width;

          for (let kernelIdxX = 0; kernelIdxX < radiusWidth; kernelIdxX++) {
            let convolveIdxX = (kernelIdxX + currentKernelCenteredIdxX) % width;
            if (convolveIdxX < 0) convolveIdxX += width;

            sum +=
              inArray[convolveIdxYOffs + convolveIdxX] * kernel[kernelIdxYOffs + kernelIdxX];
          }
        }

        blurred[yOffs + idxX] = sum;
      }
    }
  };

  /**
   * Convolve delta updater with wrap around
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

  const _convolveDeltaUpdateWrapAroundInPlace = (
    width,
    height,
    idx,
    amount,
    blurred,
    kernel,
    radiusWidth,
    radiusHeight
  ) => {
    const idxY = (idx / width) | 0;
    const idxX = idx - idxY * width;

    const halfRadiusWidth = radiusWidth >> 1;
    const halfRadiusHeight = radiusHeight >> 1;

    const currentKernelCenteredIdxX = idxX - halfRadiusWidth;
    const currentKernelCenteredIdxY = idxY - halfRadiusHeight;

    for (let kernelIdxY = 0; kernelIdxY < radiusHeight; kernelIdxY++) {
      const kernelIdxYOffs = kernelIdxY * radiusWidth;

      let convolveIdxY = (kernelIdxY + currentKernelCenteredIdxY) % height;
      if (convolveIdxY < 0) convolveIdxY += height;

      const convolveIdxYOffs = convolveIdxY * width;

      for (let kernelIdxX = 0; kernelIdxX < radiusWidth; kernelIdxX++) {
        let convolveIdxX = (kernelIdxX + currentKernelCenteredIdxX) % width;
        if (convolveIdxX < 0) convolveIdxX += width;

        blurred[convolveIdxYOffs + convolveIdxX] +=
          kernel[kernelIdxYOffs + kernelIdxX] * amount;
      }
    }
  };

  /**
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} idx
   * @param {*} outArray
   * @param {*} radiusWidth
   * @param {*} radiusHeight
   */

  const _getConvolvedAreaWrapAroundInPlace = (
    inArray,
    width,
    height,
    idx,
    outArray,
    radiusWidth,
    radiusHeight
  ) => {
    const idxY = (idx / width) | 0;
    const idxX = idx - idxY * width;

    const halfRadiusWidth = radiusWidth >> 1;
    const halfRadiusHeight = radiusHeight >> 1;

    const currentKernelCenteredIdxX = idxX - halfRadiusWidth;
    const currentKernelCenteredIdxY = idxY - halfRadiusHeight;

    for (let kernelIdxY = 0; kernelIdxY < radiusHeight; kernelIdxY++) {
      const kernelIdxYOffs = kernelIdxY * radiusWidth;

      let convolveIdxY = (kernelIdxY + currentKernelCenteredIdxY) % height;
      if (convolveIdxY < 0) convolveIdxY += height;

      const convolveIdxYOffs = convolveIdxY * width;

      for (let kernelIdxX = 0; kernelIdxX < radiusWidth; kernelIdxX++) {
        let convolveIdxX = (kernelIdxX + currentKernelCenteredIdxX) % width;
        if (convolveIdxX < 0) convolveIdxX += width;

        outArray[kernelIdxYOffs + kernelIdxX] = inArray[convolveIdxYOffs + convolveIdxX];
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
   * @param {*} radiusWidth
   * @param {*} radiusHeight
   * @param {*} d
   * @returns
   */

  const _computeEnergy = (
    inArray,
    width,
    height,
    idx,
    sigmaImage,
    sigmaSample,
    radiusWidth,
    radiusHeight,
    d
  ) => {
    const idxY = (idx / width) | 0;
    const idxX = idx - idxY * width;
    const invSigmaImage2 = 1 / (sigmaImage * sigmaImage);
    const invSigmaSample2 = 1 / (sigmaSample * sigmaSample);
    const dimension = d / 2;

    const halfWidth = width >> 1;
    const halfHeight = height >> 1;

    let total = 0;
    const ps = inArray[idx];

    const halfRadiusWidth = radiusWidth >> 1;
    const halfRadiusHeight = radiusHeight >> 1;

    const currentKernelCenteredIdxX = idxX - halfRadiusWidth;
    const currentKernelCenteredIdxY = idxY - halfRadiusHeight;

    for (let kernelIdxY = 0; kernelIdxY < radiusHeight; kernelIdxY++) {
      let convolveIdxY = (kernelIdxY + currentKernelCenteredIdxY) % height;
      if (convolveIdxY < 0) convolveIdxY += height;

      const convolveIdxYOffs = convolveIdxY * width;

      let dyWrap = Math.abs(idxY - convolveIdxY);
      if (dyWrap > halfHeight) dyWrap = height - dyWrap;
      dyWrap *= dyWrap;

      for (let kernelIdxX = 0; kernelIdxX < radiusWidth; kernelIdxX++) {
        let convolveIdxX = (kernelIdxX + currentKernelCenteredIdxX) % width;
        if (convolveIdxX < 0) convolveIdxX += width;

        let dxWrap = Math.abs(idxX - convolveIdxX);
        if (dxWrap > halfWidth) dxWrap = width - dxWrap;

        total += Math.exp(
          -(dxWrap * dxWrap + dyWrap) * invSigmaImage2 -
            (Math.sqrt(Math.abs(ps - inArray[convolveIdxYOffs + convolveIdxX])) *
              invSigmaSample2) **
              dimension
        );
      }
    }

    return total;
  };

  return {
    shuffle: _shuffle,
    convolveWrapAroundInPlace: _convolveWrapAroundInPlace,
    blurWrapInPlace: _convolveWrapAroundInPlace,
    convolveDeltaUpdateWrapAroundInPlace: _convolveDeltaUpdateWrapAroundInPlace,
    deltaBlurUpdateInPlace: _convolveDeltaUpdateWrapAroundInPlace,
    getConvolvedAreaWrapAroundInPlace: _getConvolvedAreaWrapAroundInPlace,
    computeEnergy: _computeEnergy,
  };
})();
