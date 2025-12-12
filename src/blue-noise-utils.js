/**
 * Free JS implementation of Void and Cluster method by Robert Ulichney and other methods
 * Remember to link this script
 *
 * v0.2.5
 * https://github.com/901D3/blue-noise.js
 *
 * Copyright (c) 901D3
 * This code is licensed with GPLv3 license
 */

"use strict";

const BlueNoiseUtils = (function () {
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
   * @param {*} blurredArray
   * @param {*} kernel
   * @param {*} radiusWidth
   * @param {*} radiusHeight
   */

  const _convolveWrapAroundInPlace = (
    inArray,
    width,
    height,
    blurredArray,
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

        blurredArray[yOffs + idxX] = sum;
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
   * @param {*} blurredArray
   * @param {*} kernel
   * @param {*} radiusWidth
   * @param {*} radiusHeight
   */

  const _convolveDeltaUpdateWrapAroundInPlace = (
    width,
    height,
    idx,
    amount,
    blurredArray,
    kernel,
    radiusWidth,
    radiusHeight
  ) => {
    const idxX = idx % width;
    const idxY = (idx / width) | 0;

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

        blurredArray[convolveIdxYOffs + convolveIdxX] +=
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
    const idxX = idx % width;
    const idxY = (idx / width) | 0;

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
   * @param {*} outArray
   * @param {*} radiusWidth
   * @param {*} radiusHeight
   */

  const _setConvolvedAreaWrapAroundInPlace = (
    inArray,
    width,
    height,
    idx,
    outArray,
    radiusWidth,
    radiusHeight
  ) => {
    const idxX = idx % width;
    const idxY = (idx / width) | 0;

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

        inArray[convolveIdxYOffs + convolveIdxX] = outArray[kernelIdxYOffs + kernelIdxX];
      }
    }
  };

  /**
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} blurredArray
   * @param {*} kernel
   * @param {*} radiusWidth
   * @param {*} radiusHeight
   */

  const _convolveInPlace = (
    inArray,
    width,
    height,
    blurredArray,
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
          const convolveIdxY = kernelIdxY + currentKernelCenteredIdxY;
          if (convolveIdxY < 0 || convolveIdxY >= height) continue;

          const convolveIdxYOffs = convolveIdxY * width;

          for (let kernelIdxX = 0; kernelIdxX < radiusWidth; kernelIdxX++) {
            const convolveIdxX = kernelIdxX + currentKernelCenteredIdxX;
            if (convolveIdxX < 0 || convolveIdxX >= width) continue;

            sum +=
              inArray[convolveIdxYOffs + convolveIdxX] * kernel[kernelIdxYOffs + kernelIdxX];
          }
        }

        blurredArray[yOffs + idxX] = sum;
      }
    }
  };

  /**
   *
   * @param {*} width
   * @param {*} height
   * @param {*} idx
   * @param {*} amount
   * @param {*} blurredArray
   * @param {*} kernel
   * @param {*} radiusWidth
   * @param {*} radiusHeight
   */

  const _convolveDeltaUpdateInPlace = (
    width,
    height,
    idx,
    amount,
    blurredArray,
    kernel,
    radiusWidth,
    radiusHeight
  ) => {
    const idxX = idx % width;
    const idxY = (idx / width) | 0;

    const halfRadiusWidth = radiusWidth >> 1;
    const halfRadiusHeight = radiusHeight >> 1;

    const currentKernelCenteredIdxX = idxX - halfRadiusWidth;
    const currentKernelCenteredIdxY = idxY - halfRadiusHeight;

    for (let kernelIdxY = 0; kernelIdxY < radiusHeight; kernelIdxY++) {
      const kernelIdxYOffs = kernelIdxY * radiusWidth;
      const convolveIdxY = kernelIdxY + currentKernelCenteredIdxY;
      if (convolveIdxY < 0 || convolveIdxY >= height) continue;

      const convolveIdxYOffs = convolveIdxY * width;

      for (let kernelIdxX = 0; kernelIdxX < radiusWidth; kernelIdxX++) {
        const convolveIdxX = kernelIdxX + currentKernelCenteredIdxX;
        if (convolveIdxX < 0 || convolveIdxX >= width) continue;

        blurredArray[convolveIdxYOffs + convolveIdxX] +=
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

  const _getConvolvedAreaInPlace = (
    inArray,
    width,
    height,
    idx,
    outArray,
    radiusWidth,
    radiusHeight
  ) => {
    const idxX = idx % width;
    const idxY = (idx / width) | 0;

    const halfRadiusWidth = radiusWidth >> 1;
    const halfRadiusHeight = radiusHeight >> 1;

    const currentKernelCenteredIdxX = idxX - halfRadiusWidth;
    const currentKernelCenteredIdxY = idxY - halfRadiusHeight;

    for (let kernelIdxY = 0; kernelIdxY < radiusHeight; kernelIdxY++) {
      const kernelIdxYOffs = kernelIdxY * radiusWidth;
      const convolveIdxY = kernelIdxY + currentKernelCenteredIdxY;
      if (convolveIdxY < 0 || convolveIdxY >= height) continue;

      const convolveIdxYOffs = convolveIdxY * width;

      for (let kernelIdxX = 0; kernelIdxX < radiusWidth; kernelIdxX++) {
        const convolveIdxX = kernelIdxX + currentKernelCenteredIdxX;
        if (convolveIdxX < 0 || convolveIdxX >= width) continue;

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
   * @param {*} outArray
   * @param {*} radiusWidth
   * @param {*} radiusHeight
   */

  const _setConvolvedAreaInPlace = (
    inArray,
    width,
    height,
    idx,
    outArray,
    radiusWidth,
    radiusHeight
  ) => {
    const idxX = idx % width;
    const idxY = (idx / width) | 0;

    const halfRadiusWidth = radiusWidth >> 1;
    const halfRadiusHeight = radiusHeight >> 1;

    const currentKernelCenteredIdxX = idxX - halfRadiusWidth;
    const currentKernelCenteredIdxY = idxY - halfRadiusHeight;

    for (let kernelIdxY = 0; kernelIdxY < radiusHeight; kernelIdxY++) {
      const kernelIdxYOffs = kernelIdxY * radiusWidth;
      const convolveIdxY = kernelIdxY + currentKernelCenteredIdxY;
      if (convolveIdxY < 0 || convolveIdxY >= height) continue;

      const convolveIdxYOffs = convolveIdxY * width;

      for (let kernelIdxX = 0; kernelIdxX < radiusWidth; kernelIdxX++) {
        const convolveIdxX = kernelIdxX + currentKernelCenteredIdxX;
        if (convolveIdxX < 0 || convolveIdxX >= width) continue;

        inArray[convolveIdxYOffs + convolveIdxX] = outArray[kernelIdxYOffs + kernelIdxX];
      }
    }
  };

  /**
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} idx
   * @param {*} sigmaSample
   * @param {*} d
   * @param {*} kernel
   * @param {*} radiusWidth
   * @param {*} radiusHeight
   * @returns
   */

  const _computeEnergyGeorgevFajardoWrapAround = (
    inArray,
    width,
    height,
    idx,
    sigmaSample,
    d,
    kernel,
    radiusWidth,
    radiusHeight
  ) => {
    const idxX = idx % width;
    const idxY = (idx / width) | 0;

    const halfRadiusWidth = radiusWidth >> 1;
    const halfRadiusHeight = radiusHeight >> 1;

    const currentKernelCenteredIdxX = idxX - halfRadiusWidth;
    const currentKernelCenteredIdxY = idxY - halfRadiusHeight;

    const invSigmaSample2 = 1 / (sigmaSample * sigmaSample);
    const dimension = d / 2;

    const centerConvolveIdx = inArray[idx];

    let total = 0;

    for (let kernelIdxY = 0; kernelIdxY < radiusHeight; kernelIdxY++) {
      const kernelIdxYOffs = kernelIdxY * radiusWidth;

      let convolveIdxY = (kernelIdxY + currentKernelCenteredIdxY) % height;
      if (convolveIdxY < 0) convolveIdxY += height;

      const convolveIdxYOffs = convolveIdxY * width;

      for (let kernelIdxX = 0; kernelIdxX < radiusWidth; kernelIdxX++) {
        let convolveIdxX = (kernelIdxX + currentKernelCenteredIdxX) % width;
        if (convolveIdxX < 0) convolveIdxX += width;

        total +=
          kernel[kernelIdxYOffs + kernelIdxX] *
          Math.exp(
            -(
              Math.abs(centerConvolveIdx - inArray[convolveIdxYOffs + convolveIdxX]) **
                dimension *
              invSigmaSample2
            )
          );
      }
    }

    return total;
  };

  /**
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} color
   * @param {*} referenceIdx
   * @returns
   */

  const _computeCentroidWrapAround = (inArray, width, height) => {
    const count = inArray.length;

    const referenceIdx = inArray[0];
    const referenceIdxY = (referenceIdx / width) | 0;
    const referenceIdxX = referenceIdx - width * referenceIdxY;

    if (count === 0) {
      return {
        idxX: referenceIdxX,
        idxY: referenceIdxY,
      };
    }

    const halfWidth = width >> 1;
    const halfHeight = height >> 1;

    let sumX = 0;
    let sumY = 0;

    for (let i = 0; i < count; i++) {
      const idx = inArray[i];
      let idxX = (idx % width) - referenceIdxX;
      let idxY = ((idx / width) | 0) - referenceIdxY;

      if (idxX > halfWidth) idxX -= width;
      else if (idxX < -halfWidth) idxX += width;

      if (idxY > halfHeight) idxY -= height;
      else if (idxY < -halfHeight) idxY += height;

      sumX += idxX;
      sumY += idxY;
    }

    let idxX = (referenceIdxX + sumX / count) % width;
    let idxY = (referenceIdxY + sumY / count) % height;

    if (idxX < 0) idxX += width;
    if (idxY < 0) idxY += height;

    return {
      idxX,
      idxY,
    };
  };

  return {
    shuffle: _shuffle,

    convolveWrapAroundInPlace: _convolveWrapAroundInPlace,
    convolveDeltaUpdateWrapAroundInPlace: _convolveDeltaUpdateWrapAroundInPlace,
    getConvolvedAreaWrapAroundInPlace: _getConvolvedAreaWrapAroundInPlace,
    setConvolvedAreaWrapAroundInPlace: _setConvolvedAreaWrapAroundInPlace,

    convolveInPlace: _convolveInPlace,
    convolveDeltaUpdateInPlace: _convolveDeltaUpdateInPlace,
    getConvolvedAreaInPlace: _getConvolvedAreaInPlace,
    setConvolvedAreaInPlace: _setConvolvedAreaInPlace,

    computeEnergyGeorgevFajardoWrapAround: _computeEnergyGeorgevFajardoWrapAround,

    computeCentroidWrapAround: _computeCentroidWrapAround,
  };
})();
