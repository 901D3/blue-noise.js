/**
 * Free JS implementation of Void and Cluster method by Robert Ulichney
 * Ultra optimized while keeping it readable
 * The result is high quality blue noise but somehow very fast
 * https://github.com/901D3/void-and-cluster.js
 *
 * Copyright (c) 901D3
 * This code is licensed with GPLv3 license
 */

"use strict";

var blueNoise = (function () {
  /**
   * Generate blue noise with void and cluster method
   *
   * @param {int} width output dimension
   * @param {int} height output dimension
   * @param {float} phase0Sigma sigma value for initializing binary pattern
   * @param {float} phase1Sigma
   * @param {float} phase2Sigma
   * @param {float} phase3Sigma
   * @param {int} phase0KernelRadius kernel value for initializing binary pattern
   * @param {int} phase1KernelRadius
   * @param {int} phase2KernelRadius
   * @param {int} phase3KernelRadius
   * @param {float} initArrayDensity
   * @param {array} initArray
   * @returns {array}
   */

  //Non squared dimension produces weird result so stick with squared dimension for now

  function _voidAndCluster(
    width,
    height,
    phase0Sigma,
    phase1Sigma,
    phase2Sigma,
    phase3Sigma,
    phase0KernelRadius,
    phase1KernelRadius,
    phase2KernelRadius,
    phase3KernelRadius,
    initArrayDensity,
    initArray
  ) {
    //safety checks
    if (width == null || height == null || initArrayDensity == null || phase0Sigma == null || phase0KernelRadius == null) {
      throw new Error("'width', 'height', 'phase0Sigma', 'phase0KernelRadius' and 'initArrayDensity' arguments is mandatory");
    }
    if (phase1Sigma == null) {
      console.info("phase1Sigma falled back to " + phase0Sigma);
      phase1Sigma = phase0Sigma;
    }
    if (phase2Sigma == null) {
      console.info("phase2Sigma falled back to " + phase0Sigma);
      phase2Sigma = phase0Sigma;
    }
    if (phase3Sigma == null) {
      console.info("phase3Sigma falled back to " + phase0Sigma);
      phase3Sigma = phase0Sigma;
    }
    if (phase1KernelRadius == null) {
      console.info("phase1KernelRadius falled back to " + phase0KernelRadius);
      phase1KernelRadius = phase0KernelRadius;
    }
    if (phase2KernelRadius == null) {
      console.info("phase2KernelRadius falled back to " + phase0KernelRadius);
      phase2KernelRadius = phase0KernelRadius;
    }
    if (phase3KernelRadius == null) {
      console.info("phase3KernelRadius falled back to " + phase0KernelRadius);
      phase3KernelRadius = phase0KernelRadius;
    }

    let t0 = performance.now();
    let t1 = performance.now();
    const sqSz = width * height;
    const halfSqSz = sqSz / 2;
    const filled1 = Math.floor(sqSz * initArrayDensity);
    const tempArray = new Float32Array(sqSz);
    for (let i = 0; i < sqSz; i++) {
      if (i < filled1) tempArray[i] = 1;
      else tempArray[i] = 0;
    }
    const shuffled = fisherYatesShuffle(tempArray);

    const rankArray = new Int32Array(sqSz);
    const binaryArray = new Uint8Array(sqSz);
    if (initArray && initArray.length === sqSz) {
      binaryArray.set(initArray);
    } else {
      console.warn("Inputed initial array dimension does not match " + width + "x" + height + ", default to randomizer");
      for (let i = 0; i < sqSz; i++) binaryArray[i] = shuffled[i];
    }
    console.log("Setup took " + (performance.now() - t1) + "ms");

    let kernel;
    let blurred = new Float32Array(sqSz);

    //Phase 0
    kernel = _getGaussianKernelLUT(phase0Sigma, phase0KernelRadius);

    //Load Binary Pattern with Input Pattern.
    _gaussianBlurWrap(binaryArray, width, height, kernel, phase0KernelRadius, blurred);

    while (true) {
      let clusterValue = 0;
      let voidValue = Infinity;
      let clusterIdx;
      let voidIdx;

      //Find location of tightest cluster. (All 1's are candidates.)
      for (let i = 0; i < sqSz; i++) {
        const blurredValue = blurred[i];
        if (binaryArray[i] === 1 && blurredValue > clusterValue) {
          clusterValue = blurredValue;
          clusterIdx = i;
        }
      }

      //Remove the "1" with the tightest cluster.
      binaryArray[clusterIdx] = 0;
      //Delta update blur array
      _deltaGaussianUpdate(width, height, clusterIdx, -1, blurred, kernel, phase0KernelRadius);

      //Find location of largest void. (All 0's are candidates.)
      for (let i = 0; i < sqSz; i++) {
        const blurredValue = blurred[i];
        if (binaryArray[i] === 0 && blurredValue < voidValue) {
          voidValue = blurredValue;
          voidIdx = i;
        }
      }

      //Did removing '1' create the largest void?
      if (voidIdx === clusterIdx) {
        binaryArray[clusterIdx] = 1;
        break; //yes
      }
      //no
      //Insert a "1" in largest void.
      binaryArray[voidIdx] = 1;
      _deltaGaussianUpdate(width, height, clusterIdx, 1, blurred, kernel);
    }
    console.log("Phase 0 took " + (performance.now() - t1) + "ms");

    //Phase 1
    t1 = performance.now();
    kernel = _getGaussianKernelLUT(phase1Sigma, phase1KernelRadius);
    for (let rank = 0; rank < filled1; rank++) {
      let value = 0;
      let idx;

      //Find location of tightest cluster in Binary Pattern.
      for (let j = 0; j < sqSz; j++) {
        const blurredValue = blurred[j];
        if (binaryArray[j] === 1 && blurredValue > value) {
          value = blurredValue;
          idx = j;
        }
      }

      //Remove "1" from tightest cluster in Binary Pattern.
      binaryArray[idx] = 0;
      rankArray[idx] = filled1 - rank;
      _deltaGaussianUpdate(width, height, idx, -1, blurred, kernel, phase1KernelRadius);
    }
    console.log("Phase 1 took " + (performance.now() - t1) + "ms");

    //Phase 2
    //We skip phase 2 if the initial binary array is filled
    t1 = performance.now();
    kernel = _getGaussianKernelLUT(phase2Sigma, phase2KernelRadius);
    _gaussianBlurWrap(shuffled, width, height, kernel, phase2KernelRadius, blurred);
    for (let rank = filled1; rank < halfSqSz; rank++) {
      let value = 0;
      let idx;

      //Find location of tightest cluster in Binary Pattern.
      for (let j = 0; j < sqSz; j++) {
        const blurredValue = blurred[j];
        if (shuffled[j] === 0 && blurredValue < value) {
          value = blurredValue;
          idx = j;
        }
      }

      //Remove "1" from tightest cluster in Binary Pattern.
      shuffled[idx] = 1;
      rankArray[idx] = rank;
      _deltaGaussianUpdate(width, height, idx, 1, blurred, kernel, phase2KernelRadius);
    }
    console.log("Phase 2 took " + (performance.now() - t1) + "ms");

    //Phase 3
    t1 = performance.now();
    if (filled1 !== sqSz) {
      for (let i = 0; i < sqSz; i++) binaryArray[i] = binaryArray[i] === 1 ? 0 : 1;
    } else {
      binaryArray.fill(0);
    }

    if (filled1 !== sqSz) {
      kernel = _getGaussianKernelLUT(phase3Sigma, phase3KernelRadius);
      _gaussianBlurWrap(binaryArray, width, height, kernel, phase3KernelRadius, blurred);
    } else {
      blurred = [0];
    }
    for (let rank = halfSqSz; rank < sqSz; rank++) {
      let value = Infinity;
      let idx;

      //Find location of largest void in Binary Pattern.
      for (let i = 0; i < sqSz; i++) {
        const blurredValue = blurred[i];
        if (binaryArray[i] === 0 && blurredValue > value) {
          value = blurredValue;
          idx = i;
        }
      }

      //Insert "1" in largest void in Binary Pattern
      binaryArray[idx] = 1;
      rankArray[idx] = rank;
      _deltaGaussianUpdate(width, height, idx, -1, blurred, kernel, phase3KernelRadius);
    }
    console.log("Phase 3 took " + (performance.now() - t1) + "ms\n" + "Total time: " + (performance.now() - t0) + "ms");

    return rankArray;
  }

  function fisherYatesShuffle(array) {
    let m = array.length,
      t,
      i;

    while (m) {
      i = Math.floor(random() * random() * m--);

      t = array[m];
      array[m] = array[i];
      array[i] = t;
    }

    return array;
  }

  /**
   * Simple function for getting Gaussian kernel + LUT
   *
   * @param {float} sigma
   * @param {int} radius
   * @returns {array}
   */

  const gaussianKernelLUT = new Map();

  function _getGaussianKernelLUT(sigma, radius) {
    const key = sigma + "," + radius;
    if (!gaussianKernelLUT.has(key)) {
      const kernelSize = 2 * radius + 1;
      const kernel = new Float32Array(kernelSize);
      let sum = 0;
      const denom = 2 * Math.pow(sigma, 2);

      for (let i = -radius; i <= radius; i++) {
        const val = Math.exp(-Math.pow(i, 2) / denom);
        kernel[i + radius] = val;
        sum += val;
      }

      for (let i = 0; i < kernelSize; i++) kernel[i] /= sum;

      gaussianKernelLUT.set(key, kernel);
    }

    return gaussianKernelLUT.get(key);
  }

  /**
   * Gaussian blurring with wrap around
   *
   * @param {array} inArray Input array that is going to go through blurring
   * @param {int} width
   * @param {int} height
   * @param {array} kernel Gaussian kernel, usually from _getGaussianKernelLUT()
   * @param {int} radius
   * @param {array} outArray Output array, parse an existing array to this arg and after blurring, the result is stored inside that existing array
   */

  function _gaussianBlurWrap(inArray, width, height, kernel, radius, outArray) {
    const tempArray = new Float32Array(inArray.length);

    for (let y = 0; y < height; y++) {
      const yOffs = y * width;
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          let xi = (x + k + width) % width;
          sum += inArray[yOffs + xi] * kernel[k + radius];
        }
        tempArray[yOffs + x] = sum;
      }
    }

    for (let y = 0; y < height; y++) {
      const yOffs = y * width;
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          let yi = (y + k + height) % height;
          sum += tempArray[yi * width + x] * kernel[k + radius];
        }
        outArray[yOffs + x] = sum;
      }
    }
  }

  /**
   * Gaussian delta updator
   * If we removed a pixel from the binary array then reblur it to get the reblurred,
   * it takes time so delta updator basically remove that "pixel" but in the blurred array
   *
   * @param {int} width
   * @param {int} height
   * @param {int} idx The index of the blurred array that is going to be added by <amount>
   * @param {float} amount
   * @param {array} blurredArray Blurred array input, also known as energy array
   * @param {array} kernel Gaussian kernel, usually from _getGaussianKernelLUT()
   * @param {int} radius
   */

  function _deltaGaussianUpdate(width, height, idx, amount, blurredArray, kernel, radius) {
    const iy = Math.floor(idx / width);
    const ix = idx % width;

    for (let dy = -radius; dy <= radius; dy++) {
      let y = (iy + dy + height) % height;
      const ky = kernel[dy + radius];

      for (let dx = -radius; dx <= radius; dx++) {
        let x = (ix + dx + width) % width;
        const kx = kernel[dx + radius];

        blurredArray[y * width + x] += kx * ky * amount;
      }
    }
  }

  return {
    voidAndCluster: _voidAndCluster,
    getGaussianKernelLUT: _getGaussianKernelLUT,
    gaussianBlurWrap: _gaussianBlurWrap,
    deltaGaussianUpdate: _deltaGaussianUpdate,
  };
})();

/*
//example

const width = 64;
const height = 64;
const result = blueNoise.voidAndCluster(width, height, 1.5, null, null, null, 6, null, null, null, 1, null);

const frame = ctx.getImageData(0, 0, width, height);
const imageData = frame.data;
const sqSz = width * height;
const sqSz4 = sqSz * 4;
const denom = (1 / findHighest(result)) * 255;

for (let i = 0; i < sqSz4; i += 4) imageData[i + 3] = 255;

for (let y = 0; y < blueNoiseHeight; y++) {
  const yOffs = y * blueNoiseWidth;
  for (let x = 0; x < blueNoiseWidth; x++) {
    let i = yOffs + x;
    const v = floor(result[i] * denom);
    i <<= 2;
    imageData[i] = v;
    imageData[i + 1] = v;
    imageData[i + 2] = v;
  }
}

ctx.putImageData(frame, 0, 0);
*/
