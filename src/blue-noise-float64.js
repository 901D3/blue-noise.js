/**
 * Free JS implementation of Void and Cluster method by Robert Ulichney and other methods
 * Remember to link blue-noise-utils.js
 *
 * v0.2.2
 * https://github.com/901D3/blue-noise.js
 *
 * Copyright (c) 901D3
 * This code is licensed with GPLv3 license
 */

"use strict";

const blueNoiseFloat64 = (function () {
  // It was a big failure to use 3*sigma
  let _gaussianSigmaRadiusMultiplier = 4;

  /**
   * @typedef {Number} normalized - A number in the range of 0 - 1
   * @typedef {Array} binary[] - an integer array in the range of 0 - 1
   */

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
    const kernelSize = 2 * Math.ceil(_gaussianSigmaRadiusMultiplier * sigma) + 1;

    const sqSz = width * height;

    // Setup arrays
    const binArray = new Uint8Array(sqSz);
    const rankArray = new Uint32Array(sqSz);
    const blurred = new Float64Array(sqSz);
    binArray.set(blueNoiseUtils.noiseArray(width, height, density));

    _candidateAlgoInPlace(binArray, width, height, sigma);

    const filled1 = binArray.reduce((sum, v) => sum + v, 0);

    // Phase 1
    // Temporary binary array, original binary array is left unchanged after phase 1
    const temp = binArray.slice();

    blueNoiseUtils.blurWrapInPlace(binArray, width, height, blurred, kernel, kernelSize, kernelSize);

    let rank = filled1 - 1;
    while (rank >= 0) {
      let value = -Infinity;
      let idx;

      for (let i = 0; i < sqSz; i++) {
        if (temp[i] === 1) {
          const blurredValue = blurred[i];
          if (blurredValue > value) {
            value = blurredValue;
            idx = i;
          }
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
      for (let i = 0; i < sqSz; i++) {
        if (binArray[i] === 0) {
          const blurredValue = blurred[i];
          if (blurredValue < value) {
            value = blurredValue;
            idx = i;
          }
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

      for (let i = 0; i < sqSz; i++) {
        if (binArray[i] === 0) {
          const blurredValue = blurred[i];
          if (blurredValue > value) {
            value = blurredValue;
            idx = i;
          }
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
   * @returns
   */

  function _extendedVoidAndCluster(
    width,
    height,
    sigma,
    initialSigmaScale = 0.3, // Best value for adaptive candidate algorithm
    customKernel,
    density = 0.1,
    candidateFillingRatio = 0.5
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
      kernel = new Float64Array(customKernel.flat());
    } else {
      console.warn("Inputted kernel is null or not an array. Default to Gaussian");
      kernel = _getGaussianKernelLUT(sigma);
      kernelHeight = 2 * Math.ceil(_gaussianSigmaRadiusMultiplier * sigma) + 1;
      kernelWidth = kernelHeight;
    }

    const sqSz = width * height;

    // Setup arrays
    const binArray = new Uint8Array(sqSz);
    const rankArray = new Uint32Array(sqSz);
    const blurred = new Float64Array(sqSz);
    binArray.set(blueNoiseUtils.noiseArray(width, height, density));

    _adaptiveCandidateAlgoInPlace(binArray, width, height, initialSigmaScale);

    const filled1 = binArray.reduce((sum, v) => sum + v, 0);

    // Phase 1
    // Temporary binary array, original binary array is left unchanged after phase 1
    const temp = new Uint8Array(binArray);

    blueNoiseUtils.blurWrapInPlace(binArray, width, height, blurred, kernel, kernelWidth, kernelHeight);

    for (let rank = filled1 - 1; rank >= 0; rank--) {
      let value = -Infinity;
      let idx;

      for (let i = 0; i < sqSz; i++) {
        if (temp[i] === 1) {
          const blurredValue = blurred[i];
          if (blurredValue > value) {
            value = blurredValue;
            idx = i;
          }
        }
      }

      // Remove "1" from tightest cluster in Binary Pattern.
      temp[idx] = 0;
      rankArray[idx] = rank;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, idx, -1, blurred, kernel, kernelWidth, kernelHeight);
    }
    // End of Phase 1

    const candidateFillingRatioScaled = filled1 + Math.floor(candidateFillingRatio * (sqSz - filled1));

    // Phase 2
    blueNoiseUtils.blurWrapInPlace(binArray, width, height, blurred, kernel, kernelWidth, kernelHeight);

    // Start from filled 1
    for (let rank = filled1; rank < candidateFillingRatioScaled; rank++) {
      let value = Infinity;
      let idx;

      // Find location of tightest cluster in Binary Pattern.
      for (let i = 0; i < sqSz; i++) {
        if (binArray[i] === 0) {
          const blurredValue = blurred[i];
          if (blurredValue < value) {
            value = blurredValue;
            idx = i;
          }
        }
      }

      // Remove "0" from largest void in Binary Pattern.
      binArray[idx] = 1;
      rankArray[idx] = rank;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, idx, 1, blurred, kernel, kernelWidth, kernelHeight);
    }
    // End of Phase 2

    // Phase 3
    blueNoiseUtils.blurWrapInPlace(binArray, width, height, blurred, kernel, kernelWidth, kernelHeight);

    // Fills in the remaining "0s" in binArray so rankArray is complete blue noise without any voids
    for (let rank = candidateFillingRatioScaled; rank < sqSz; rank++) {
      let value = Infinity;
      let idx;

      for (let i = 0; i < sqSz; i++) {
        if (binArray[i] === 0) {
          const blurredValue = blurred[i];
          if (blurredValue < value) {
            value = blurredValue;
            idx = i;
          }
        }
      }

      binArray[idx] = 1;
      rankArray[idx] = rank;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, idx, 1, blurred, kernel, kernelWidth, kernelHeight);
    }
    // End of Phase 3

    return rankArray;
  }

  /**
   * Bart Wronski's "Simplified" Void and Cluster
   * https://colab.research.google.com/github/bartwronski/BlogPostsExtraMaterial/blob/master/Jax_Void_and_cluster.ipynb
   *
   * @param {*} width
   * @param {*} height
   * @param {*} sigma
   * @param {*} density
   */

  function _bartWronskiVoidAndCluster(width, height, sigma, initialSigmaScale = 0.3, density = 0.1) {
    const sqSz = width * height;

    const binArray = new Uint8Array(sqSz);
    const rankArray = new Uint32Array(sqSz);
    const blurred = new Float64Array(sqSz);
    binArray.set(blueNoiseUtils.noiseArray(width, height, density));

    _adaptiveCandidateAlgoInPlace(binArray, width, height, initialSigmaScale);

    const filled1 = binArray.reduce((sum, v) => sum + v, 0);

    const kernel = _getGaussianKernelLUT(sigma);
    const kernelSize = 2 * Math.ceil(_gaussianSigmaRadiusMultiplier * sigma) + 1;

    blueNoiseUtils.blurWrapInPlace(binArray, width, height, blurred, kernel, kernelSize, kernelSize);

    const temp = new Uint8Array(binArray);

    for (let rank = filled1 - 1; rank >= 0; rank--) {
      let value = -Infinity;
      let idx;

      for (let i = 0; i < sqSz; i++) {
        if (temp[i] === 1) {
          const blurredValue = blurred[i];
          if (blurredValue > value) {
            value = blurredValue;
            idx = i;
          }
        }
      }

      temp[idx] = 0;
      rankArray[idx] = rank;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, idx, -1, blurred, kernel, kernelSize, kernelSize);
    }

    for (let rank = filled1; rank < sqSz; rank++) {
      let value = Infinity;
      let idx;

      for (let i = 0; i < sqSz; i++) {
        if (binArray[i] === 0) {
          const blurredValue = blurred[i];
          if (blurredValue < value) {
            value = blurredValue;
            idx = i;
          }
        }
      }

      binArray[idx] = 1;
      rankArray[idx] = rank;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, idx, 1, blurred, kernel, kernelSize, kernelSize);
    }

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
    blueNoiseUtils._gaussianSigmaRadiusMultiplier = _gaussianSigmaRadiusMultiplier;
    const sqSz = width * height;

    const energy = new Float64Array(sqSz);
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

  function _candidateAlgoInPlace(inArray, width, height, sigma) {
    if (inArray == null) {
      console.error("Inputted array is null");
      return;
    }
    const filled1 = inArray.reduce((sum, v) => sum + v, 0);
    if (filled1 === 0) {
      console.error("Inputted array have no dot");
      return;
    }

    const sqSz = width * height;
    if (filled1 === sqSz) {
      console.error("Inputted array is full of dots");
      return;
    }

    if (!ArrayBuffer.isView(inArray)) {
      console.warn("Inputted array is not ArrayBuffer");
      inArray = Float64Array.from(inArray);
    }

    const blurred = new Float64Array(sqSz);

    const kernel = _getGaussianKernelLUT(sigma);
    const kernelSize = 2 * Math.ceil(_gaussianSigmaRadiusMultiplier * sigma) + 1;

    blueNoiseUtils.blurWrapInPlace(inArray, width, height, blurred, kernel, kernelSize, kernelSize);

    while (true) {
      let value = -Infinity;
      let clusterIdx;
      let voidIdx;

      for (let i = 0; i < sqSz; i++) {
        if (inArray[i] === 1) {
          const blurredValue = blurred[i];
          if (blurredValue > value) {
            value = blurredValue;
            clusterIdx = i;
          }
        }
      }

      inArray[clusterIdx] = 0;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, clusterIdx, -1, blurred, kernel, kernelSize, kernelSize);

      value = Infinity;

      for (let i = 0; i < sqSz; i++) {
        if (inArray[i] === 0) {
          const blurredValue = blurred[i];
          if (blurredValue < value) {
            value = blurredValue;
            voidIdx = i;
          }
        }
      }

      if (clusterIdx === voidIdx) break;

      inArray[voidIdx] = 1;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, voidIdx, 1, blurred, kernel, kernelSize, kernelSize);
    }
  }

  /**
   * Changes sigma value based on number of points and resolution
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} sigmaScale - 0.3 is the best value
   */

  function _adaptiveCandidateAlgoInPlace(inArray, width, height, sigmaScale) {
    if (inArray == null) {
      console.error("Inputted array is null");
      return;
    }
    const filled1 = inArray.reduce((sum, v) => sum + v, 0);
    if (filled1 === 0) {
      console.error("Inputted array have no dot");
      return;
    }

    const sqSz = width * height;
    if (filled1 === sqSz) {
      console.error("Inputted array is full of dots");
      return;
    }
    const halfSqSz = sqSz / 2;

    if (!ArrayBuffer.isView(inArray)) {
      console.warn("Inputted array is not ArrayBuffer");
      inArray = Float64Array.from(inArray);
    }

    const sigma = Math.sqrt(sqSz / Math.abs(filled1 > halfSqSz ? sqSz - filled1 : filled1)) * sigmaScale;

    const blurred = new Float64Array(sqSz);
    const kernel = _getGaussianKernelLUT(sigma);
    const kernelSize = 2 * Math.ceil(_gaussianSigmaRadiusMultiplier * sigma) + 1;

    blueNoiseUtils.blurWrapInPlace(inArray, width, height, blurred, kernel, kernelSize, kernelSize);

    while (true) {
      let value = -Infinity;
      let clusterIdx;
      let voidIdx;

      for (let i = 0; i < sqSz; i++) {
        if (inArray[i] === 1) {
          const blurredValue = blurred[i];
          if (blurredValue > value) {
            value = blurredValue;
            clusterIdx = i;
          }
        }
      }

      inArray[clusterIdx] = 0;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, clusterIdx, -1, blurred, kernel, kernelSize, kernelSize);

      value = Infinity;

      for (let i = 0; i < sqSz; i++) {
        if (inArray[i] === 0) {
          const blurredValue = blurred[i];
          if (blurredValue < value) {
            value = blurredValue;
            voidIdx = i;
          }
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
    const key = sigma + ", " + _gaussianSigmaRadiusMultiplier;

    if (!gaussianKernelLUT.has(sigma)) {
      const radius = Math.ceil(_gaussianSigmaRadiusMultiplier * sigma);
      const kernelSize = (radius << 1) + 1;
      const sqSz = kernelSize * kernelSize;
      const kernel = new Float64Array(sqSz);
      const denom = 2 * sigma * sigma;
      let sum = 0;

      for (let y = -radius; y <= radius; y++) {
        const dbY = y * y;
        const yOffs = (y + radius) * kernelSize;

        for (let x = -radius; x <= radius; x++) {
          kernel[yOffs + (x + radius)] = Math.exp(-(x * x + dbY) / denom);
          sum += kernel[yOffs + (x + radius)];
        }
      }

      for (let i = 0; i < sqSz; i++) kernel[i] /= sum;

      gaussianKernelLUT.set(key, kernel);
    }

    return gaussianKernelLUT.get(key);
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
      const array = new Float64Array(N).fill(1);
      const cp = new Function("n", "N", "return " + trimmed);
  
      for (let n = 0; n < N; n++) array[n] *= cp(n, N);
  
      windowFuncLUT.set(key, array);
    }
  
    return windowFuncLUT.get(key);
  }
  */

  return {
    get gaussianSigmaRadiusMultiplier() {
      return _gaussianSigmaRadiusMultiplier;
    },
    set gaussianSigmaRadiusMultiplier(value) {
      _gaussianSigmaRadiusMultiplier = value;
    },

    originalVoidAndCluster: _originalVoidAndCluster,
    extendedVoidAndCluster: _extendedVoidAndCluster,
    bartWronskiVoidAndCluster: _bartWronskiVoidAndCluster,
    georgievFajardoInPlace: _georgievFajardoInPlace,
    candidateAlgoInPlace: _candidateAlgoInPlace,
    candidateAlgoInPlaceAdaptive: _adaptiveCandidateAlgoInPlace,
    getGaussianKernelLUT: _getGaussianKernelLUT,
    //getWindowFunctionLUT: _getWindowFunctionLUT,
  };
})();

