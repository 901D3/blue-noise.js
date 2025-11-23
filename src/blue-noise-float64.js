/**
 * Free JS implementation of Void and Cluster method by Robert Ulichney and other methods
 * Remember to link blue-noise-utils.js
 *
 * v0.2.4
 * https://github.com/901D3/blue-noise.js
 *
 * Copyright (c) 901D3
 * This code is licensed with GPLv3 license
 */

"use strict";

const blueNoiseFloat64 = (function () {
  // It was a big failure to use 3*sigma
  let _gaussianSigmaRadiusMultiplier = 4;

  let _useAdaptiveSigmaCandidateAlgo = false;
  let _initialSigmaScale = 0.3; // Best value for adaptive candidate algorithm

  let _useTailGaussian = false;
  let _tailGaussianExp = 1; // Tailing strength. Higher means fall off faster from the center and vice versa

  /**
   * VACluster - short for "Void and Cluster"
   *
   * @typedef {Number} normalized - A number in the range of 0 - 1
   * @typedef {Array} binary[] - an integer array in the range of 0 - 1
   */

  // _originalVoidAndCluster is just a simplified version of _extendedVoidAndCluster.
  // It is there only for explanatory purpose and faithfulness reason, it may give wrong results after running.
  const _originalVoidAndCluster = (width, height, sigma, density = 0.1) => {
    throw new Error(
      "originalVoidAndCluster is deprecated and it is there only for explanatory purpose and faithfulness reason, it may give wrong results after running..\n" +
        "Use extendedVoidAndCluster instead, which is faster, more stable and more features."
    );

    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      throw new Error("'width' and 'height' must be integers");
    }
    if (sigma === 0) throw new Error("Divide by 0");

    // Get Gaussian kernel with sigma value
    const kernel = _getGaussianKernelLUT(sigma);

    // Calculate kernel size
    const kernelSize = (Math.ceil(_gaussianSigmaRadiusMultiplier * sigma) << 1) + 1;

    const sqSz = width * height;

    // Setup arrays
    const binArray = new Uint8Array(sqSz);
    // rankArray will be the output
    const rankArray = new Uint32Array(sqSz);
    // blurredArray is equivalent to energy map, similar to other people's implementations,
    // but it is easier to debug with and more understandable
    const blurredArray = new Float64Array(sqSz);

    // Less accurate
    const filled1 = Math.floor(sqSz * density);
    // Fill binArray from 0 to filled1 with 1, but it is yet to be shuffled
    for (let i = 0; i < filled1; i++) binArray[i] = 1;

    // Now shuffle it, this act like seeding
    blueNoiseUtils.shuffle(binArray);

    _candidateMethodInPlace(binArray, width, height, sigma);

    // Phase 1
    // blur binArray
    blueNoiseUtils.convolveWrapAroundInPlace(
      binArray,
      width,
      height,
      blurredArray,
      kernel,
      kernelSize,
      kernelSize
    );

    // Save the blurredArray, only for phase 1
    const blurredTempArray = blurredArray.slice();
    // Temporary binary array, original binary array is left unchanged after phase 1
    const temp = binArray.slice();

    // Go backwards
    for (let rank = filled1 - 1; rank >= 0; rank--) {
      let value = -Infinity;
      let idx;

      // "Find tightest cluster"
      // Pick the 1 with the highest blurred value
      for (let i = 0; i < sqSz; i++) {
        if (temp[i] === 1) {
          const blurredValue = blurredTempArray[i];

          if (blurredValue > value) {
            value = blurredValue;
            idx = i;
          }
        }
      }

      // Remove "1" from tightest cluster in Binary Pattern.
      temp[idx] = 0;
      rankArray[idx] = rank;

      // And remove blurred "1" from blurredArray
      blueNoiseUtils.convolveDeltaUpdateWrapAroundInPlace(
        width,
        height,
        idx,
        -1,
        blurredTempArray,
        kernel,
        kernelSize,
        kernelSize
      );
    }
    // End of Phase 1

    // Phase 2
    blueNoiseUtils.convolveWrapAroundInPlace(
      binArray,
      width,
      height,
      blurredArray,
      kernel,
      kernelSize,
      kernelSize
    );

    // Start from filled 1
    const halfSqSz = (sqSz / 2) | 0;
    for (let rank = filled1; rank < halfSqSz; rank++) {
      let value = Infinity;
      let idx;

      // Find location of tightest cluster in Binary Pattern.
      for (let i = 0; i < sqSz; i++) {
        if (binArray[i] === 0) {
          const blurredValue = blurredArray[i];

          if (blurredValue < value) {
            value = blurredValue;
            idx = i;
          }
        }
      }

      // Insert "1" in largest void in Binary Pattern.
      binArray[idx] = 1;
      rankArray[idx] = rank;

      blueNoiseUtils.convolveDeltaUpdateWrapAroundInPlace(
        width,
        height,
        idx,
        1,
        blurredArray,
        kernel,
        kernelSize,
        kernelSize
      );
    }
    // End of Phase 2

    // Phase 3
    // Copy binary array to temp and invert it, 0 becomes 1 and vice versa
    for (let i = 0; i < sqSz; i++) temp[i] = 1 - binArray[i];

    // Blur the inverted array
    blueNoiseUtils.convolveWrapAroundInPlace(
      temp,
      width,
      height,
      blurredArray,
      kernel,
      kernelSize,
      kernelSize
    );

    // Ranks the remaining "0s" in binArray
    for (let rank = halfSqSz; rank < sqSz; rank++) {
      let value = -Infinity;
      let idx;

      // Find the 0 with the HIGHEST ENERGY
      for (let i = 0; i < sqSz; i++) {
        if (binArray[i] === 0) {
          const blurredValue = blurredArray[i];

          if (blurredValue > value) {
            value = blurredValue;
            idx = i;
          }
        }
      }

      binArray[idx] = 1;
      rankArray[idx] = rank;

      blueNoiseUtils.convolveDeltaUpdateWrapAroundInPlace(
        width,
        height,
        idx,
        -1,
        blurredArray,
        kernel,
        kernelSize,
        kernelSize
      );
    }
    // End of Phase 3

    return rankArray;
  };

  /**
   * Extended version of VACluster
   *
   * https://cv.ulichney.com/papers/1993-void-cluster.pdf
   *
   * @param {*} width
   * @param {*} height
   * @param {*} sigma
   * @param {*} customKernel
   * @param {*} candidateMethodSigma
   * @param {*} density
   * @returns
   */

  const _extendedVoidAndCluster = (
    width,
    height,
    sigma,
    candidateMethodSigma,
    customKernel,
    density = 0.1
  ) => {
    // Safety checks
    if (width == null) throw new Error("'width' arguments is mandatory");
    if (height == null) throw new Error("'height' arguments is mandatory");
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      throw new Error("'width' and 'height' must be integers");
    }

    const kernelCheck = customKernel != null && Array.isArray(customKernel);
    if (!kernelCheck && sigma == null) {
      throw new Error("kernelCheck is " + kernelCheck + ". 'sigma' arguments is mandatory");
    }

    if (sigma === 0) throw new Error("Divide by 0");

    let kernel = _getGaussianKernelLUT(sigma);
    let kernelWidth = (Math.ceil(_gaussianSigmaRadiusMultiplier * sigma) << 1) + 1;
    let kernelHeight = kernelWidth;

    if (kernelCheck) {
      kernelHeight = customKernel.length;
      kernelWidth = customKernel[0].length;
      kernel = new Float64Array(customKernel.flat());
    }

    const sqSz = width * height;

    // Setup arrays
    const binArray = new Uint8Array(sqSz);
    const rankArray = new Uint32Array(sqSz);
    const blurredArray = new Float64Array(sqSz);

    if (density !== 0 && density !== 1) {
      for (let i = Math.floor(sqSz * density) - 1; i >= 0; i--) {
        binArray[i] = 1;
      }
    } else if (density === 1) binArray.fill(1);

    blueNoiseUtils.shuffle(binArray);

    if (density !== 1 && density !== 0) {
      // Do Ulichney's Candidate Algorithm taken from VACluster
      // If using custom kernel(overwrite all other options)
      if (kernelCheck) {
        _candidateMethodInPlace(binArray, width, height, sigma, customKernel);
      }
      // If using adaptive sigma
      else if (_useAdaptiveSigmaCandidateAlgo) {
        _adaptiveCandidateMethodInPlace(binArray, width, height, _initialSigmaScale);
      }
      // If not using custom kernel nor adaptive sigma, use the inputted sigma
      else {
        _candidateMethodInPlace(binArray, width, height, candidateMethodSigma);
      }
    }

    const temp = new Uint8Array(binArray);

    // Cluster indexes LUT, we save all the 1s in temp array once so phase 1 have less loops
    const clusterIndexes = [];

    // Go through temp array and collect all 1s
    for (let i = 0; i < sqSz; i++) {
      if (temp[i] === 1) clusterIndexes.push(i);
    }

    // The number of 1s in temp is the length of cluster indexes array
    const filled1 = clusterIndexes.length;

    // Phase 1
    // Blur once
    blueNoiseUtils.convolveWrapAroundInPlace(
      binArray,
      width,
      height,
      blurredArray,
      kernel,
      kernelWidth,
      kernelHeight
    );

    // Evenly disttributed dots blurred, for phase 2 tie-breaker
    const blurredTemp = blurredArray.slice();

    for (let rank = filled1 - 1; rank >= 0; rank--) {
      let idx = 0;

      // Since we have already saved all 1s position, there is less loops
      for (let i = 0, value = -Infinity, valueTemp = -Infinity; i < filled1; i++) {
        const dotsIndex = clusterIndexes[i];

        // "Find tightest cluster"
        if (temp[dotsIndex] === 1) {
          const blurredValue = blurredArray[dotsIndex];

          if (blurredValue > value) {
            value = blurredValue;
            idx = dotsIndex;
          }

          // If the current 0 have the same energy as the previous one, go to this tie-breaker
          else if (blurredValue === value) {
            const blurredTempValue = blurredTemp[dotsIndex];

            if (blurredTempValue > valueTemp) {
              valueTemp = blurredTempValue;
              idx = dotsIndex;
            }
          }
        }
      }

      temp[idx] = 0;
      rankArray[idx] = rank;

      blueNoiseUtils.convolveDeltaUpdateWrapAroundInPlace(
        width,
        height,
        idx,
        -1,
        blurredArray,
        kernel,
        kernelWidth,
        kernelHeight
      );
    }
    // End of Phase 1

    // Phase 2
    blurredArray.set(blurredTemp);
    for (let rank = filled1; rank < sqSz; rank++) {
      let value = Infinity;
      let valueTemp = Infinity;
      let idx = 0;

      for (let i = 0; i < sqSz; i++) {
        // "Find lowest void"
        if (binArray[i] === 0) {
          const blurredValue = blurredArray[i];

          if (blurredValue < value) {
            value = blurredValue;
            idx = i;
          }

          // If the current 0 have the same energy as the previous one, go to this tie-breaker
          else if (blurredValue === value) {
            const blurredTempValue = blurredTemp[i];

            if (blurredTempValue < valueTemp) {
              valueTemp = blurredTempValue;
              idx = i;
            }
          }
        }
      }

      binArray[idx] = 1;
      rankArray[idx] = rank;

      blueNoiseUtils.convolveDeltaUpdateWrapAroundInPlace(
        width,
        height,
        idx,
        1,
        blurredArray,
        kernel,
        kernelWidth,
        kernelHeight
      );
    }

    // End of Phase 2
    // Rank array now contains the blue noise

    return rankArray;
  };

  /**
   * Blue-noise Dithered Sampling
   *
   * https://www.iliyan.com/publications/DitheredSampling/DitheredSampling_Sig2016.pdf
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} sigmaImage
   * @param {*} sigmaSample
   * @param {*} iterations
   */

  const _georgievFajardoInPlace = (
    inArray,
    width,
    height,
    sigmaImage,
    sigmaSample,
    iterations
  ) => {
    const sqSz = width * height;
    const radius = Math.ceil(_gaussianSigmaRadiusMultiplier * sigmaImage);

    const energy = new Float64Array(sqSz);
    for (let i = 0; i < sqSz; i++) {
      energy[i] = blueNoiseUtils.computeEnergy(
        inArray,
        width,
        height,
        i,
        sigmaImage,
        sigmaSample,
        radius,
        radius,
        1
      );
    }

    let currentEnergy = 0;
    for (let i = 0; i < sqSz; i++) currentEnergy += energy[i];

    for (let iter = 0; iter < iterations; iter++) {
      const p_i = (Math.random() * sqSz) | 0;
      const lowest = iter % sqSz;

      let nextEnergy = currentEnergy - energy[p_i] - energy[lowest];

      const tmp = inArray[p_i];
      inArray[p_i] = inArray[lowest];
      inArray[lowest] = tmp;

      const newEnergy1 = blueNoiseUtils.computeEnergy(
        inArray,
        width,
        height,
        p_i,
        sigmaImage,
        sigmaSample,
        radius,
        radius,
        1
      );

      const newEnergy2 = blueNoiseUtils.computeEnergy(
        inArray,
        width,
        height,
        lowest,
        sigmaImage,
        sigmaSample,
        radius,
        radius,
        1
      );

      nextEnergy += newEnergy1 + newEnergy2;

      if (nextEnergy < currentEnergy) {
        energy[p_i] = newEnergy1;
        energy[lowest] = newEnergy2;

        currentEnergy = nextEnergy;
      } else {
        const tmp = inArray[p_i];
        inArray[p_i] = inArray[lowest];
        inArray[lowest] = tmp;
      }
    }
  };

  /**
   * Taken from VACluster
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} sigma
   * @param {*} customKernel
   */

  const _candidateMethodInPlace = (inArray, width, height, sigma, customKernel) => {
    if (inArray == null) throw new Error("Inputted array is null");
    if (!ArrayBuffer.isView(inArray)) throw new Error("Inputted array is not ArrayBuffer");

    const sqSz = width * height;
    let filled1 = 0;

    for (let i = 0; i < sqSz; i++) {
      if (inArray[i] === 1) filled1 += 1;
    }

    if (filled1 === 0) {
      console.warn("Inputted array have no dot");
      return;
    }
    if (filled1 === sqSz) {
      console.warn("Inputted array is full of dots");
      return;
    }

    const kernelCheck = customKernel != null && Array.isArray(customKernel);
    if (!kernelCheck && sigma == null) {
      throw new Error("kernelCheck is " + kernelCheck + ". 'sigma' arguments is mandatory");
    }

    if (sigma === 0) throw new Error("Divide by 0");

    const blurredArray = new Float64Array(sqSz);

    let kernel;
    let kernelWidth;
    let kernelHeight;

    if (kernelCheck) {
      kernelHeight = customKernel.length;
      kernelWidth = customKernel[0].length;
      kernel = new Float64Array(customKernel.flat());
    } else {
      kernel = _getGaussianKernelLUT(sigma);
      kernelHeight = (Math.ceil(_gaussianSigmaRadiusMultiplier * sigma) << 1) + 1;
      kernelWidth = kernelHeight;
    }

    blueNoiseUtils.convolveWrapAroundInPlace(
      inArray,
      width,
      height,
      blurredArray,
      kernel,
      kernelWidth,
      kernelHeight
    );

    while (true) {
      let value = -Infinity;
      let clusterIdx;
      let voidIdx;

      for (let i = 0; i < sqSz; i++) {
        if (inArray[i] === 1) {
          const blurredValue = blurredArray[i];

          if (blurredValue > value) {
            value = blurredValue;
            clusterIdx = i;
          }
        }
      }

      inArray[clusterIdx] = 0;

      blueNoiseUtils.convolveDeltaUpdateWrapAroundInPlace(
        width,
        height,
        clusterIdx,
        -1,
        blurredArray,
        kernel,
        kernelWidth,
        kernelHeight
      );

      value = Infinity;

      for (let i = 0; i < sqSz; i++) {
        if (inArray[i] === 0) {
          const blurredValue = blurredArray[i];

          if (blurredValue < value) {
            value = blurredValue;
            voidIdx = i;
          }
        }
      }

      if (clusterIdx === voidIdx) break;

      inArray[voidIdx] = 1;

      blueNoiseUtils.convolveDeltaUpdateWrapAroundInPlace(
        width,
        height,
        voidIdx,
        1,
        blurredArray,
        kernel,
        kernelWidth,
        kernelHeight
      );
    }
  };

  /**
   * Changes sigma value based on number of points and resolution
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   */

  const _adaptiveCandidateMethodInPlace = (inArray, width, height) => {
    const sqSz = width * height;
    let filled1 = 0;
    for (let i = 0; i < sqSz; i++) {
      if (inArray[i] === 1) filled1 += 1;
    }

    _candidateMethodInPlace(
      inArray,
      width,
      height,
      Math.sqrt(sqSz / Math.abs(filled1 > sqSz / 2 ? sqSz - filled1 : filled1)) *
        _initialSigmaScale
    );
  };

  /**
   * Function for getting/generating Gaussian kernel with LUT
   *
   * Tail Gaussian: Fix for low quality VACluster's low and high ranks when using low sigma Gaussian kernel
   *
   * @param {float} sigma
   * @returns {array}
   */

  const gaussianKernelLUT = new Map();

  const _getGaussianKernelLUT = (sigma) => {
    let key = sigma + "," + _gaussianSigmaRadiusMultiplier;

    if (_useTailGaussian) {
      key = sigma + "," + _tailGaussianExp + "," + _gaussianSigmaRadiusMultiplier;
    }

    if (!gaussianKernelLUT.has(key)) {
      const radius = Math.ceil(_gaussianSigmaRadiusMultiplier * sigma);
      const kernelSize = (radius << 1) + 1;
      const sqSz = kernelSize * kernelSize;
      const kernel = new Float64Array(sqSz);

      if (_useTailGaussian) {
        for (let y = -radius; y < radius; y++) {
          const dbY = y * y;
          const yOffs = (y + radius) * kernelSize;

          for (let x = -radius; x < radius; x++) {
            kernel[yOffs + (x + radius)] = Math.exp(
              -((Math.sqrt(x * x + dbY) / (2 * sigma)) ** _tailGaussianExp)
            );
          }
        }
      } else {
        const invSigma2 = 1 / (2 * sigma * sigma);

        for (let y = -radius; y < radius; y++) {
          const dbY = y * y;
          const yOffs = (y + radius) * kernelSize;

          for (let x = -radius; x < radius; x++) {
            kernel[yOffs + (x + radius)] = Math.exp(-(x * x + dbY) * invSigma2);
          }
        }
      }

      let sum = 0;
      for (let i = 0; i < sqSz; i++) sum += kernel[i];
      for (let i = 0; i < sqSz; i++) kernel[i] /= sum;

      gaussianKernelLUT.set(key, kernel);
    }

    return gaussianKernelLUT.get(key);
  };

  return {
    get useAdaptiveSigmaCandidateAlgo() {
      return _useAdaptiveSigmaCandidateAlgo;
    },
    set useAdaptiveSigmaCandidateAlgo(bool) {
      if (bool !== true && bool !== false) {
        console.warn("Boolean only");
        return;
      }

      _useAdaptiveSigmaCandidateAlgo = bool;
    },

    get gaussianSigmaRadiusMultiplier() {
      return _gaussianSigmaRadiusMultiplier;
    },
    set gaussianSigmaRadiusMultiplier(value) {
      _gaussianSigmaRadiusMultiplier = value;
    },

    get initialSigmaScale() {
      return _initialSigmaScale;
    },
    set initialSigmaScale(value) {
      _initialSigmaScale = value;
    },

    get useTailGaussian() {
      return _useTailGaussian;
    },
    set useTailGaussian(bool) {
      if (bool !== true && bool !== false) {
        console.warn("Boolean only");
        return;
      }

      _useTailGaussian = bool;
    },

    get tailGaussianExp() {
      return _tailGaussianExp;
    },
    set tailGaussianExp(value) {
      _tailGaussianExp = value;
    },

    originalVoidAndCluster: _originalVoidAndCluster,
    extendedVoidAndCluster: _extendedVoidAndCluster,
    georgievFajardoInPlace: _georgievFajardoInPlace,

    candidateMethodInPlace: _candidateMethodInPlace,
    candidateMethodInPlaceAdaptive: _adaptiveCandidateMethodInPlace,

    getGaussianKernelLUT: _getGaussianKernelLUT,
  };
})();
