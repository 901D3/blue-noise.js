/**
 * Free JS implementation of Void and Cluster method by Robert Ulichney and other methods
 * Ultra optimized while keeping it readable
 * The result is high quality blue noise but somehow very fast
 * Remember to link blue-noise-utils.js
 *
 * 32 Bits Float version
 *
 * https://github.com/901D3/blue-noise.js
 *
 * Copyright (c) 901D3
 * This code is licensed with GPLv3 license
 */

"use strict";

var blueNoiseFloat32 = (function () {
  /**
   * @typedef {Number} normalized - A number in the range of 0 - 1
   * @typedef {Array} binary[] - an integer array in the range of 0 - 1
   */

  // Updated

  /**
   * Generate blue noise with Void and Cluster method
   *
   * @param {*} width
   * @param {*} height
   * @param {*} sigma
   * @param {*} customKernel
   * @param {*} density
   * @param {*} candidateFillingRatio
   * @param {*} initArray
   * @param {*} verbose
   * @returns
   */

  function _voidAndCluster(width, height, sigma, customKernel, density, candidateFillingRatio, initArray, verbose) {
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
      kernel = new Float32Array(customKernel.flat());
    } else {
      console.warn("Inputted kernel is null or not an array. Default to Gaussian");
      kernel = _getGaussianKernelLUT(sigma);
      kernelHeight = 2 * Math.ceil(3 * sigma) + 1;
      kernelWidth = kernelHeight;
    }

    const sqSz = width * height;

    // Setup arrays
    const binArray = new Uint8Array(sqSz);
    const rankArray = new Int32Array(sqSz);
    const blurred = new Float32Array(sqSz);
    binArray.set(blueNoiseUtils.noiseArray(width, height, density));

    if (initArray && initArray.flat().length === sqSz) {
      binArray.set(initArray.flat());
    } else {
      console.warn(
        "Inputted initial array dimension does not match " + width + "x" + height + ". Default to candidate algorithm"
      );
      _candidateAlgoInPlace(binArray, width, height, sigma, _getGaussianKernelLUT(sigma));
    }

    const filled1 = binArray.reduce((sum, v) => sum + v, 0);
    const candidateFillingRatioScaled =
      filled1 + Math.floor(Math.min(Math.max(candidateFillingRatio, 0), 1) * (sqSz - filled1));

    if (verbose) {
      console.info("Number of initial placed points: " + filled1);
      console.info("Candidate filling ratio: " + candidateFillingRatio);
    }

    // Phase 1
    // Temporary binary array, original binary array is left unchanged after phase 1
    const temp = new Uint8Array(binArray);
    blueNoiseUtils.blurWrapInPlace(binArray, width, height, kernel, blurred, kernelWidth, kernelHeight);

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
    blueNoiseUtils.blurWrapInPlace(binArray, width, height, kernel, blurred, kernelWidth, kernelHeight);

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
    blueNoiseUtils.blurWrapInPlace(temp, width, height, kernel, blurred, kernelWidth, kernelHeight);

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

  // New
  /**
   * Generate blue noise with Void and Cluster method
   *
   * Solved the unevely distributed dots problem
   * Any developers who wants free and high quality blue noise please notice this!!
   *
   * @returns {array}
   */

  function _variableVoidAndCluster(
    width,
    height,
    sigmaStart,
    sigmaMiddle,
    sigmaEnd,
    candidateFillingRatio,
    density,
    initArray,
    windowFuncEquation
  ) {
    //Safety checks
    if (width == null) throw new Error("'width' arguments is mandatory");
    if (height == null) throw new Error("'height' arguments is mandatory");
    if (!Number.isInteger(width) || !Number.isInteger(height)) throw new Error("'width' and 'height' must be integers");

    if (sigmaStart == null) throw new Error("sigmaStart is mandatory");
    if (sigmaMiddle == null) throw new Error("sigmaMiddle is mandatory");
    if (sigmaEnd == null) throw new Error("sigmaEnd is mandatory");

    if (candidateFillingRatio == null) {
      console.warn("candidateFillingRatio falled back to " + 0.5);
      candidateFillingRatio = 0.5;
    }

    const sqSz = width * height;

    //Setup arrays
    const binArray = new Uint8Array(sqSz);
    const rankArray = new Int32Array(sqSz);
    const blurred = new Float32Array(sqSz);

    binArray.set(blueNoiseUtils.noiseArray(width, height, density));

    if (initArray && initArray.flat().length === sqSz) {
      binArray.set(initArray.flat());
    } else {
      console.warn(
        "Inputted initial array dimension does not match " + width + "x" + height + ". Default to candidate algorithm"
      );
      _candidateAlgoInPlace(binArray, width, height, sigmaStart, _getGaussianKernelLUT(sigmaStart));
    }

    const filled1 = binArray.reduce((sum, v) => sum + v, 0);
    candidateFillingRatio = filled1 + Math.floor(Math.min(Math.max(candidateFillingRatio, 0), 1) * (sqSz - filled1));

    let rank = 0;
    const windowFunc = _getWindowFunctionLUT(sqSz, windowFuncEquation);
    let variableSigma = sigmaStart;
    let kernel = _getGaussianKernelLUT(variableSigma);
    let kernelHeight = 2 * Math.ceil(3 * variableSigma) + 1;
    let kernelWidth = kernelHeight;

    console.info("Number of initial placed points: " + filled1);
    console.info("Candidate filling ratio: " + candidateFillingRatio);

    //Phase 1
    const temp = new Uint8Array(binArray);
    blueNoiseUtils.blurWrapInPlace(binArray, width, height, kernel, blurred, kernelWidth, kernelHeight);

    for (rank = 0; rank < filled1; rank++) {
      let value = -Infinity;
      let idx;

      for (let j = 0; j < sqSz; j++) {
        const blurredValue = blurred[j];
        if (temp[j] === 1 && blurredValue > value) {
          value = blurredValue;
          idx = j;
        }
      }

      temp[idx] = 0;
      rankArray[idx] = filled1 - rank;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, idx, -1, blurred, kernel, kernelWidth, kernelHeight);
    }
    //End of Phase 1

    //Phase 2
    blueNoiseUtils.blurWrapInPlace(binArray, width, height, kernel, blurred, kernelWidth, kernelHeight);

    for (rank = filled1; rank < candidateFillingRatio; rank++) {
      let value = Infinity;
      let idx;
      let kernel;

      for (let j = 0; j < sqSz; j++) {
        if (binArray[j] === 0) {
          const blurredValue = blurred[j];
          if (blurredValue < value) {
            value = blurredValue;
            idx = j;
          }
        }
      }

      binArray[idx] = 1;
      rankArray[idx] = rank;

      variableSigma = sigmaStart + (sigmaMiddle - sigmaStart) * windowFunc[rank];
      kernel = _getGaussianKernelLUT(variableSigma);
      kernelHeight = 2 * Math.ceil(3 * variableSigma) + 1;
      kernelWidth = kernelHeight;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, idx, 1, blurred, kernel, kernelWidth, kernelHeight);
    }

    //Phase 3

    for (let i = 0; i < sqSz; i++) temp[i] = 1 - binArray[i];

    blueNoiseUtils.blurWrapInPlace(temp, width, height, kernel, blurred, kernelWidth, kernelHeight);

    for (rank = candidateFillingRatio; rank < sqSz; rank++) {
      let value = -Infinity;
      let idx;
      let kernel;

      for (let j = 0; j < sqSz; j++) {
        if (binArray[j] === 0) {
          const blurredValue = blurred[j];
          if (blurredValue > value) {
            value = blurredValue;
            idx = j;
          }
        }
      }

      binArray[idx] = 1;
      rankArray[idx] = rank;

      variableSigma = sigmaEnd + (sigmaMiddle - sigmaEnd) * windowFunc[rank];
      kernel = _getGaussianKernelLUT(variableSigma);
      kernelHeight = 2 * Math.ceil(3 * variableSigma) + 1;
      kernelWidth = kernelHeight;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, idx, -1, blurred, kernel, kernelWidth, kernelHeight);
    }

    return rankArray;
  }

  // New
  /**
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} sigma
   * @param {*} customKernel
   */

  function _candidateAlgoInPlace(inArray, width, height, sigma, customKernel) {
    const sqSz = width * height;
    const blurred = new Float32Array(sqSz);

    if (inArray == null) throw new Error("Inputted array is null");

    if (ArrayBuffer.isView(inArray)) {
    } else if (inArray.flat().length === sqSz) {
      inArray.set(inArray.flat());
    } else {
      throw new Error("Inputted array dimension does not match " + width + "x" + height);
    }

    const kernelCheck = customKernel != null && Array.isArray(customKernel);
    let kernel = new Float32Array(2 * Math.ceil(3 * sigma) + 1);
    let kernelWidth;
    let kernelHeight;

    if (kernelCheck) {
      kernelWidth = customKernel.length;
      kernelHeight = customKernel[0].length;
      kernel = new Float32Array(customKernel.flat());
    } else {
      console.warn("Inputted kernel is null or not an array. Default to Gaussian");
      kernel = _getGaussianKernelLUT(sigma);
      kernelWidth = 2 * Math.ceil(3 * sigma) + 1;
      kernelHeight = kernelWidth;
    }

    blueNoiseUtils.blurWrapInPlace(inArray, width, height, kernel, blurred, kernelWidth, kernelHeight);

    while (true) {
      let clusterValue = -Infinity;
      let clusterIdx;

      for (let i = 0; i < sqSz; i++) {
        const blurredValue = blurred[i];
        if (inArray[i] === 1 && blurredValue > clusterValue) {
          clusterValue = blurredValue;
          clusterIdx = i;
        }
      }

      inArray[clusterIdx] = 0;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, clusterIdx, -1, blurred, kernel, kernelWidth, kernelHeight);

      let voidValue = Infinity;
      let voidIdx;

      for (let i = 0; i < sqSz; i++) {
        const blurredValue = blurred[i];
        if (inArray[i] === 0 && blurredValue < voidValue) {
          voidValue = blurredValue;
          voidIdx = i;
        }
      }

      if (clusterIdx === voidIdx || clusterValue === voidValue) {
        break;
      }

      inArray[voidIdx] = 1;

      blueNoiseUtils.deltaBlurUpdateInPlace(width, height, voidIdx, 1, blurred, kernel, kernelWidth, kernelHeight);
    }
  }

  // Updated
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
      const kernel = new Float32Array(kernelSize * kernelSize);
      const denom = 2 * sigma * sigma;

      for (let y = -radius; y <= radius; y++) {
        const dbY = y * y;
        const yOffs = (y + radius) * kernelSize;

        for (let x = -radius; x <= radius; x++) {
          kernel[yOffs + (x + radius)] = Math.exp(-(x * x + dbY) / denom);
        }
      }

      gaussianKernelLUT.set(sigma, kernel);
    }

    return gaussianKernelLUT.get(sigma);
  }

  // New
  /**
   *
   * @param {*} N
   * @param {*} equation
   * @returns
   */

  const windowFuncLUT = new Map();

  function _getWindowFunctionLUT(N, equation) {
    if (!Number.isInteger(N)) throw new Error("N must be an integer");
    if (equation == null) throw new Error("Unknown equation input: " + equation);

    const trimmed = equation.replace(/\s/g, "");
    const key = N + " | " + trimmed;

    if (!windowFuncLUT.has(key)) {
      const array = new Float32Array(N).fill(1);
      const cp = new Function("n", "N", "return " + trimmed);

      for (let n = 0; n < N; n++) array[n] *= cp(n, N);

      windowFuncLUT.set(key, array);
    }

    return windowFuncLUT.get(key);
  }

  return {
    voidAndCluster: _voidAndCluster,
    variableVoidAndCluster: _variableVoidAndCluster,
    candidateAlgoInPlace: _candidateAlgoInPlace,
    getGaussianKernelLUT: _getGaussianKernelLUT,
    getWindowFunctionLUT: _getWindowFunctionLUT,
  };
})();
