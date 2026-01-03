/**
 * Free JS implementation of Void and Cluster method by Robert Ulichney and other methods
 * Remember to link blue-noise-utils.js
 *
 * v0.2.7.01
 * https://github.com/901D3/blue-noise.js
 *
 * Copyright (c) 901D3
 * This code is licensed with GPLv3 license
 */

"use strict";

const BlueNoiseFloat64 = (function () {
  // It was a big failure to use 3*sigma
  let _gaussianSigmaRadiusMultiplier = 10;

  let _useAdaptiveSigmaCandidateAlgo = false;
  let _initialSigmaScale = 0.5; // Best value for adaptive candidate algorithm

  /**
   * VACluster - short for "Void and Cluster"
   *
   * LOSSY:
   * This implementation is lossy for high numbers of samples
   */

  // -------------------- MASK GENERATING METHODS --------------------

  // _originalVoidAndCluster is just a simplified version of _extendedVoidAndClusterWrapAround.
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
    const kernelArray = _getGaussianKernel(sigma);

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
    const samples = (sqSz * density) | 0;
    // Fill binArray from 0 to samples with 1, but it is yet to be shuffled
    for (let i = 0; i < samples; i++) binArray[i] = 1;

    // Now shuffle it, this act like seeding
    BlueNoiseUtils.shuffle(binArray);

    _candidateMethodWrapAroundInPlace(binArray, width, height, sigma);

    // Phase 1
    // blur binArray
    BlueNoiseUtils.convolveWrapAroundInPlace(
      binArray,
      blurredArray,
      width,
      height,
      kernelArray,
      kernelSize,
      kernelSize
    );

    // Save the blurredArray, only for phase 1
    const blurredTempArray = blurredArray.slice();
    // Temporary binary array, original binary array is left unchanged after phase 1
    const temp = binArray.slice();

    // Go backwards
    for (let rank = samples - 1; rank >= 0; rank--) {
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
      BlueNoiseUtils.convolveAddWrapAroundInPlace(
        blurredTempArray,
        width,
        height,
        idx,
        -1,
        kernelArray,
        kernelSize,
        kernelSize
      );
    }
    // End of Phase 1

    // Phase 2
    BlueNoiseUtils.convolveWrapAroundInPlace(
      binArray,
      blurredArray,
      width,
      height,
      kernelArray,
      kernelSize,
      kernelSize
    );

    // Start from filled 1
    const halfSqSz = (sqSz / 2) | 0;
    for (let rank = samples; rank < halfSqSz; rank++) {
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

      BlueNoiseUtils.convolveAddWrapAroundInPlace(
        blurredArray,
        width,
        height,
        idx,
        1,
        kernelArray,
        kernelSize,
        kernelSize
      );
    }
    // End of Phase 2

    // Phase 3
    // Copy binary array to temp and invert it, 0 becomes 1 and vice versa
    for (let i = 0; i < sqSz; i++) temp[i] = 1 - binArray[i];

    // Blur the inverted array
    BlueNoiseUtils.convolveWrapAroundInPlace(
      temp,
      blurredArray,
      width,
      height,
      kernelArray,
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

      BlueNoiseUtils.convolveAddWrapAroundInPlace(
        blurredArray,
        width,
        height,
        idx,
        -1,
        kernelArray,
        kernelSize,
        kernelSize
      );
    }
    // End of Phase 3

    return rankArray;
  };

  /**
   * Extended version of VACluster
   * https://cv.ulichney.com/papers/1993-void-cluster.pdf
   *
   * @param {*} width
   * @param {*} height
   * @param {*} sigma
   * @param {*} candidateMethodSigma
   * @param {*} samples
   * @param {*} customKernelArray
   * @returns
   */

  const _extendedVoidAndClusterWrapAround = (
    width,
    height,
    sigma,
    candidateMethodSigma,
    samples,
    customKernelArray
  ) => {
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      throw new Error("width and height must be integers");
    }

    const sqSz = width * height;

    if (samples >= sqSz) throw new Error("Samples >= " + sqSz);
    else if (samples <= 0) throw new Error("Samples <= 0");

    const kernelArrayCheck = Array.isArray(customKernelArray);
    if (!kernelArrayCheck && sigma == null) throw new Error("sigma = " + sigma);

    if (sigma === 0) throw new Error("Divide by 0");

    let kernelArray = _getGaussianKernel(sigma);
    let kernelWidth = (Math.ceil(_gaussianSigmaRadiusMultiplier * sigma) << 1) + 1;
    let kernelHeight = kernelWidth;

    // If using custom kernel
    if (kernelArrayCheck) {
      kernelHeight = customKernelArray.length;
      kernelWidth = customKernelArray[0].length;
      kernelArray = new Float64Array(customKernelArray.flat());
    }

    const binArray = new Uint8Array(sqSz);
    const rankArray = new Uint32Array(sqSz);
    const blurredArray = new Float64Array(sqSz);

    const sampleIndexesArray = new Uint32Array(samples);

    for (let i = 0; i < samples; i++) binArray[i] = 1;

    BlueNoiseUtils.shuffle(binArray);

    // Do Ulichney's Candidate Algorithm taken from VACluster
    // If using adaptive sigma (overwrite all other options)
    if (_useAdaptiveSigmaCandidateAlgo) {
      _adaptiveCandidateMethodWrapAroundInPlace(binArray, width, height);
    }
    // If using custom kernel
    else if (kernelArrayCheck) {
      _candidateMethodWrapAroundInPlace(binArray, width, height, null, customKernelArray);
    }
    // If not using custom kernel nor adaptive sigma, use the inputted sigma
    else {
      _candidateMethodWrapAroundInPlace(binArray, width, height, candidateMethodSigma);
    }

    for (let i = 0, idx = 0; i < sqSz; i++) {
      if (binArray[i] === 1) sampleIndexesArray[idx++] = i;
    }

    // Phase 1
    // Blur once
    BlueNoiseUtils.convolveWrapAroundInPlace(
      binArray,
      blurredArray,
      width,
      height,
      kernelArray,
      kernelWidth,
      kernelHeight
    );

    // Evenly distributed dots blurred, ~for phase 2 tie-breaker~
    const blurredTemp = blurredArray.slice();

    for (let rank = samples - 1; rank >= 0; rank--) {
      let idx;
      let value = -Infinity;
      //let valueTemp = -Infinity;

      for (let i = 0; i < samples; i++) {
        const sampleIdx = sampleIndexesArray[i];
        if (binArray[sampleIdx] === 1) {
          // "Find tightest cluster"
          const blurredValue = blurredArray[sampleIdx];

          if (blurredValue > value) {
            value = blurredValue;
            idx = sampleIdx;
          }

          /*
          // If the current 1 have the same energy as the previous one, go to this tie-breaker
          else if (blurredValue === value) {
            const blurredTempValue = blurredTemp[sampleIdx];
  
            if (blurredTempValue > valueTemp) {
              valueTemp = blurredTempValue;
              idx = sampleIdx;
            }
          }
          */
        }
      }

      binArray[idx] = 0;
      rankArray[idx] = rank;

      BlueNoiseUtils.convolveAddWrapAroundInPlace(
        blurredArray,
        width,
        height,
        idx,
        -1,
        kernelArray,
        kernelWidth,
        kernelHeight
      );
    }
    // End of Phase 1

    // Phase 2
    blurredArray.set(blurredTemp);
    for (let i = 0; i < samples; i++) binArray[sampleIndexesArray[i]] = 1;

    for (let rank = samples; rank < sqSz; rank++) {
      let idx;
      let value = Infinity;
      //let valueTemp = Infinity;

      for (let i = 0; i < sqSz; i++) {
        if (binArray[i] === 0) {
          // "Find voidest void"
          const blurredValue = blurredArray[i];

          if (blurredValue < value) {
            value = blurredValue;
            idx = i;
          }

          /*
          // If the current 0 have the same energy as the previous one, go to this tie-breaker
          else if (blurredValue === value) {
            const blurredTempValue = blurredTemp[i];

            if (blurredTempValue < valueTemp) {
              valueTemp = blurredTempValue;
              idx = i;
            }
          }
          */
        }
      }

      binArray[idx] = 1;
      rankArray[idx] = rank;

      BlueNoiseUtils.convolveAddWrapAroundInPlace(
        blurredArray,
        width,
        height,
        idx,
        1,
        kernelArray,
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
   * https://www.iliyan.com/publications/DitheredSampling
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} sigmaImage
   * @param {*} sigmaSample
   * @param {*} iterations
   * @param {*} pNorm
   * @param {*} customKernelArray
   */

  const _georgievFajardoWrapAroundInPlace = (
    inArray,
    width,
    height,
    sigmaImage,
    sigmaSample,
    iterations,
    pNorm,
    customKernelArray
  ) => {
    if (!ArrayBuffer.isView(inArray)) throw new Error("inArray is not ArrayBuffer");

    const sqSz = width * height;

    const kernelArrayCheck = Array.isArray(customKernelArray);
    if (!kernelArrayCheck && sigmaImage == null) throw new Error("sigmaImage = " + sigmaImage);

    if (sigmaImage === 0) throw new Error("Divide by 0");

    let kernelArray = _getGaussianKernel(sigmaImage);
    let kernelWidth = (Math.ceil(_gaussianSigmaRadiusMultiplier * sigmaImage) << 1) + 1;
    let kernelHeight = kernelWidth;

    // If using custom kernel
    if (kernelArrayCheck) {
      kernelHeight = customKernelArray.length;
      kernelWidth = customKernelArray[0].length;
      kernelArray = new Float64Array(customKernelArray.flat());
    }

    // Prepare energy map
    const energyArray = new Float64Array(sqSz);
    BlueNoiseUtils.computeTotalEnergyGeorgevFajardoWrapAroundInPlace(
      inArray,
      energyArray,
      width,
      height,
      sigmaSample,
      pNorm,
      kernelArray,
      kernelWidth,
      kernelHeight
    );

    for (let iter = 0; iter < iterations; iter++) {
      // Random index
      const p_i = (Math.random() * sqSz) | 0;
      const q_i = iter % sqSz;

      // Swap pixels
      const temp = inArray[p_i];
      inArray[p_i] = inArray[q_i];
      inArray[q_i] = temp;

      // Compute energy for both swapped pixel indexes
      const newEnergy1 = BlueNoiseUtils.computeEnergyGeorgevFajardoWrapAround(
        inArray,
        width,
        height,
        p_i,
        sigmaSample,
        pNorm,
        kernelArray,
        kernelWidth,
        kernelHeight
      );

      const newEnergy2 = BlueNoiseUtils.computeEnergyGeorgevFajardoWrapAround(
        inArray,
        width,
        height,
        q_i,
        sigmaSample,
        pNorm,
        kernelArray,
        kernelWidth,
        kernelHeight
      );

      if (newEnergy1 + newEnergy2 < energyArray[p_i] + energyArray[q_i]) {
        energyArray[p_i] = newEnergy1;
        energyArray[q_i] = newEnergy2;
      } else {
        const temp = inArray[p_i];
        inArray[p_i] = inArray[q_i];
        inArray[q_i] = temp;
      }
    }
  };

  // -------------------- DITHER --------------------

  const _directBinarySearchSimple = (
    inArray,
    ditheredArray,
    customIndexesArray,
    width,
    height,
    sigma,
    iterations,
    customKernelArray
  ) => {
    throw new Error(
      "This DBS function is for educational purposes only, you can run it anyway but it is very slow. Consider using the optimized version.\n" +
        "This DBS function will not be removed."
    );
    if (!ArrayBuffer.isView(inArray)) throw new Error("Inputted array is not an ArrayBuffer");
    if (!ArrayBuffer.isView(ditheredArray))
      throw new Error("Inputted dithered array is not an ArrayBuffer");
    if (!ArrayBuffer.isView(customIndexesArray)) {
      throw new Error("Indexes array is not an ArrayBuffer");
    }

    const sqSz = width * height;

    const kernelArrayCheck = Array.isArray(customKernelArray);
    if (!kernelArrayCheck && sigmaImage == null) throw new Error("sigma = " + sigma);

    if (sigma === 0) throw new Error("Divide by 0");

    let kernel = _getGaussianKernel(sigma);
    let kernelWidth = (Math.ceil(_gaussianSigmaRadiusMultiplier * sigma) << 1) + 1;
    let kernelHeight = kernelWidth;

    if (kernelArrayCheck) {
      kernelHeight = customKernelArray.length;
      kernelWidth = customKernelArray[0].length;
      kernel = new Float64Array(customKernelArray.flat());
    }

    const kernelSqSz = kernelWidth * kernelHeight;

    const errorArray = new Float64Array(sqSz);
    for (let i = 0; i < sqSz; i++) {
      errorArray[i] = inArray[i] / 255 - ditheredArray[i];
    }

    const blurredArray = new Float64Array(sqSz);
    const localWindowArray = new Float64Array(kernelSqSz);

    BlueNoiseUtils.convolveInPlace(
      errorArray,
      blurredArray,
      width,
      height,
      kernel,
      kernelWidth,
      kernelHeight
    );

    let currentEnergy = 0;
    for (let i = 0; i < sqSz; i++) currentEnergy += blurredArray[i];

    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < sqSz; i++) {
        const idx = customIndexesArray[i];
        // Get local energy before flip
        BlueNoiseUtils.getConvolvedAreaInPlace(
          blurredArray,
          width,
          height,
          idx,
          localWindowArray,
          kernelWidth,
          kernelHeight
        );

        // Compute local energy
        let newEnergy = currentEnergy;

        for (let j = 0; j < kernelSqSz; j++) newEnergy -= localWindowArray[j] ** 2;

        // Do the flip
        const oldPixel = ditheredArray[idx];
        ditheredArray[idx] ^= 1;
        const deltaError = oldPixel - ditheredArray[idx];

        BlueNoiseUtils.convolveAddInPlace(
          blurredArray,
          width,
          height,
          idx,
          deltaError,
          kernel,
          kernelWidth,
          kernelHeight
        );

        // Get local energy after flip
        BlueNoiseUtils.getConvolvedAreaInPlace(
          blurredArray,
          width,
          height,
          idx,
          localWindowArray,
          kernelWidth,
          kernelHeight
        );

        // Compute local energy
        for (let j = 0; j < kernelSqSz; j++) newEnergy += localWindowArray[j] ** 2;

        if (newEnergy < currentEnergy) currentEnergy = newEnergy;
        else {
          // Revert
          ditheredArray[idx] = oldPixel;

          BlueNoiseUtils.convolveAddInPlace(
            blurredArray,
            width,
            height,
            idx,
            -deltaError,
            kernel,
            kernelWidth,
            kernelHeight
          );
        }
      }
    }
  };

  /**
   * FM screen design using DBS algorithm
   * https://ieeexplore.ieee.org/document/559555
   *
   * No toroidal version
   *
   * @param {*} inArray
   * @param {*} ditheredArray
   * @param {*} customIndexesArray
   * @param {*} width
   * @param {*} height
   * @param {*} sigma
   * @param {*} iterations
   * @param {*} customKernelArray
   */

  const _directBinarySearchInPlace = (
    inArray,
    ditheredArray,
    customIndexesArray,
    width,
    height,
    sigma,
    customKernelArray
  ) => {
    if (!ArrayBuffer.isView(inArray)) throw new Error("Inputted array is not an ArrayBuffer");
    if (!ArrayBuffer.isView(ditheredArray)) {
      throw new Error("Inputted dithered array is not an ArrayBuffer");
    }
    if (!ArrayBuffer.isView(customIndexesArray)) {
      throw new Error("Indexes array is not an ArrayBuffer");
    }

    const sqSz = width * height;

    const kernelArrayCheck = Array.isArray(customKernelArray);
    if (!kernelArrayCheck && sigma == null) throw new Error("sigma = " + sigma);

    if (sigma === 0) throw new Error("Divide by 0");

    let kernelArray = _getGaussianKernel(sigma);
    let kernelWidth = (Math.ceil(_gaussianSigmaRadiusMultiplier * sigma) << 1) + 1;
    let kernelHeight = kernelWidth;

    if (kernelArrayCheck) {
      kernelHeight = customKernelArray.length;
      kernelWidth = customKernelArray[0].length;
      kernelArray = new Float64Array(customKernelArray.flat());
    }

    let kernelEnergy = 0;
    for (let i = kernelWidth * kernelHeight - 1; i >= 0; i--) {
      kernelEnergy += kernelArray[i] ** 2;
    }

    const errorArray = new Float64Array(sqSz);
    for (let i = 0; i < sqSz; i++) {
      errorArray[i] = inArray[i] / 255 - ditheredArray[i];
    }

    const blurredArray = new Float64Array(sqSz);

    BlueNoiseUtils.convolveInPlace(
      errorArray,
      blurredArray,
      width,
      height,
      kernelArray,
      kernelWidth,
      kernelHeight
    );

    for (let i = 0; i < sqSz; i++) {
      const idx = customIndexesArray[i];

      // Do the flip
      const oldPixel = ditheredArray[idx];
      const newPixel = oldPixel ^ 1;
      const deltaError = oldPixel - newPixel;

      const dotProduct = BlueNoiseUtils.getConvolvedAreaDotProductInPlace(
        blurredArray,
        width,
        height,
        idx,
        kernelArray,
        kernelWidth,
        kernelHeight
      );

      const deltaEnergy = 2 * deltaError * dotProduct + deltaError * deltaError * kernelEnergy;

      if (deltaEnergy < 0) {
        ditheredArray[idx] = newPixel;
        errorArray[idx] += deltaError;

        BlueNoiseUtils.convolveAddInPlace(
          blurredArray,
          width,
          height,
          idx,
          deltaError,
          kernelArray,
          kernelWidth,
          kernelHeight
        );
      }
    }
  };

  const stochasticClusterDot = (idxXArray, idxYArray, width, height) => {};

  // -------------------- SAMPLING --------------------

  /**
   * Taken from VACluster
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} sigma
   * @param {*} samples
   * @param {*} customKernelArray
   */

  const _candidateMethodWrapAroundInPlace = (
    inArray,
    width,
    height,
    sigma,
    customKernelArray
  ) => {
    if (!ArrayBuffer.isView(inArray)) throw new Error("Inputted array is not an ArrayBuffer");
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      throw new Error("'width' and 'height' must be integers");
    }

    const sqSz = width * height;

    for (let i = 0; i < sqSz; i++) {
      if (inArray[i] === 1) break;
      if (i === sqSz - 1) throw new Error("Samples <= 0");
    }

    const kernelArrayCheck = Array.isArray(customKernelArray);
    if (!kernelArrayCheck && sigma == null) throw new Error("sigma = " + sigma);

    if (sigma === 0) throw new Error("Divide by 0");

    let kernelArray = _getGaussianKernel(sigma);
    let kernelWidth = (Math.ceil(_gaussianSigmaRadiusMultiplier * sigma) << 1) + 1;
    let kernelHeight = kernelWidth;

    if (kernelArrayCheck) {
      kernelHeight = customKernelArray.length;
      kernelWidth = customKernelArray[0].length;
      kernelArray = new Float64Array(customKernelArray.flat());
    }

    const blurredArray = new Float64Array(sqSz);

    BlueNoiseUtils.convolveWrapAroundInPlace(
      inArray,
      blurredArray,
      width,
      height,
      kernelArray,
      kernelWidth,
      kernelHeight
    );

    while (true) {
      let clusterValue = -Infinity;
      let voidValue = Infinity;
      let clusterIdx;
      let voidIdx;

      for (let i = 0; i < sqSz; i++) {
        if (inArray[i] === 1) {
          const blurredValue = blurredArray[i];

          if (blurredValue > clusterValue) {
            clusterValue = blurredValue;
            clusterIdx = i;
          }
        }
      }

      inArray[clusterIdx] = 0;

      BlueNoiseUtils.convolveAddWrapAroundInPlace(
        blurredArray,
        width,
        height,
        clusterIdx,
        -1,
        kernelArray,
        kernelWidth,
        kernelHeight
      );

      for (let i = 0; i < sqSz; i++) {
        if (inArray[i] === 0) {
          const blurredValue = blurredArray[i];

          if (blurredValue < voidValue) {
            voidValue = blurredValue;
            voidIdx = i;
          }
        }
      }

      if (clusterIdx === voidIdx) {
        inArray[clusterIdx] = 1;
        break;
      }

      inArray[voidIdx] = 1;

      BlueNoiseUtils.convolveAddWrapAroundInPlace(
        blurredArray,
        width,
        height,
        voidIdx,
        1,
        kernelArray,
        kernelWidth,
        kernelHeight
      );
    }
  };

  /**
   * Changes sigma value based on number of samples and dimension
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   */

  const _adaptiveCandidateMethodWrapAroundInPlace = (inArray, width, height) => {
    if (!ArrayBuffer.isView(inArray)) throw new Error("Inputted array is not an ArrayBuffer");

    const sqSz = width * height;
    let samples = 0;

    for (let i = 0; i < sqSz; i++) {
      if (inArray[i] === 1) samples++;
      if (i === sqSz - 1 && samples === 0) throw new Error("Samples <= 0");
    }

    _candidateMethodWrapAroundInPlace(
      inArray,
      width,
      height,
      Math.sqrt(sqSz / Math.abs(samples > sqSz * 0.5 ? sqSz - samples : samples)) *
        _initialSigmaScale
    );
  };

  /**
   * Mitchell's Best Candidate Algorithm
   * https://dl.acm.org/doi/10.1145/127719.122736
   *
   * @param {*} width
   * @param {*} height
   * @param {*} samples
   * @param {*} candidates
   * @returns
   */

  const _bestCandidateWrapAround = (width, height, samples, candidates) => {
    const halfWidth = width * 0.5;
    const halfHeight = height * 0.5;

    const samplesIdxXArray = new Float64Array(samples);
    const samplesIdxYArray = new Float64Array(samples);

    const flattenedSamplesArray = new Float64Array(samples);

    for (let sample = 0; sample < samples; sample++) {
      let bestDistance = -Infinity;
      let bestIdxX = 0;
      let bestIdxY = 0;

      for (let candidate = 0; candidate < candidates; candidate++) {
        const randomIdxX = Math.random() * width;
        const randomIdxY = Math.random() * height;

        if (sample === 0) {
          bestIdxX = randomIdxX;
          bestIdxY = randomIdxY;
          break;
        }

        let minDistance = Infinity;

        for (let i = 0; i < samples; i++) {
          let distanceX = randomIdxX - samplesIdxXArray[i];
          let distanceY = randomIdxY - samplesIdxYArray[i];

          if (distanceX < 0) distanceX = -distanceX;
          if (distanceY < 0) distanceY = -distanceY;

          if (distanceX > halfWidth) distanceX = width - distanceX;
          if (distanceY > halfHeight) distanceY = height - distanceY;

          const distance = distanceX * distanceX + distanceY * distanceY;
          if (distance < minDistance) minDistance = distance;
        }

        if (minDistance > bestDistance) {
          bestDistance = minDistance;
          bestIdxX = randomIdxX;
          bestIdxY = randomIdxY;
        }
      }

      samplesIdxXArray[sample] = bestIdxX;
      samplesIdxYArray[sample] = bestIdxY;

      flattenedSamplesArray[sample] = (bestIdxY | 0) * width + (bestIdxX | 0);
    }

    return flattenedSamplesArray;
  };

  /**
   * Lloyd's Relaxation
   *
   * https://en.wikipedia.org/wiki/Lloyd's_algorithm
   *
   * @see LOSSY
   *
   * @param {*} idxXArray
   * @param {*} idxYArray
   * @param {*} width
   * @param {*} height
   */

  const _relaxationWrapAroundInPlace = (idxXArray, idxYArray, width, height) => {
    const halfWidth = width * 0.5;
    const halfHeight = height * 0.5;

    const voronoi = BlueNoiseUtils.buildVoronoiDiagramWrapAroundOutOfBounds(
      idxXArray,
      idxYArray,
      width,
      height
    );

    for (let sample = voronoi.length - 1; sample >= 0; sample--) {
      const polygon = voronoi[sample]
      const vertices = polygon.length;
      if (vertices === 0) continue;

      let sumX = 0;
      let sumY = 0;

      const baseVertexIdxX = polygon[0][0];
      const baseVertexIdxY = polygon[0][1];

      for (let vertex = 0; vertex < vertices; vertex++) {
        const currentVertex = polygon[vertex];

        let distanceX = currentVertex[0] - baseVertexIdxX;
        let distanceY = currentVertex[1] - baseVertexIdxY;

        if (distanceX > halfWidth) distanceX -= width;
        else if (distanceX < -halfWidth) distanceX += width;

        if (distanceY > halfHeight) distanceY -= height;
        else if (distanceY < -halfHeight) distanceY += height;

        // Sum
        sumX += baseVertexIdxX + distanceX;
        sumY += baseVertexIdxY + distanceY;
      }

      let centerIdxX = (sumX / vertices) % width;
      let centerIdxY = (sumY / vertices) % height;

      if (centerIdxX < 0) centerIdxX += width;
      if (centerIdxY < 0) centerIdxY += height;

      idxXArray[sample] = centerIdxX;
      idxYArray[sample] = centerIdxY;
    }
  };

  /**
   * Gaussian Blue Noise
   * https://arxiv.org/pdf/2206.07798
   * https://dl.acm.org/doi/10.1145/3550454.3555519
   *
   * @see LOSSY
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} sigma
   */

  const _gaussianBlueNoiseWrapAroundInPlace = (idxXArray, idxYArray, width, height, sigma) => {
    const samples = idxXArray.length;

    const halfWidth = width * 0.5;
    const halfHeight = height * 0.5;

    if (_useAdaptiveSigmaCandidateAlgo) {
      sigma = Math.sqrt((width * height) / samples) * _initialSigmaScale;
    }

    const invSigma2 = 1 / (2 * sigma * sigma);

    for (let i = 0; i < samples; i++) {
      let gaussianDistanceX = 0;
      let gaussianDistanceY = 0;

      const iIdxX = idxXArray[i];
      const iIdxY = idxYArray[i];

      for (let j = 0; j < samples; j++) {
        if (i === j) continue;

        let distanceX = iIdxX - idxXArray[j];
        let distanceY = iIdxY - idxYArray[j];

        if (distanceX > halfWidth) distanceX -= width;
        else if (distanceX < -halfWidth) distanceX += width;

        if (distanceY > halfHeight) distanceY -= height;
        else if (distanceY < -halfHeight) distanceY += height;

        // Custom equation
        const kernelValue = Math.exp(
          -(distanceX * distanceX + distanceY * distanceY) * invSigma2
        );

        gaussianDistanceX += distanceX * kernelValue;
        gaussianDistanceY += distanceY * kernelValue;
      }

      idxXArray[i] = (iIdxX + gaussianDistanceX + width) % width;
      idxYArray[i] = (iIdxY + gaussianDistanceY + height) % height;
    }
  };

  // ----------------------------------------

  /**
   * Function for getting/generating Gaussian kernel with LUT
   *
   * @param {float} sigma
   * @returns {array}
   */

  const _getGaussianKernel = (sigma) => {
    const radius = Math.ceil(_gaussianSigmaRadiusMultiplier * sigma);
    const kernelSize = (radius << 1) + 1;
    const sqSz = kernelSize * kernelSize;
    const kernelArray = new Float64Array(sqSz);

    const invSigma2 = 1 / (2 * sigma * sigma);

    let sum = 0;
    for (let y = -radius; y < radius; y++) {
      const dbY = y * y;
      const yOffs = (y + radius) * kernelSize;

      for (let x = -radius; x < radius; x++) {
        const v = Math.exp(-(x * x + dbY) * invSigma2);
        if (v === 0) continue;

        kernelArray[yOffs + (x + radius)] = v;
        sum += v;
      }
    }

    for (let i = 0; i < sqSz; i++) kernelArray[i] /= sum;

    return kernelArray;
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

    extendedVoidAndClusterWrapAround: _extendedVoidAndClusterWrapAround,
    georgievFajardoWrapAroundInPlace: _georgievFajardoWrapAroundInPlace,

    directBinarySearchInPlace: _directBinarySearchInPlace,

    candidateMethodWrapAroundInPlace: _candidateMethodWrapAroundInPlace,
    adaptiveCandidateMethodWrapAroundInPlace: _adaptiveCandidateMethodWrapAroundInPlace,

    bestCandidateWrapAround: _bestCandidateWrapAround,
    mitchellBestCandidateWrapAround: _bestCandidateWrapAround,

    relaxationWrapAroundInPlace: _relaxationWrapAroundInPlace,
    lloydRelaxationWrapAroundInPlace: _relaxationWrapAroundInPlace,

    gaussianBlueNoiseWrapAroundInPlace: _gaussianBlueNoiseWrapAroundInPlace,

    getGaussianKernel: _getGaussianKernel,
  };
})();
