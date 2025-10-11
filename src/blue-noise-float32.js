/**
 * Free JS implementation of Void and Cluster method by Robert Ulichney
 * Ultra optimized while keeping it readable
 * The result is high quality blue noise but somehow very fast
 * https://github.com/901D3/blue-noise.js
 *
 * Copyright (c) 901D3
 * This code is licensed with GPLv3 license
 */

"use strict";

var blueNoiseFloat32 = (function () {
  /**
   * @typedef {number} normalized - A number in the range of 0 - 1
   */

  /**
   * Generate blue noise with void and cluster method, initial binary array using Poisson Disk Sampling
   *
   * @param {int} width - Output array "width"
   * @param {int} height - Output array "height"
   *
   * @param {number} phase1SigmaStart - Phase 1 sigma gradient start value
   * @param {number} phase1SigmaEnd - Phase 1 sigma gradient end value
   * @param {number} phase2SigmaStart - Phase 2 sigma gradient start value
   * @param {number} phase2SigmaEnd - Phase 2 sigma gradient end value
   * @param {number} phase3SigmaStart - Phase 3 sigma gradient start value
   * @param {number} phase3SigmaEnd - Phase 3 sigma gradient end value
   *
   * @param {number[]} phase1Kernel - Phase 1 blur kernel
   * @param {number[]} phase2Kernel - Phase 2 blur kernel
   * @param {number[]} phase3Kernel - Phase 3 blur kernel
   *
   * @param {normalized} candidateFillingRatio - The ratio between phase 2 and phase 3
   * @param {Uint8Array} initArray - Initial array, it act like user inputted seed, must have the same length as (<width> * <height>), array dimension(2D 3D or 4D) doesn't matter
   * If no array if supplied it will default to randomized Poisson Disk Sampling
   *
   * @returns {array}
   */

  function _voidAndCluster(
    width,
    height,
    PDSRadiusX,
    PDSRadiusY,
    PDSKValue,
    phase1SigmaStart,
    phase1SigmaEnd,
    phase2SigmaStart,
    phase2SigmaEnd,
    phase3SigmaStart,
    phase3SigmaEnd,
    phase1Kernel,
    phase2Kernel,
    phase3Kernel,
    candidateFillingRatio,
    initArray
  ) {
    let t0 = performance.now();
    let t1 = performance.now();

    //Safety checks

    if (width == null || height == null || PDSRadiusX == null || PDSRadiusY == null) {
      throw new Error("'width', 'height', 'PDSRadiusX', 'PDSRadiusY', arguments is mandatory");
    }

    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      throw new Error("'width' and 'height' must be integers");
    }

    const phase1KernelCheck = phase1Kernel != null && Array.isArray(phase1Kernel);
    const phase2KernelCheck = phase2Kernel != null && Array.isArray(phase2Kernel);
    const phase3KernelCheck = phase3Kernel != null && Array.isArray(phase3Kernel);
    if (!phase1Kernel) {
      if (phase1SigmaStart == null) {
        throw new Error("phase1Kernel is " + phase1Kernel + ". 'phase1Sigmaphase1SigmaStart' arguments is mandatory");
      }
    }

    if (PDSKValue == null) {
      console.warn("PDSKValue falled back to " + 30);
      PDSKValue = 30;
    }

    if (phase1SigmaEnd == null) {
      console.warn("phase1SigmaEnd falled back to " + phase1SigmaStart);
      phase1SigmaEnd = phase1SigmaStart;
    }

    if (phase2SigmaStart == null) {
      console.warn("phase2SigmaStart falled back to " + phase1SigmaStart);
      phase2SigmaStart = phase1SigmaStart;
    }
    if (phase2SigmaEnd == null) {
      console.warn("phase2SigmaEnd falled back to " + phase1SigmaStart);
      phase2SigmaEnd = phase1SigmaStart;
    }

    if (phase3SigmaStart == null) {
      console.warn("phase3SigmaStart falled back to " + phase1SigmaStart);
      phase3SigmaStart = phase1SigmaStart;
    }
    if (phase3SigmaEnd == null) {
      console.warn("phase3SigmaEnd falled back to " + phase1SigmaStart);
      phase3SigmaEnd = phase1SigmaStart;
    }

    if (candidateFillingRatio == null) {
      console.warn("candidateFillingRatio falled back to " + 0.5);
      candidateFillingRatio = 0.5;
    }

    //Get custom kernel sizes before flat them
    let phase1KernelHeight;
    let phase1KernelWidth;
    let phase2KernelWidth;
    let phase2KernelHeight;
    let phase3KernelWidth;
    let phase3KernelHeight;
    if (phase1KernelCheck) {
      phase1KernelHeight = phase1Kernel.length;
      phase1KernelWidth = phase1Kernel[0].length;
      phase1Kernel = new Float32Array(phase1Kernel.flat());
    }
    if (phase2KernelCheck) {
      phase2KernelWidth = phase2Kernel.length;
      phase2KernelHeight = phase2Kernel[0].length;
      phase2Kernel = new Float32Array(phase2Kernel.flat());
    }
    if (phase3KernelCheck) {
      phase3KernelWidth = phase3Kernel.length;
      phase3KernelHeight = phase3Kernel[0].length;
      phase3Kernel = new Float32Array(phase3Kernel.flat());
    }

    const sqSz = width * height;

    //Setup arrays
    const binArray = new Uint8Array(sqSz);
    const rankArray = new Int32Array(sqSz);
    const blurred = new Float32Array(sqSz);

    if (initArray && initArray.flat().length === sqSz) {
      binArray.set(initArray.flat());
    } else {
      console.warn(
        "Inputed initial array dimension does not match " + width + "x" + height + ", default to Poisson Disk Sampling"
      );
      binArray.set(blueNoiseUtils.poissonDiskSampling(width, height, PDSRadiusX, PDSRadiusY, PDSKValue));
    }

    const filled1 = binArray.reduce((sum, v) => sum + v, 0);
    candidateFillingRatio = filled1 + Math.floor(Math.min(Math.max(candidateFillingRatio, 0), 1) * (sqSz - filled1));

    let kernel;
    if (!phase1KernelCheck) {
      kernel = _getGaussianKernelLUT(phase1SigmaStart);
      phase1KernelHeight = 2 * Math.ceil(3 * phase1SigmaStart) + 1;
      phase1KernelWidth = phase1KernelHeight;
    }

    console.info("Number of initial placed points: " + filled1);
    console.info("Candidate filling ratio: " + candidateFillingRatio);
    console.info("Setup took " + (performance.now() - t1) + "ms");

    //Phase 1
    t1 = performance.now();

    //Temporary binary array, original binary array is left unchanged after phase 1
    const temp = new Uint8Array(binArray);
    blueNoiseUtils.blurWrap(
      binArray,
      width,
      height,
      phase1KernelCheck ? phase1Kernel : kernel,
      blurred,
      phase1KernelWidth,
      phase1KernelHeight
    );

    for (let rank = 0; rank < filled1; rank++) {
      let value = -Infinity;
      let idx;
      let kernel;

      for (let j = 0; j < sqSz; j++) {
        if (temp[j] === 1) {
          const blurredValue = blurred[j];
          if (blurredValue > value) {
            value = blurredValue;
            idx = j;
          }
        }
      }

      //Remove "1" from tightest cluster in Binary Pattern.
      temp[idx] = 0;
      rankArray[idx] = filled1 - rank;

      if (!phase1KernelCheck) {
        const gradient = phase1SigmaStart + (phase1SigmaEnd - phase1SigmaStart) * (rank / sqSz);
        kernel = _getGaussianKernelLUT(gradient);
        phase1KernelHeight = 2 * Math.ceil(3 * gradient) + 1;
        phase1KernelWidth = phase1KernelHeight;
      }
      blueNoiseUtils.deltaBlurUpdate(
        width,
        height,
        idx,
        -1,
        blurred,
        phase1KernelCheck ? phase1Kernel : kernel,
        phase1KernelWidth,
        phase1KernelHeight
      );
    }
    console.info("Phase 1 took " + (performance.now() - t1) + "ms");
    //End of Phase 1

    //Phase 2
    t1 = performance.now();

    if (!phase2KernelCheck) {
      kernel = _getGaussianKernelLUT(phase2SigmaStart);
      phase2KernelHeight = 2 * Math.ceil(3 * phase2SigmaStart) + 1;
      phase2KernelWidth = phase2KernelHeight;
    }
    blueNoiseUtils.blurWrap(
      binArray,
      width,
      height,
      phase2KernelCheck ? phase2Kernel : kernel,
      blurred,
      phase2KernelWidth,
      phase2KernelHeight
    );
    console.log(phase2KernelCheck ? phase2Kernel : kernel);

    for (let rank = filled1; rank < candidateFillingRatio; rank++) {
      let value = Infinity;
      let idx;
      let kernel;

      //Find location of tightest cluster in Binary Pattern.
      for (let j = 0; j < sqSz; j++) {
        if (binArray[j] === 0) {
          const blurredValue = blurred[j];
          if (blurredValue < value) {
            value = blurredValue;
            idx = j;
          }
        }
      }

      //Remove "0" from largest void in Binary Pattern.
      binArray[idx] = 1;
      rankArray[idx] = rank; //Number of 1s left in the binArray

      if (!phase2KernelCheck) {
        const gradient = phase2SigmaStart + (phase2SigmaEnd - phase2SigmaStart) * (rank / sqSz);
        kernel = _getGaussianKernelLUT(gradient);
        phase2KernelHeight = 2 * Math.ceil(3 * gradient) + 1;
        phase2KernelWidth = phase2KernelHeight;
      }
      blueNoiseUtils.deltaBlurUpdate(
        width,
        height,
        idx,
        1,
        blurred,
        phase2KernelCheck ? phase2Kernel : kernel,
        phase2KernelWidth,
        phase2KernelHeight
      );
    }
    console.info("Phase 2 took " + (performance.now() - t1) + "ms");

    //Phase 3
    t1 = performance.now();
    if (!phase3KernelCheck) {
      kernel = _getGaussianKernelLUT(phase3SigmaStart);
      phase3KernelHeight = 2 * Math.ceil(3 * phase3SigmaStart) + 1;
      phase3KernelWidth = phase3KernelHeight;
    }

    //Copy binary array to temp and invert it, 0 becomes 1 and vice versa
    for (let i = 0; i < sqSz; i++) temp[i] = 1 - binArray[i];

    //Blur the temp array, so we use binArray[idx] === 0
    blueNoiseUtils.blurWrap(temp, width, height, phase3KernelCheck ? phase3Kernel : kernel, blurred, phase3KernelWidth, phase3KernelHeight);

    //Fills in the remaining "0s" in binArray so rankArray is complete blue noise without any voids
    for (let rank = candidateFillingRatio; rank < sqSz; rank++) {
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

      if (!phase3KernelCheck) {
        const gradient = phase3SigmaStart + (phase3SigmaEnd - phase3SigmaStart) * (rank / sqSz);
        kernel = _getGaussianKernelLUT(gradient);
        phase3KernelHeight = 2 * Math.ceil(3 * gradient) + 1;
        phase3KernelWidth = phase3KernelHeight;
      }
      blueNoiseUtils.deltaBlurUpdate(
        width,
        height,
        idx,
        -1,
        blurred,
        phase3KernelCheck ? phase3Kernel : kernel,
        phase3KernelWidth,
        phase3KernelHeight
      );
    }
    console.info("Phase 3 took " + (performance.now() - t1) + "ms");
    console.info("Total time: " + (performance.now() - t0) + "ms");

    return rankArray;
  }

  /**
   * Simple function for getting Gaussian kernel + LUT
   *
   * @param {float} sigma
   * @returns {array}
   */

  const gaussianKernelLUT = new Map();

  function _getGaussianKernelLUT(sigma) {
    const radius = Math.ceil(3 * sigma);

    if (!gaussianKernelLUT.has(sigma)) {
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

      gaussianKernelLUT.set(sigma, kernel);
    }

    return gaussianKernelLUT.get(sigma);
  }

  return {
    voidAndCluster: _voidAndCluster,
    getGaussianKernelLUT: _getGaussianKernelLUT,
  };
})();
