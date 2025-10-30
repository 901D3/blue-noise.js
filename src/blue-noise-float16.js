/**
 * Free JS implementation of Void and Cluster method by Robert Ulichney and other methods
 * Ultra optimized while keeping it readable
 * The result is high quality blue noise but somehow very fast
 * Remember to link blue-noise-utils.js
 *
 * v0.2.01
 * 16 Bits Float version
 *
 * https://github.com/901D3/blue-noise.js
 *
 * Copyright (c) 901D3
 * This code is licensed with GPLv3 license
 */

"use strict";

var blueNoiseFloat16 = (function () {
  /**
   * @typedef {Number} normalized - A number in the range of 0 - 1
   * @typedef {Array} binary[] - an integer array in the range of 0 - 1
   */

  // Replaced
  /**
   * Faithful version of VACluster
   *
   * https://cv.ulichney.com/papers/1993-void-cluster.pdf
   *
   * @param {*} width
   * @param {*} height
   * @param {*} sigma
   * @param {*} density
   * @returns
   */

  function _originalVoidAndCluster(width, height, sigma, density) {
    // Safety checks
    if (width == null) throw new Error("'width' arguments is mandatory");
    if (height == null) throw new Error("'height' arguments is mandatory");
    if (!Number.isInteger(width) || !Number.isInteger(height)) throw new Error("'width' and 'height' must be integers");

    // Get custom kernel dimension before flat them
    const kernel = _getGaussianKernelLUT(sigma);
    const kernelSize = 2 * Math.ceil(3 * sigma) + 1;

    const sqSz = width * height;

    // Setup arrays
    const binArray = new Uint8Array(sqSz);
    const rankArray = new Uint32Array(sqSz);
    const blurred = new Float16Array(sqSz);
    binArray.set(blueNoiseUtils.noiseArray(width, height, density));

    _candidateAlgoInPlace(binArray, width, height, sigma);

    const filled1 = binArray.reduce((sum, v) => sum + v, 0);

    // Phase 1
    // Temporary binary array, original binary array is left unchanged after phase 1
    const temp = binArray.slice();

    blueNoiseUtils.blurWrapInPlace(binArray, width, height, blurred, kernel, kernelSize, kernelSize);

    let rank = filled1 - 1;
    while (rank > 0) {
      let value = -Infinity;
      let idx;

      for (let j = 0; j < sqSz; j++) {
        const blurredValue = blurred[j];
        if (temp[j] === 1 && blurredValue > value) {
          value = blurredValue;
          idx = j;
        }
      }

      // Remove "1" from tightest cluster in Binary Pattern.
      temp[idx] = 0;
      rankArray[idx] = rank--;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, idx, -1, blurred, kernel, kernelSize, kernelSize);
    }
    // End of Phase 1

    // Phase 2
    blueNoiseUtils.blurWrapInPlace(binArray, width, height, blurred, kernel, kernelSize, kernelSize);

    // Start from filled 1
    const halfSqSz = Math.floor(sqSz / 2);
    rank = filled1;
    while (rank < halfSqSz) {
      let value = Infinity;
      let idx;

      // Find location of tightest cluster in Binary Pattern.
      for (let j = 0; j < sqSz; j++) {
        const blurredValue = blurred[j];
        if (binArray[j] === 0 && blurredValue < value) {
          value = blurredValue;
          idx = j;
        }
      }

      // Insert "1" in largest void in Binary Pattern.
      binArray[idx] = 1;
      rankArray[idx] = rank++;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, idx, 1, blurred, kernel, kernelSize, kernelSize);
    }
    // End of Phase 2

    // Phase 3
    // Copy binary array to temp and invert it, 0 becomes 1 and vice versa
    for (let i = 0; i < sqSz; i++) temp[i] = 1 ^ binArray[i];

    // Blur the temp array, so we can use binArray[idx] === 0
    blueNoiseUtils.blurWrapInPlace(temp, width, height, blurred, kernel, kernelSize, kernelSize);

    // Fills in the remaining "0s" in binArray so rankArray is complete blue noise without any voids
    while (rank < sqSz) {
      let value = -Infinity;
      let idx;

      for (let j = 0; j < sqSz; j++) {
        const blurredValue = blurred[j];
        if (binArray[j] === 0 && blurredValue > value) {
          value = blurredValue;
          idx = j;
        }
      }

      binArray[idx] = 1;
      rankArray[idx] = rank++;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, idx, -1, blurred, kernel, kernelSize, kernelSize);
    }
    // End of Phase 3

    return rankArray;
  }

  /**
   * Extended version of VACluster
   * Use adaptive sigma candidate algorithm
   *
   * @param {*} width
   * @param {*} height
   * @param {*} sigma
   * @param {*} initialSigmaScale
   * @param {*} customKernel
   * @param {*} density
   * @param {*} candidateFillingRatio
   * @param {*} initArray
   * @returns
   */

  function _extendedVoidAndCluster(
    width,
    height,
    sigma,
    initialSigmaScale = 0.3, // Best value for adaptive candidate algorithm
    customKernel,
    density = 0.1,
    candidateFillingRatio = 0.5,
    initArray
  ) {
    // Safety checks
    if (width == null) throw new Error("'width' arguments is mandatory");
    if (height == null) throw new Error("'height' arguments is mandatory");
    if (!Number.isInteger(width) || !Number.isInteger(height)) throw new Error("'width' and 'height' must be integers");

    const kernelCheck = customKernel != null && Array.isArray(customKernel);
    if (!kernelCheck) {
      if (sigma == null) throw new Error("kernelCheck is " + kernelCheck + ". 'sigma' arguments is mandatory");
    }

    if (candidateFillingRatio == null) {
      console.warn("candidateFillingRatio falled back to " + 0.5);
      candidateFillingRatio = 0.5;
    }

    // Get custom kernel dimension before flat them
    let kernel;
    let kernelWidth;
    let kernelHeight;

    if (kernelCheck) {
      kernelHeight = customKernel.length;
      kernelWidth = customKernel[0].length;
      kernel = new Float16Array(customKernel.flat());
    } else {
      console.warn("Inputted kernel is null or not an array. Default to Gaussian");
      kernel = _getGaussianKernelLUT(sigma);
      kernelHeight = 2 * Math.ceil(3 * sigma) + 1;
      kernelWidth = kernelHeight;
    }

    const sqSz = width * height;

    // Setup arrays
    const binArray = new Uint8Array(sqSz);
    const rankArray = new Uint32Array(sqSz);
    const blurred = new Float16Array(sqSz);
    binArray.set(blueNoiseUtils.noiseArray(width, height, density));

    if (initArray && initArray.flat().length === sqSz) {
      binArray.set(initArray.flat());
    } else {
      console.warn(
        "Inputted initial array dimension does not match " + width + "x" + height + ". Default to candidate algorithm"
      );
      _adaptiveCandidateAlgoInPlace(binArray, width, height, initialSigmaScale);
    }

    const filled1 = binArray.reduce((sum, v) => sum + v, 0);
    const candidateFillingRatioScaled =
      filled1 + Math.floor(Math.min(Math.max(candidateFillingRatio, 0), 1) * (sqSz - filled1));

    // Phase 1
    // Temporary binary array, original binary array is left unchanged after phase 1
    const temp = new Uint8Array(binArray);
    blueNoiseUtils.blurWrapInPlace(binArray, width, height, blurred, kernel, kernelWidth, kernelHeight);

    for (let rank = 0; rank < filled1; rank++) {
      let value = -Infinity;
      let idx;

      for (let j = 0; j < sqSz; j++) {
        const blurredValue = blurred[j];
        if (temp[j] === 1 && blurredValue > value) {
          value = blurredValue;
          idx = j;
        }
      }

      // Remove "1" from tightest cluster in Binary Pattern.
      temp[idx] = 0;
      rankArray[idx] = filled1 - rank;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, idx, -1, blurred, kernel, kernelWidth, kernelHeight);
    }
    // End of Phase 1

    // Phase 2
    blueNoiseUtils.blurWrapInPlace(binArray, width, height, blurred, kernel, kernelWidth, kernelHeight);

    // Start from filled 1
    for (let rank = filled1; rank < candidateFillingRatioScaled; rank++) {
      let value = Infinity;
      let idx;

      // Find location of tightest cluster in Binary Pattern.
      for (let j = 0; j < sqSz; j++) {
        const blurredValue = blurred[j];
        if (binArray[j] === 0 && blurredValue < value) {
          value = blurredValue;
          idx = j;
        }
      }

      // Remove "0" from largest void in Binary Pattern.
      binArray[idx] = 1;
      rankArray[idx] = rank;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, idx, 1, blurred, kernel, kernelWidth, kernelHeight);
    }
    // End of Phase 2

    // Phase 3
    // Copy binary array to temp and invert it, 0 becomes 1 and vice versa
    for (let i = 0; i < sqSz; i++) temp[i] = 1 ^ binArray[i];

    // Blur the temp array, so we can use binArray[idx] === 0
    blueNoiseUtils.blurWrapInPlace(temp, width, height, blurred, kernel, kernelWidth, kernelHeight);

    // Fills in the remaining "0s" in binArray so rankArray is complete blue noise without any voids
    for (let rank = candidateFillingRatioScaled; rank < sqSz; rank++) {
      let value = -Infinity;
      let idx;

      for (let j = 0; j < sqSz; j++) {
        const blurredValue = blurred[j];
        if (binArray[j] === 0 && blurredValue > value) {
          value = blurredValue;
          idx = j;
        }
      }

      binArray[idx] = 1;
      rankArray[idx] = rank;
      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, idx, -1, blurred, kernel, kernelWidth, kernelHeight);
    }
    // End of Phase 3

    return rankArray;
  }

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

  function _georgievFajardoInPlace(inArray, width, height, sigmaImage, sigmaSample, iterations) {
    const sqSz = width * height;

    const energy = new Float16Array(sqSz);
    for (let i = 0; i < sqSz; i++) {
      energy[i] = blueNoiseUtils.computeEnergySigmaAt(inArray, width, height, i, sigmaImage, sigmaSample, 2);
    }

    let currentEnergy = energy.reduce((a, b) => a + b, 0);

    for (let iter = 0; iter < iterations; iter++) {
      const idx1 = Math.floor(Math.random() * sqSz);
      let idx2 = Math.floor(Math.random() * sqSz);
      while (idx1 === idx2) idx2 = Math.floor(Math.random() * sqSz);

      let nextEnergy = currentEnergy - energy[idx1] - energy[idx2];

      [inArray[idx1], inArray[idx2]] = [inArray[idx2], inArray[idx1]];

      const newEnergy1 = blueNoiseUtils.computeEnergySigmaAt(inArray, width, height, idx1, sigmaImage, sigmaSample, 2);
      const newEnergy2 = blueNoiseUtils.computeEnergySigmaAt(inArray, width, height, idx2, sigmaImage, sigmaSample, 2);

      nextEnergy += newEnergy1 + newEnergy2;

      if (nextEnergy < currentEnergy) {
        energy[idx1] = newEnergy1;
        energy[idx2] = newEnergy2;
        currentEnergy = nextEnergy;
      } else [inArray[idx1], inArray[idx2]] = [inArray[idx2], inArray[idx1]];
    }
  }

  /**
   * Taken from VACluster
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} sigma
   * @param {*} customKernel
   */

  function _candidateAlgoInPlace(inArray, width, height, sigma, customKernel) {
    if (inArray == null) throw new Error("Inputted array is null");
    const sqSz = width * height;

    if (ArrayBuffer.isView(inArray)) {
    } else if (inArray.flat().length === sqSz) {
      inArray.set(inArray.flat());
    } else {
      throw new Error("Inputted array dimension does not match " + width + "x" + height);
    }

    const blurred = new Float16Array(sqSz);

    const kernelCheck = customKernel != null && Array.isArray(customKernel);
    let kernel = new Float16Array(2 * Math.ceil(3 * sigma) + 1);
    let kernelWidth;
    let kernelHeight;

    if (kernelCheck) {
      kernelWidth = customKernel.length;
      kernelHeight = customKernel[0].length;
      kernel = new Float16Array(customKernel.flat());
    } else {
      console.warn("Inputted kernel is null or not an array. Default to Gaussian");
      kernel = _getGaussianKernelLUT(sigma);
      kernelWidth = 2 * Math.ceil(3 * sigma) + 1;
      kernelHeight = kernelWidth;
    }

    blueNoiseUtils.blurWrapInPlace(inArray, width, height, blurred, kernel, kernelWidth, kernelHeight);

    while (true) {
      let value = -Infinity;
      let clusterIdx;
      let voidIdx;

      for (let i = 0; i < sqSz; i++) {
        const blurredValue = blurred[i];
        if (inArray[i] === 1 && blurredValue > value) {
          value = blurredValue;
          clusterIdx = i;
        }
      }

      inArray[clusterIdx] = 0;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, clusterIdx, -1, blurred, kernel, kernelWidth, kernelHeight);

      value = Infinity;

      for (let i = 0; i < sqSz; i++) {
        const blurredValue = blurred[i];
        if (inArray[i] === 0 && blurredValue < value) {
          value = blurredValue;
          voidIdx = i;
        }
      }

      if (clusterIdx === voidIdx) break;

      inArray[voidIdx] = 1;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, voidIdx, 1, blurred, kernel, kernelWidth, kernelHeight);
    }
  }

  // New
  /**
   * Changes sigma value based on number of points and resolution
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} sigmaScale - 0.3 is the best value
   */

  function _adaptiveCandidateAlgoInPlace(inArray, width, height, sigmaScale) {
    if (inArray == null) throw new Error("Inputted array is null");
    const filled1 = inArray.reduce((sum, v) => sum + v, 0);
    if (filled1 === 0) throw new Error("Inputted array have no dots");

    const sqSz = width * height;

    if (!ArrayBuffer.isView(inArray)) {
      console.warn("Inputted array is not ArrayBuffer");
      inArray = Float16Array.from(inArray);
    }

    const sigma = Math.sqrt(sqSz / filled1) * sigmaScale;

    const blurred = new Float16Array(sqSz);
    const kernel = _getGaussianKernelLUT(sigma);
    const kernelSize = 2 * Math.ceil(3 * sigma) + 1;

    blueNoiseUtils.blurWrapInPlace(inArray, width, height, kernel, blurred, kernelSize, kernelSize);

    while (true) {
      let value = -Infinity;
      let clusterIdx;
      let voidIdx;

      for (let i = 0; i < sqSz; i++) {
        const blurredValue = blurred[i];
        if (inArray[i] === 1 && blurredValue > value) {
          value = blurredValue;
          clusterIdx = i;
        }
      }

      inArray[clusterIdx] = 0;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, clusterIdx, -1, blurred, kernel, kernelSize, kernelSize);

      value = Infinity;

      for (let i = 0; i < sqSz; i++) {
        const blurredValue = blurred[i];
        if (inArray[i] === 0 && blurredValue < value) {
          value = blurredValue;
          voidIdx = i;
        }
      }

      if (clusterIdx === voidIdx) break;

      inArray[voidIdx] = 1;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, voidIdx, 1, blurred, kernel, kernelSize, kernelSize);
    }
  }

  /**
   * Simple function for getting/generating Gaussian kernel with LUT
   *
   * @param {float} sigma
   * @returns {array}
   */

  const gaussianKernelLUT = new Map();

  function _getGaussianKernelLUT(sigma) {
    const radius = Math.ceil(3 * sigma);

    if (!gaussianKernelLUT.has(sigma)) {
      const kernelSize = 2 * radius + 1;
      const sqSz = kernelSize * kernelSize;
      const kernel = new Float16Array(sqSz);
      const denom = 2 * sigma * sigma;
      let sum = 0;

      for (let y = -radius; y <= radius; y++) {
        const dbY = y * y;
        const yOffs = (y + radius) * kernelSize;

        for (let x = -radius; x <= radius; x++) {
          const v = Math.exp(-(x * x + dbY) / denom);
          kernel[yOffs + (x + radius)] = v;
          sum += v;
        }
      }

      for (let i = 0; i < sqSz; i++) kernel[i] /= sum;

      gaussianKernelLUT.set(sigma, kernel);
    }

    return gaussianKernelLUT.get(sigma);
  }

  // Unused
  /**
   *
   * @param {*} N
   * @param {*} equation
   * @returns
   */
  /*
  const windowFuncLUT = new Map();
  
  function _getWindowFunctionLUT(N, equation) {
    if (!Number.isInteger(N)) throw new Error("N must be an integer");
    if (equation == null) throw new Error("Unknown equation input: " + equation);
  
    const trimmed = equation.replace(/\s/g, "");
    const key = N + " | " + trimmed;
  
    if (!windowFuncLUT.has(key)) {
      const array = new Float16Array(N).fill(1);
      const cp = new Function("n", "N", "return " + trimmed);
  
      for (let n = 0; n < N; n++) array[n] *= cp(n, N);
  
      windowFuncLUT.set(key, array);
    }
  
    return windowFuncLUT.get(key);
  }
  */

  return {
    extendedVoidAndCluster: _extendedVoidAndCluster,
    originalVoidAndCluster: _originalVoidAndCluster,
    georgievFajardoInPlace: _georgievFajardoInPlace,
    candidateAlgoInPlace: _candidateAlgoInPlace,
    candidateAlgoInPlaceAdaptive: _adaptiveCandidateAlgoInPlace,
    getGaussianKernelLUT: _getGaussianKernelLUT,
    //getWindowFunctionLUT: _getWindowFunctionLUT,
  };
})();

