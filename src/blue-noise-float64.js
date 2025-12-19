/**
 * Free JS implementation of Void and Cluster method by Robert Ulichney and other methods
 * Remember to link blue-noise-utils.js
 *
 * v0.2.6.1
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
    const filled1 = (sqSz * density) | 0;
    // Fill binArray from 0 to filled1 with 1, but it is yet to be shuffled
    for (let i = 0; i < filled1; i++) binArray[i] = 1;

    // Now shuffle it, this act like seeding
    BlueNoiseUtils.shuffle(binArray);

    _candidateMethodWrapAroundInPlace(binArray, width, height, sigma);

    // Phase 1
    // blur binArray
    BlueNoiseUtils.convolveWrapAroundInPlace(
      binArray,
      width,
      height,
      blurredArray,
      kernelArray,
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
      BlueNoiseUtils.convolveDeltaUpdateWrapAroundInPlace(
        width,
        height,
        idx,
        -1,
        blurredTempArray,
        kernelArray,
        kernelSize,
        kernelSize
      );
    }
    // End of Phase 1

    // Phase 2
    BlueNoiseUtils.convolveWrapAroundInPlace(
      binArray,
      width,
      height,
      blurredArray,
      kernelArray,
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

      BlueNoiseUtils.convolveDeltaUpdateWrapAroundInPlace(
        width,
        height,
        idx,
        1,
        blurredArray,
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
      width,
      height,
      blurredArray,
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

      BlueNoiseUtils.convolveDeltaUpdateWrapAroundInPlace(
        width,
        height,
        idx,
        -1,
        blurredArray,
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
   * @param {*} customKernelArray
   * @param {*} candidateMethodSigma
   * @param {*} density
   * @returns
   */

  const _extendedVoidAndClusterWrapAround = (
    width,
    height,
    sigma,
    candidateMethodSigma,
    density,
    customKernelArray
  ) => {
    // Safety checks
    if (width == null) throw new Error("'width' arguments is mandatory");
    if (height == null) throw new Error("'height' arguments is mandatory");
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      throw new Error("'width' and 'height' must be integers");
    }

    const kernelArrayCheck = customKernelArray != null && Array.isArray(customKernelArray);
    if (!kernelArrayCheck && sigma == null) {
      throw new Error(
        "kernelArrayCheck is " + kernelArrayCheck + ". 'sigma' arguments is mandatory"
      );
    }

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

    const sqSz = width * height;

    const binArray = new Uint8Array(sqSz);
    const rankArray = new Uint32Array(sqSz);
    const blurredArray = new Float64Array(sqSz);

    const filled1 = (sqSz * density) | 0;
    const sampleIndexesArray = new Uint32Array(filled1);

    if (density !== 0 && density !== 1) {
      for (let i = 0; i < filled1; i++) binArray[i] = 1;

      BlueNoiseUtils.shuffle(binArray);

      // Do Ulichney's Candidate Algorithm taken from VACluster
      // If using adaptive sigma (overwrite all other options)
      if (_useAdaptiveSigmaCandidateAlgo) {
        _adaptiveCandidateMethodWrapAroundInPlace(binArray, width, height, _initialSigmaScale);
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
    } else if (density === 1) binArray.fill(1);

    // Phase 1
    // Blur once
    BlueNoiseUtils.convolveWrapAroundInPlace(
      binArray,
      width,
      height,
      blurredArray,
      kernelArray,
      kernelWidth,
      kernelHeight
    );

    // Evenly distributed dots blurred, ~for phase 2 tie-breaker~
    const blurredTemp = blurredArray.slice();

    for (let rank = filled1 - 1; rank >= 0; rank--) {
      let idx;
      let value = -Infinity;
      //let valueTemp = -Infinity;

      for (let i = 0; i < filled1; i++) {
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

      BlueNoiseUtils.convolveDeltaUpdateWrapAroundInPlace(
        width,
        height,
        idx,
        -1,
        blurredArray,
        kernelArray,
        kernelWidth,
        kernelHeight
      );
    }
    // End of Phase 1

    // Phase 2
    blurredArray.set(blurredTemp);
    for (let i = 0; i < filled1; i++) binArray[sampleIndexesArray[i]] = 1;

    for (let rank = filled1; rank < sqSz; rank++) {
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

      BlueNoiseUtils.convolveDeltaUpdateWrapAroundInPlace(
        width,
        height,
        idx,
        1,
        blurredArray,
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
   * https://www.iliyan.com/publications/DitheredSampling/DitheredSampling_Sig2016.pdf
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
    if (inArray == null) throw new Error("Inputted array is null");
    if (!ArrayBuffer.isView(inArray)) throw new Error("Inputted array is not an ArrayBuffer");

    const sqSz = width * height;

    const kernelArrayCheck = customKernelArray != null && Array.isArray(customKernelArray);
    if (!kernelArrayCheck && sigmaImage == null) {
      throw new Error(
        "kernelArrayCheck is " + kernelArrayCheck + ". 'sigmaImage' arguments is mandatory"
      );
    }

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
    const energyMapArray = new Float64Array(sqSz);
    for (let i = 0; i < sqSz; i++) {
      energyMapArray[i] = BlueNoiseUtils.computeEnergyGeorgevFajardoWrapAround(
        inArray,
        width,
        height,
        i,
        sigmaSample,
        pNorm,
        kernelArray,
        kernelWidth,
        kernelHeight
      );
    }

    for (let iter = 0; iter < iterations; iter++) {
      // Random index
      const p_i = (Math.random() * sqSz) | 0;
      // q_i = 0

      // Swap pixels
      const tmp = inArray[p_i];
      inArray[p_i] = inArray[0];
      inArray[0] = tmp;

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
        0,
        sigmaSample,
        pNorm,
        kernelArray,
        kernelWidth,
        kernelHeight
      );

      // If the new swapped pixels energy is bigger than before, accept it
      if (newEnergy1 + newEnergy2 < energy[p_i] + energy[0]) {
        energyMapArray[p_i] = newEnergy1;
        energyMapArray[0] = newEnergy2;
      } else {
        const tmp = inArray[p_i];
        inArray[p_i] = inArray[0];
        inArray[0] = tmp;
      }
    }
  };

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
    if (inArray == null) throw new Error("Inputted array is null");
    if (ditheredArray == null) throw new Error("Inputted dithered array is null");
    if (!ArrayBuffer.isView(inArray)) throw new Error("Inputted array is not an ArrayBuffer");
    if (!ArrayBuffer.isView(ditheredArray))
      throw new Error("Inputted dithered array is not an ArrayBuffer");

    const sqSz = width * height;

    const kernelArrayCheck = customKernelArray != null && Array.isArray(customKernelArray);
    if (!kernelArrayCheck && sigma == null) {
      throw new Error(
        "kernelArrayCheck is " + kernelArrayCheck + ". 'sigma' arguments is mandatory"
      );
    }

    if (sigma === 0) throw new Error("Divide by 0");

    if (!ArrayBuffer.isView(customIndexesArray)) {
      throw new Error("Indexes array is not an ArrayBuffer");
    }

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
      width,
      height,
      blurredArray,
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

        BlueNoiseUtils.convolveDeltaUpdateInPlace(
          width,
          height,
          idx,
          deltaError,
          blurredArray,
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

          BlueNoiseUtils.convolveDeltaUpdateInPlace(
            width,
            height,
            idx,
            -deltaError,
            blurredArray,
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
    if (inArray == null) throw new Error("Inputted array is null");
    if (ditheredArray == null) throw new Error("Inputted dithered array is null");
    if (!ArrayBuffer.isView(inArray)) throw new Error("Inputted array is not an ArrayBuffer");
    if (!ArrayBuffer.isView(ditheredArray))
      throw new Error("Inputted dithered array is not an ArrayBuffer");

    const sqSz = width * height;

    const kernelArrayCheck = customKernelArray != null && Array.isArray(customKernelArray);
    if (!kernelArrayCheck && sigma == null) {
      throw new Error(
        "kernelArrayCheck is " + kernelArrayCheck + ". 'sigma' arguments is mandatory"
      );
    }

    if (sigma === 0) throw new Error("Divide by 0");

    if (!ArrayBuffer.isView(customIndexesArray)) {
      throw new Error("Indexes array is not an ArrayBuffer");
    }

    let kernelArray = _getGaussianKernel(sigma);
    let kernelWidth = (Math.ceil(_gaussianSigmaRadiusMultiplier * sigma) << 1) + 1;
    let kernelHeight = kernelWidth;

    if (kernelArrayCheck) {
      kernelHeight = customKernelArray.length;
      kernelWidth = customKernelArray[0].length;
      kernelArray = new Float64Array(customKernelArray.flat());
    }

    const kernelSqSz = kernelWidth * kernelHeight;

    let kernelEnergy = 0;
    for (let i = 0; i < kernelSqSz; i++) kernelEnergy += kernelArray[i] ** 2;

    const errorArray = new Float64Array(sqSz);
    for (let i = 0; i < sqSz; i++) {
      errorArray[i] = inArray[i] / 255 - ditheredArray[i];
    }

    const blurredArray = new Float64Array(sqSz);

    BlueNoiseUtils.convolveInPlace(
      errorArray,
      width,
      height,
      blurredArray,
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

        BlueNoiseUtils.convolveDeltaUpdateInPlace(
          width,
          height,
          idx,
          deltaError,
          blurredArray,
          kernelArray,
          kernelWidth,
          kernelHeight
        );
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
   * @param {*} customKernelArray
   */

  const _candidateMethodWrapAroundInPlace = (
    inArray,
    width,
    height,
    sigma,
    customKernelArray
  ) => {
    if (inArray == null) throw new Error("Inputted array is null");
    if (!ArrayBuffer.isView(inArray)) throw new Error("Inputted array is not an ArrayBuffer");
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      throw new Error("'width' and 'height' must be integers");
    }

    const kernelArrayCheck = customKernelArray != null && Array.isArray(customKernelArray);
    if (!kernelArrayCheck && sigma == null) {
      throw new Error(
        "kernelArrayCheck is " + kernelArrayCheck + ". 'sigma' arguments is mandatory"
      );
    }

    if (sigma === 0) throw new Error("Divide by 0");

    const sqSz = width * height;
    let filled1 = 0;

    for (let i = 0; i < sqSz; i++) {
      if (inArray[i] === 1) filled1++;
    }

    if (filled1 === 0) {
      console.warn("Inputted array have no sample");
      return;
    } else if (filled1 === sqSz) {
      console.warn("Inputted array is full");
      return;
    }

    const sampleIndexesArray = new Uint32Array(filled1);

    for (let i = 0, idx = 0; i < sqSz; i++) {
      if (inArray[i] === 1) sampleIndexesArray[idx++] = i;
    }

    const blurredArray = new Float64Array(sqSz);

    let kernelArray = _getGaussianKernel(sigma);
    let kernelWidth = (Math.ceil(_gaussianSigmaRadiusMultiplier * sigma) << 1) + 1;
    let kernelHeight = kernelWidth;

    if (kernelArrayCheck) {
      kernelHeight = customKernelArray.length;
      kernelWidth = customKernelArray[0].length;
      kernelArray = new Float64Array(customKernelArray.flat());
    }

    BlueNoiseUtils.convolveWrapAroundInPlace(
      inArray,
      width,
      height,
      blurredArray,
      kernelArray,
      kernelWidth,
      kernelHeight
    );

    while (true) {
      let clusterValue = -Infinity;
      let voidValue = Infinity;
      let clusterIdx;
      let voidIdx;

      let sampleIndexesArrayArrayIdx;

      for (let i = 0; i < filled1; i++) {
        const idx = sampleIndexesArray[i];
        const blurredValue = blurredArray[idx];

        if (blurredValue > clusterValue) {
          clusterValue = blurredValue;
          clusterIdx = idx;
          sampleIndexesArrayArrayIdx = i;
        }
      }

      inArray[clusterIdx] = 0;
      sampleIndexesArray[sampleIndexesArrayArrayIdx] = clusterIdx;

      BlueNoiseUtils.convolveDeltaUpdateWrapAroundInPlace(
        width,
        height,
        clusterIdx,
        -1,
        blurredArray,
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

      BlueNoiseUtils.convolveDeltaUpdateWrapAroundInPlace(
        width,
        height,
        voidIdx,
        1,
        blurredArray,
        kernelArray,
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

  const _adaptiveCandidateMethodWrapAroundInPlace = (inArray, width, height) => {
    if (inArray == null) throw new Error("Inputted array is null");
    if (!ArrayBuffer.isView(inArray)) throw new Error("Inputted array is not an ArrayBuffer");

    const sqSz = width * height;
    let filled1 = 0;

    for (let i = 0; i < sqSz; i++) {
      if (inArray[i] === 1) filled1++;
    }

    _candidateMethodWrapAroundInPlace(
      inArray,
      width,
      height,
      Math.sqrt(sqSz / Math.abs(filled1 > sqSz * 0.5 ? sqSz - filled1 : filled1)) *
        _initialSigmaScale
    );
  };

  /**
   * https://bartwronski.com/2022/08/31/progressive-image-stippling-and-greedy-blue-noise-importance-sampling
   *
   * @param {*} idx
   * @param {*} width
   * @param {*} height
   * @param {*} sigma
   * @param {*} density
   * @param {*} customKernelArray
   * @returns
   */

  const _wronskiCandidateMethodWrapAround = (
    idx,
    width,
    height,
    sigma,
    density = 0.1,
    customKernelArray
  ) => {
    if (idx == null) throw new Error("Inputted index is null");
    if (idx < 0) throw new Error("Inputted index is less than 0");

    const sqSz = width * height;
    if (idx >= sqSz) throw new Error("Inputted index is bigger than " + sqSz);

    const kernelArrayCheck = customKernelArray != null && Array.isArray(customKernelArray);
    if (!kernelArrayCheck && sigma == null) {
      throw new Error(
        "kernelArrayCheck is " + kernelArrayCheck + ". 'sigma' arguments is mandatory"
      );
    }

    if (sigma === 0) throw new Error("Divide by 0");

    const binArray = new Uint8Array(sqSz);
    binArray[idx] = 1;
    const blurredArray = new Float64Array(sqSz);

    let kernelArray = _getGaussianKernel(sigma);
    let kernelWidth = (Math.ceil(_gaussianSigmaRadiusMultiplier * sigma) << 1) + 1;
    let kernelHeight = kernelWidth;

    if (kernelArrayCheck) {
      kernelHeight = customKernelArray.length;
      kernelWidth = customKernelArray[0].length;
      kernelArray = new Float64Array(customKernelArray.flat());
    }

    BlueNoiseUtils.convolveWrapAroundInPlace(
      binArray,
      width,
      height,
      blurredArray,
      kernelArray,
      kernelWidth,
      kernelHeight
    );

    const filled1 = sqSz * density;

    for (let rank = 0; rank < filled1; rank++) {
      let value = Infinity;
      let idx;

      for (let i = 0; i < sqSz; i++) {
        const blurredValue = blurredArray[i];

        if (blurredValue < value) {
          value = blurredValue;
          idx = i;
        }
      }

      binArray[idx] = 1;

      BlueNoiseUtils.convolveDeltaUpdateWrapAroundInPlace(
        width,
        height,
        idx,
        1,
        blurredArray,
        kernelArray,
        kernelWidth,
        kernelHeight
      );
    }

    return binArray;
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
    const sqSz = width * height;
    const filled1 = idxXArray.length;

    const halfWidth = width * 0.5;
    const halfHeight = height * 0.5;

    const samplesSumXArray = new Float64Array(filled1);
    const samplesSumYArray = new Float64Array(filled1);
    const samplesCountArray = new Uint32Array(filled1);

    for (let i = 0; i < sqSz; i++) {
      let idxX = i % width;
      let idxY = (i / width) | 0;

      let minDistance = Infinity;
      let nearestSampleIdx = 0;

      for (let sample = 0; sample < filled1; sample++) {
        let distanceX = idxX - idxXArray[sample];
        let distanceY = idxY - idxYArray[sample];

        if (distanceX < 0) distanceX = -distanceX;
        else if (distanceX > halfWidth) distanceX = width - distanceX;

        if (distanceY < 0) distanceY = -distanceY;
        else if (distanceY > halfHeight) distanceY = height - distanceY;

        const distance = distanceX * distanceX + distanceY * distanceY;

        if (distance < minDistance) {
          minDistance = distance;
          nearestSampleIdx = sample;
        }
      }

      idxX -= idxXArray[nearestSampleIdx];
      idxY -= idxYArray[nearestSampleIdx];

      if (idxX > halfWidth) idxX -= width;
      else if (idxX < -halfWidth) idxX += width;

      if (idxY > halfHeight) idxY -= height;
      else if (idxY < -halfHeight) idxY += height;

      samplesSumXArray[nearestSampleIdx] += idxX;
      samplesSumYArray[nearestSampleIdx] += idxY;
      samplesCountArray[nearestSampleIdx]++;
    }

    for (let i = 0; i < filled1; i++) {
      const currentSampleZoneGridCount = samplesCountArray[i];

      let idxX = (samplesSumXArray[i] / currentSampleZoneGridCount + idxXArray[i]) % width;
      let idxY = (samplesSumYArray[i] / currentSampleZoneGridCount + idxYArray[i]) % height;

      if (idxX < 0) idxX += width;
      if (idxY < 0) idxY += height;

      idxXArray[i] = idxX;
      idxYArray[i] = idxY;
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
    const filled1 = idxXArray.length;

    const halfWidth = width * 0.5;
    const halfHeight = height * 0.5;

    if (_useAdaptiveSigmaCandidateAlgo) {
      sigma = Math.sqrt((width * height) / filled1) * _initialSigmaScale;
    }

    const invSigma2 = 1 / (2 * sigma * sigma);

    for (let i = 0; i < filled1; i++) {
      let gaussianDistanceX = 0;
      let gaussianDistanceY = 0;

      const iIdxX = idxXArray[i];
      const iIdxY = idxYArray[i];

      for (let j = 0; j < filled1; j++) {
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

      let idxX = (iIdxX + gaussianDistanceX) % width;
      let idxY = (iIdxY + gaussianDistanceY) % height;

      if (idxX < 0) idxX += width;
      if (idxY < 0) idxY += height;

      idxXArray[i] = idxX;
      idxYArray[i] = idxY;
    }
  };

  /**
   * Function for getting/generating Gaussian kernelArray with LUT
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
    wronskiCandidateMethodWrapAround: _wronskiCandidateMethodWrapAround,

    bestCandidateWrapAround: _bestCandidateWrapAround,
    mitchellBestCandidateWrapAround: _bestCandidateWrapAround,

    relaxationWrapAroundInPlace: _relaxationWrapAroundInPlace,
    lloydRelaxationWrapAroundInPlace: _relaxationWrapAroundInPlace,

    gaussianBlueNoiseWrapAroundInPlace: _gaussianBlueNoiseWrapAroundInPlace,

    getGaussianKernel: _getGaussianKernel,
  };
})();
