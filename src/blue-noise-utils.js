/**
 * Free JS implementation of Void and Cluster method by Robert Ulichney and other methods
 * Remember to link this script
 *
 * v0.2.6.1
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
      const j = (Math.random() * (i + 1)) | 0;

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
   * @param {*} kernelArray
   * @param {*} kernelWidth
   * @param {*} kernelHeight
   */

  const _convolveWrapAroundInPlace = (
    inArray,
    blurredArray,
    width,
    height,
    kernelArray,
    kernelWidth,
    kernelHeight
  ) => {
    const halfkernelWidth = kernelWidth >> 1;
    const halfkernelHeight = kernelHeight >> 1;

    for (let idxY = 0; idxY < height; idxY++) {
      const yOffs = idxY * width;
      const currentKernelCenteredIdxY = idxY - halfkernelHeight;

      for (let idxX = 0; idxX < width; idxX++) {
        const currentKernelCenteredIdxX = idxX - halfkernelWidth;
        let total = 0;

        for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
          const kernelIdxYOffs = kernelIdxY * kernelWidth;
          const convolveIdxYOffs =
            ((kernelIdxY + currentKernelCenteredIdxY + height) % height) * width;

          for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
            total +=
              inArray[
                convolveIdxYOffs + ((kernelIdxX + currentKernelCenteredIdxX + width) % width)
              ] * kernelArray[kernelIdxYOffs + kernelIdxX];
          }
        }

        blurredArray[yOffs + idxX] = total;
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
   * @param {*} kernelArray
   * @param {*} kernelWidth
   * @param {*} kernelHeight
   */

  const _convolveAddWrapAroundInPlace = (
    blurredArray,
    width,
    height,
    idx,
    amount,
    kernelArray,
    kernelWidth,
    kernelHeight
  ) => {
    const idxX = idx % width;
    const idxY = (idx / width) | 0;

    const currentKernelCenteredIdxX = idxX - (kernelWidth >> 1);
    const currentKernelCenteredIdxY = idxY - (kernelHeight >> 1);

    for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
      const kernelIdxYOffs = kernelIdxY * kernelWidth;
      const convolveIdxYOffs =
        ((kernelIdxY + currentKernelCenteredIdxY + height) % height) * width;

      for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
        blurredArray[
          convolveIdxYOffs + ((kernelIdxX + currentKernelCenteredIdxX + width) % width)
        ] += kernelArray[kernelIdxYOffs + kernelIdxX] * amount;
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
   * @param {*} kernelWidth
   * @param {*} kernelHeight
   */

  const _getConvolvedAreaWrapAroundInPlace = (
    inArray,
    width,
    height,
    idx,
    outArray,
    kernelWidth,
    kernelHeight
  ) => {
    const idxX = idx % width;
    const idxY = (idx / width) | 0;

    const currentKernelCenteredIdxX = idxX - (kernelWidth >> 1);
    const currentKernelCenteredIdxY = idxY - (kernelHeight >> 1);

    for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
      const kernelIdxYOffs = kernelIdxY * kernelWidth;
      const convolveIdxYOffs =
        ((kernelIdxY + currentKernelCenteredIdxY + height) % height) * width;

      for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
        outArray[kernelIdxYOffs + kernelIdxX] =
          inArray[
            convolveIdxYOffs + ((kernelIdxX + currentKernelCenteredIdxX + width) % width)
          ];
      }
    }
  };

  const _getConvolvedAreaDotProductWrapAroundInPlace = (
    inArray,
    width,
    height,
    idx,
    kernelArray,
    kernelWidth,
    kernelHeight
  ) => {
    const idxX = idx % width;
    const idxY = (idx / width) | 0;

    const currentKernelCenteredIdxX = idxX - (kernelWidth >> 1);
    const currentKernelCenteredIdxY = idxY - (kernelHeight >> 1);

    let total = 0;

    for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
      const kernelIdxYOffs = kernelIdxY * kernelWidth;
      const convolveIdxYOffs =
        ((kernelIdxY + currentKernelCenteredIdxY + height) % height) * width;

      for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
        total +=
          inArray[
            convolveIdxYOffs + ((kernelIdxX + currentKernelCenteredIdxX + width) % width)
          ] * kernelArray[kernelIdxYOffs + kernelIdxX];
      }
    }

    return total;
  };

  const _convolveInPlace = (
    inArray,
    blurredArray,
    width,
    height,
    kernelArray,
    kernelWidth,
    kernelHeight
  ) => {
    const halfkernelWidth = kernelWidth >> 1;
    const halfkernelHeight = kernelHeight >> 1;

    for (let idxY = 0; idxY < height; idxY++) {
      const yOffs = idxY * width;
      const currentKernelCenteredIdxY = idxY - halfkernelHeight;

      for (let idxX = 0; idxX < width; idxX++) {
        const currentKernelCenteredIdxX = idxX - halfkernelWidth;
        let total = 0;

        for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
          const convolveIdxY = kernelIdxY + currentKernelCenteredIdxY;
          if (convolveIdxY < 0 || convolveIdxY >= height) continue;

          const convolveIdxYOffs = convolveIdxY * width;
          const kernelIdxYOffs = kernelIdxY * kernelWidth;

          for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
            const convolveIdxX = kernelIdxX + currentKernelCenteredIdxX;
            if (convolveIdxX < 0 || convolveIdxX >= width) continue;

            total +=
              inArray[convolveIdxYOffs + convolveIdxX] *
              kernelArray[kernelIdxYOffs + kernelIdxX];
          }
        }

        blurredArray[yOffs + idxX] = total;
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
   * @param {*} kernelArray
   * @param {*} kernelWidth
   * @param {*} kernelHeight
   */

  const _convolveAddInPlace = (
    blurredArray,
    width,
    height,
    idx,
    amount,
    kernelArray,
    kernelWidth,
    kernelHeight
  ) => {
    const idxX = idx % width;
    const idxY = (idx / width) | 0;

    const currentKernelCenteredIdxX = idxX - (kernelWidth >> 1);
    const currentKernelCenteredIdxY = idxY - (kernelHeight >> 1);

    for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
      const convolveIdxY = kernelIdxY + currentKernelCenteredIdxY;
      if (convolveIdxY < 0 || convolveIdxY >= height) continue;

      const kernelIdxYOffs = kernelIdxY * kernelWidth;
      const convolveIdxYOffs = convolveIdxY * width;

      for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
        const convolveIdxX = kernelIdxX + currentKernelCenteredIdxX;
        if (convolveIdxX < 0 || convolveIdxX >= width) continue;

        blurredArray[convolveIdxYOffs + convolveIdxX] +=
          kernelArray[kernelIdxYOffs + kernelIdxX] * amount;
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
   * @param {*} kernelWidth
   * @param {*} kernelHeight
   */

  const _getConvolvedAreaInPlace = (
    inArray,
    width,
    height,
    idx,
    outArray,
    kernelWidth,
    kernelHeight
  ) => {
    const idxX = idx % width;
    const idxY = (idx / width) | 0;

    const currentKernelCenteredIdxX = idxX - (kernelWidth >> 1);
    const currentKernelCenteredIdxY = idxY - (kernelHeight >> 1);

    for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
      const kernelIdxYOffs = kernelIdxY * kernelWidth;
      const convolveIdxY = kernelIdxY + currentKernelCenteredIdxY;
      if (convolveIdxY < 0 || convolveIdxY >= height) continue;

      const convolveIdxYOffs = convolveIdxY * width;

      for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
        const convolveIdxX = kernelIdxX + currentKernelCenteredIdxX;
        if (convolveIdxX < 0 || convolveIdxX >= width) continue;

        outArray[kernelIdxYOffs + kernelIdxX] = inArray[convolveIdxYOffs + convolveIdxX];
      }
    }
  };

  const _getConvolvedAreaDotProductInPlace = (
    inArray,
    width,
    height,
    idx,
    kernelArray,
    kernelWidth,
    kernelHeight
  ) => {
    const idxX = idx % width;
    const idxY = (idx / width) | 0;

    const currentKernelCenteredIdxX = idxX - (kernelWidth >> 1);
    const currentKernelCenteredIdxY = idxY - (kernelHeight >> 1);

    let total = 0;

    for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
      const kernelIdxYOffs = kernelIdxY * kernelWidth;
      const convolveIdxY = kernelIdxY + currentKernelCenteredIdxY;
      if (convolveIdxY < 0 || convolveIdxY >= height) continue;

      const convolveIdxYOffs = convolveIdxY * width;

      for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
        const convolveIdxX = kernelIdxX + currentKernelCenteredIdxX;
        if (convolveIdxX < 0 || convolveIdxX >= width) continue;

        total +=
          inArray[convolveIdxYOffs + convolveIdxX] * kernelArray[kernelIdxYOffs + kernelIdxX];
      }
    }

    return total;
  };

  /**
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} idx
   * @param {*} sigmaSample
   * @param {*} pNorm
   * @param {*} kernelArray
   * @param {*} kernelWidth
   * @param {*} kernelHeight
   * @returns
   */

  const _computeTotalEnergyGeorgevFajardoWrapAroundInPlace = (
    inArray,
    energyArray,
    width,
    height,
    sigmaSample,
    pNorm,
    kernelArray,
    kernelWidth,
    kernelHeight
  ) => {
    const halfkernelWidth = kernelWidth >> 1;
    const halfkernelHeight = kernelHeight >> 1;

    const invSigmaSample2 = 1 / (sigmaSample * sigmaSample);

    for (let idxY = 0; idxY < height; idxY++) {
      const yOffs = idxY * width;
      const currentKernelCenteredIdxY = idxY - halfkernelHeight;

      for (let idxX = 0; idxX < width; idxX++) {
        const currentKernelCenteredIdxX = idxX - halfkernelWidth;
        const centerConvolveIdx = inArray[yOffs + idxX];
        let total = 0;

        for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
          const kernelIdxYOffs = kernelIdxY * kernelWidth;
          const convolveIdxYOffs =
            ((kernelIdxY + currentKernelCenteredIdxY + height) % height) * width;

          for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
            let convolveIdxX = (kernelIdxX + currentKernelCenteredIdxX) % width;
            if (convolveIdxX < 0) convolveIdxX += width;

            total +=
              kernelArray[kernelIdxYOffs + kernelIdxX] *
              Math.exp(
                -(
                  Math.abs(centerConvolveIdx - inArray[convolveIdxYOffs + convolveIdxX]) **
                    pNorm *
                  invSigmaSample2
                )
              );
          }
        }

        energyArray[yOffs + idxX] = total;
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
   * @param {*} pNorm
   * @param {*} kernelArray
   * @param {*} kernelWidth
   * @param {*} kernelHeight
   * @returns
   */

  const _computeEnergyGeorgevFajardoWrapAround = (
    inArray,
    width,
    height,
    idx,
    sigmaSample,
    pNorm,
    kernelArray,
    kernelWidth,
    kernelHeight
  ) => {
    const idxX = idx % width;
    const idxY = (idx / width) | 0;

    const currentKernelCenteredIdxX = idxX - (kernelWidth >> 1);
    const currentKernelCenteredIdxY = idxY - (kernelHeight >> 1);

    const invSigmaSample2 = 1 / (sigmaSample * sigmaSample);
    const centerConvolveIdx = inArray[idx];

    let total = 0;

    for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
      const kernelIdxYOffs = kernelIdxY * kernelWidth;
      const convolveIdxYOffs =
        ((kernelIdxY + currentKernelCenteredIdxY + height) % height) * width;

      for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
        total +=
          kernelArray[kernelIdxYOffs + kernelIdxX] *
          -(
            Math.abs(
              centerConvolveIdx -
                inArray[
                  convolveIdxYOffs + ((kernelIdxX + currentKernelCenteredIdxX + width) % width)
                ]
            ) **
              pNorm *
            invSigmaSample2
          );
      }
    }

    return total;
  };

  const _computeEnergyWrapAround = (
    inArray,
    width,
    height,
    kernelArray,
    kernelWidth,
    kernelHeight
  ) => {
    const halfkernelWidth = kernelWidth >> 1;
    const halfkernelHeight = kernelHeight >> 1;

    let totalEnergy = 0;

    for (let idxY = 0; idxY < height; idxY++) {
      const currentKernelCenteredIdxY = idxY - halfkernelHeight;

      for (let idxX = 0; idxX < width; idxX++) {
        const currentKernelCenteredIdxX = idxX - halfkernelWidth;
        let total = 0;

        for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
          const kernelIdxYOffs = kernelIdxY * kernelWidth;
          const convolveIdxYOffs =
            ((kernelIdxY + currentKernelCenteredIdxY + height) % height) * width;

          for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
            total +=
              inArray[
                convolveIdxYOffs + ((kernelIdxX + currentKernelCenteredIdxX + width) % width)
              ] * kernelArray[kernelIdxYOffs + kernelIdxX];
          }
        }

        totalEnergy += total * total;
      }
    }

    return totalEnergy;
  };

  return {
    shuffle: _shuffle,

    convolveWrapAroundInPlace: _convolveWrapAroundInPlace,
    convolveAddWrapAroundInPlace: _convolveAddWrapAroundInPlace,
    getConvolvedAreaWrapAroundInPlace: _getConvolvedAreaWrapAroundInPlace,
    getConvolvedAreaDotProductWrapAroundInPlace: _getConvolvedAreaDotProductWrapAroundInPlace,

    convolveInPlace: _convolveInPlace,
    convolveAddInPlace: _convolveAddInPlace,
    getConvolvedAreaInPlace: _getConvolvedAreaInPlace,
    getConvolvedAreaDotProductInPlace: _getConvolvedAreaDotProductInPlace,

    computeTotalEnergyGeorgevFajardoWrapAroundInPlace:
      _computeTotalEnergyGeorgevFajardoWrapAroundInPlace,
    computeEnergyGeorgevFajardoWrapAround: _computeEnergyGeorgevFajardoWrapAround,

    computeEnergyWrapAround: _computeEnergyWrapAround,
  };
})();
