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

var blueNoise = (function () {
  //Helpers
  function _poissonDiskSampling(width, height, radiusX, radiusY, k = 30) {
    const points = [];
    const active = [];
    const twoPI = 2 * Math.PI;
    const binArray = new Uint8Array(width * height);

    function isValid(p) {
      const pointLength = points.length;
      for (let i = 0; i < pointLength; i++) {
        const {x: pointX, y: pointY} = points[i];
        const {x, y} = p;
        let dx = Math.abs(pointX - x);
        let dy = Math.abs(pointY - y);
        dx = Math.min(dx, width - dx);
        dy = Math.min(dy, height - dy);
        if (dx < radiusX && dy < radiusY) return false;
      }
      return true;
    }

    const initial = {x: Math.random() * width, y: Math.random() * height};
    points.push(initial);
    active.push(initial);

    while (active.length > 0) {
      const idx = Math.floor(Math.random() * active.length);
      const {x: centerX, y: centerY} = active[idx];
      let found = false;

      for (let i = 0; i < k; i++) {
        const angle = Math.random() * twoPI;
        const rX = Math.cos(angle) * radiusX * (1 + Math.random());
        const rY = Math.sin(angle) * radiusY * (1 + Math.random());
        const candidate = {
          x: centerX + rX,
          y: centerY + rY,
        };

        if (candidate.x >= 0 && candidate.x < width && candidate.y >= 0 && candidate.y < height && isValid(candidate)) {
          points.push(candidate);
          active.push(candidate);
          found = true;
          break;
        }
      }

      if (!found) active.splice(idx, 1);
    }

    const pointsLength = points.length;
    for (let i = 0; i < pointsLength; i++) {
      binArray[Math.round(points[i].y) * width + Math.round(points[i].x)] = 1;
    }

    return binArray;
  }

  function _noiseArray(width, height, threshold) {
    const sqSz = width * height;
    const array = new Uint8Array(sqSz);
    for (let i = 0; i < sqSz; i++) {
      array[i] = Math.random() > threshold ? 1 : 0;
    }

    return array;
  }

  function _gaussianRadiusCheck(width, height, sigma, radius) {
    const kernelRadius = Math.ceil(3 * sigma);
    const minDimension = Math.min(width, height);
    if (kernelRadius > Math.min(width, height)) {
      console.warn("Kernel radius value " + kernelRadius + " clamped to " + minDimension);
      return minDimension;
    }

    if (radius > Math.ceil(3 * sigma)) return Math.ceil(3 * sigma);
  }

  /**
   * Generate blue noise with void and cluster method, initial binary array using Poisson Disk Sampling
   *
   * @param {int} width - Output array "width"
   * @param {int} height - Output array "height"
   * @param {float} phase1Sigma - Phase 1 sigma value
   * @param {float} phase2Sigma - Phase 2 sigma value
   * @param {float} phase3Sigma - Phase 3 sigma value
   * @param {int} phase1KernelRadiusCap - Phase 1 Gaussian kernel size capping
   * @param {int} phase2KernelRadiusCap - Phase 2 Gaussian kernel size capping
   * @param {int} phase3KernelRadiusCap - Phase 3 Gaussian kernel size capping
   * @param {int} candidateFillingRatio - Phase 3 Gaussian kernel size capping
   * @param {array} initArray - Initial array, it act like user inputted seed, must have the same length as (<width> * <height>), array dimension doesn't matter
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
    phase1KernelRadiusCap,
    phase2KernelRadiusCap,
    phase3KernelRadiusCap,
    candidateFillingRatio,
    initArray
  ) {
    //safety checks
    if (
      width == null ||
      height == null ||
      PDSRadiusX == null ||
      PDSRadiusY == null ||
      phase1SigmaStart == null ||
      phase1KernelRadiusCap == null
    ) {
      throw new Error(
        "'width', 'height', 'PDSRadiusX', 'PDSRadiusY', 'phase1Sigmaphase1SigmaStart' and 'phase1KernelRadiusCap' arguments is mandatory"
      );
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
    if (phase2KernelRadiusCap == null) {
      console.warn("phase2KernelRadiusCap falled back to " + phase1KernelRadiusCap);
      phase2KernelRadiusCap = phase1KernelRadiusCap;
    }
    if (phase3KernelRadiusCap == null) {
      console.warn("phase3KernelRadiusCap falled back to " + phase1KernelRadiusCap);
      phase3KernelRadiusCap = phase1KernelRadiusCap;
    }
    if (candidateFillingRatio == null) {
      console.warn("candidateFillingRatio falled back to " + 0.5);
      candidateFillingRatio = 0.5;
    }

    phase1KernelRadiusCap = _gaussianRadiusCheck(width, height, phase1SigmaStart, phase1KernelRadiusCap);
    phase2KernelRadiusCap = _gaussianRadiusCheck(width, height, phase2SigmaStart, phase2KernelRadiusCap);
    phase3KernelRadiusCap = _gaussianRadiusCheck(width, height, phase3SigmaStart, phase3KernelRadiusCap);

    let t0 = performance.now();
    let t1 = performance.now();
    const sqSz = width * height;
    let rank = 0;

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
      binArray.set(_poissonDiskSampling(width, height, PDSRadiusX, PDSRadiusY, PDSKValue));
    }

    const filled1 = binArray.reduce((sum, v) => sum + v, 0);
    candidateFillingRatio = Math.min(Math.max(candidateFillingRatio, 0), 1);
    candidateFillingRatio = filled1 + Math.floor(candidateFillingRatio * (sqSz - filled1));

    console.info("Number of initial placed points: " + filled1);
    console.info("Candidate filling ratio: " + candidateFillingRatio);

    //Gaussian blurring stuff
    let kernel = _getGaussianKernelLUT(phase1SigmaStart, phase1KernelRadiusCap);
    _blurWrap(binArray, width, height, kernel, phase1KernelRadiusCap, blurred);

    console.log("Setup took " + (performance.now() - t1) + "ms");

    //Phase 1
    t1 = performance.now();
    //Temporary binArray, original binArray is left unchanged after phase 1
    const temp = binArray.slice();
    for (rank = 0; rank < filled1; rank++) {
      let value = -Infinity;
      let idx;

      //Find location of tightest cluster in Binary Pattern.
      //Greedy version only take the last index of highest value if there are multiple highest value that they are equally the same
      //This version is not greedy anymore
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
      kernel = _getGaussianKernelLUT(
        phase1SigmaStart + (phase1SigmaEnd - phase1SigmaStart) * (rank / sqSz),
        phase1KernelRadiusCap
      );
      _deltaGaussianUpdate(width, height, idx, -1, blurred, kernel, phase1KernelRadiusCap);
    }
    console.log("Phase 1 took " + (performance.now() - t1) + "ms");

    //Phase 2
    t1 = performance.now();
    kernel = _getGaussianKernelLUT(phase2SigmaStart, phase2KernelRadiusCap);
    _blurWrap(binArray, width, height, kernel, phase2KernelRadiusCap, blurred);

    //Keep phase 2 greedy
    for (rank = filled1; rank < candidateFillingRatio; rank++) {
      let value = Infinity;
      let idx;

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

      //Remove "1" from tightest cluster in Binary Pattern.
      binArray[idx] = 1;
      rankArray[idx] = rank; //Number of 1s left in the binArray
      kernel = _getGaussianKernelLUT(
        phase2SigmaStart + (phase2SigmaEnd - phase2SigmaStart) * (rank / sqSz),
        phase2KernelRadiusCap
      );
      _deltaGaussianUpdate(width, height, idx, 1, blurred, kernel, phase2KernelRadiusCap);
    }
    console.log("Phase 2 took " + (performance.now() - t1) + "ms");

    //Phase 3
    t1 = performance.now();
    //Copy binary array to temp and invert it, 0 becomes 1 and vice versa
    for (let i = 0; i < sqSz; i++) temp[i] = 1 - binArray[i];

    kernel = _getGaussianKernelLUT(phase3SigmaStart, phase3KernelRadiusCap);
    //Blur the temp array, so we use binArray[idx] === 0
    _blurWrap(temp, width, height, kernel, phase3KernelRadiusCap, blurred);
    //Fills in the remaining "0s" in binArray so rankArray is complete blue noise without any voids
    for (rank = candidateFillingRatio; rank < sqSz; rank++) {
      let value = -Infinity;
      let idx;

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
      kernel = _getGaussianKernelLUT(
        phase3SigmaStart + (phase3SigmaEnd - phase3SigmaStart) * (rank / sqSz),
        phase3KernelRadiusCap
      );
      _deltaGaussianUpdate(width, height, idx, -1, blurred, kernel, phase3KernelRadiusCap);
    }
    console.log("Phase 3 took " + (performance.now() - t1) + "ms\n" + "Total time: " + (performance.now() - t0) + "ms");

    return rankArray;
  }

  function _candidateAlgo(inArray, width, sigma, kernelRadiusCap) {
    const height = Math.ceil(inArray.length / width);
    const sqSz = width * height;
    const blurred = new Float32Array(sqSz);
    const rankArray = new Uint32Array(sqSz);
    const filled1 = inArray.reduce((sum, v) => sum + v, 0);

    kernelRadiusCap = _gaussianRadiusCheck(width, height, sigma, kernelRadiusCap);
    const kernel = _getGaussianKernelLUT(sigma, kernelRadiusCap);
    _blurWrap(inArray, width, height, kernel, kernelRadiusCap, blurred);
    let rank = 0;
    while (rank < filled1) {
      let value = -Infinity;
      let idx = [];

      for (let j = 0; j < sqSz; j++) {
        if (inArray[j] === 1) {
          const blurredValue = blurred[j];
          if (blurredValue > value) {
            value = blurredValue;
            idx = [j];
          } else if (blurredValue === value) {
            idx.push(j);
          }
        }
      }

      const idxLength = idx.length;
      for (let i = 0; i < idxLength; i++) {
        const index = idx[i];
        inArray[index] = 0;
        rankArray[index] = rank;
        _deltaGaussianUpdate(width, height, index, -1, blurred, kernel, kernelRadiusCap);
        rank++;
      }
      console.log(rank);
    }

    return rankArray;
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
    if (radius > Math.ceil(3 * sigma)) radius = Math.ceil(3 * sigma);
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
   * @param {array} inArray - Input array that is going to go through blurring
   * @param {int} width
   * @param {int} height
   * @param {array} kernel - Gaussian kernel, usually from _getGaussianKernelLUT()
   * @param {int} radius
   * @param {array} outArray - Output array, parse an existing array to this arg and after blurring, the result is stored inside that existing array
   */

  function _blurWrap(inArray, width, height, kernel, radius, outArray) {
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
    candidateAlgo: _candidateAlgo,
    poissonDiskSampling: _poissonDiskSampling,
    noiseArray: _noiseArray,
    gaussianRadiusCheck: _gaussianRadiusCheck,
    getGaussianKernelLUT: _getGaussianKernelLUT,
    blurWrap: _blurWrap,
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
