
/**
 * Generate blue noise with void and cluster method
 *
 * @param {int} width output dimension
 * @param {int} height output dimension
 * @param {float*} phase0Sigma sigma value for initializing binary pattern
 * @param {float} [phase0ReblurSigma]
 * @param {float} [phase1Sigma]
 * @param {float} [phase2Sigma]
 * @param {float} [phase3Sigma]
 * @param {int} phase0KernelRadius kernel value for initializing binary pattern
 * @param {int} [phase0ReblurKernelRadius]
 * @param {int} [phase1KernelRadius]
 * @param {int} [phase2KernelRadius]
 * @param {int} [phase3KernelRadius]
 * @param {float} initArrayDensity
 * @param {array} [initArray]
 * @returns {array}
 */

function blueNoise(
  width,
  height,
  phase0Sigma,
  phase0ReblurSigma,
  phase1Sigma,
  phase2Sigma,
  phase3Sigma,
  phase0KernelRadius,
  phase0ReblurKernelRadius,
  phase1KernelRadius,
  phase2KernelRadius,
  phase3KernelRadius,
  initArrayDensity,
  initArray
) {
  if (width == null || height == null || initArrayDensity == null || phase0Sigma == null || phase0KernelRadius == null) {
    return false;
  }
  if (phase0ReblurSigma == null) phase0ReblurSigma = phase0Sigma;
  if (phase1Sigma == null) phase2Sigma = phase0Sigma;
  if (phase2Sigma == null) phase2Sigma = phase0Sigma;
  if (phase3Sigma == null) phase3Sigma = phase0Sigma;
  if (phase0ReblurKernelRadius == null) phase0ReblurKernelRadius = phase0KernelRadius;
  if (phase1KernelRadius == null) phase1KernelRadius = phase0KernelRadius;
  if (phase2KernelRadius == null) phase2KernelRadius = phase0KernelRadius;
  if (phase3KernelRadius == null) phase3KernelRadius = phase0KernelRadius;

  let t0 = performance.now();
  let t1 = performance.now();
  const sqSz = width * height;
  const halfSqSz = sqSz * 0.5;
  const filled1 = floor(sqSz * initArrayDensity);
  const unshuffled = new Float32Array(sqSz);
  const prototypeBinArray = shuffle(unshuffled);
  for (let i = 0; i < sqSz; i++) {
    if (i < filled1) unshuffled[i] = 1;
    else unshuffled[i] = 0;
  }

  const rankArray = new Int32Array(sqSz);
  const binaryArray = new Uint8Array(sqSz);
  if (initArray && initArray.length === sqSz) {
    binaryArray.set(initArray);
  } else {
    console.warn("Inputed initial array dimension does not match " + width + "x" + height + ", default to randomizer");
    for (let i = 0; i < sqSz; i++) binaryArray[i] = prototypeBinArray[i];
  }
  console.log("Setup took " + (performance.now() - t1) + "ms");

  //Phase 0
  //Load Binary Pattern with Input Pattern.
  let blurred = gaussianBlurWrap(binaryArray, width, height, phase0Sigma, phase0KernelRadius);
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
    //Update blur array
    blurred = gaussianBlurWrap(binaryArray, width, height, phase0ReblurSigma, phase0ReblurKernelRadius);

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
    blurred = gaussianBlurWrap(binaryArray, width, height, phase0Sigma, phase0KernelRadius);
  }
  console.log("Phase 0 took " + (performance.now() - t1) + "ms");

  //Phase 1
  t1 = performance.now();
  blurred = gaussianBlurWrap(binaryArray, width, height, phase2Sigma, phase2KernelRadius);
  for (let rank = 0; rank < filled1; rank++) {
    let value = 0;
    let idx;

    //Find location of tightest cluster in Binary Pattern.
    for (let j = 0; j < sqSz; j++) {
      if (binaryArray[j] === 1) {
        const blurredValue = blurred[j];
        if (blurredValue > value) {
          value = blurredValue;
          idx = j;
        }
      }
    }

    //Remove "1" from tightest cluster in Binary Pattern.
    binaryArray[idx] = 0;
    rankArray[idx] = filled1 - rank;
    blurred = gaussianBlurWrap(binaryArray, width, height, phase2Sigma, phase2KernelRadius);
  }
  console.log("Phase 1 took " + (performance.now() - t1) + "ms");

  //Phase 2
  t1 = performance.now();
  blurred = gaussianBlurWrap(prototypeBinArray, width, height, phase2Sigma, phase2KernelRadius);
  for (let rank = filled1; rank < halfSqSz; rank++) {
    let value = 0;
    let idx;

    //Find location of tightest cluster in Binary Pattern.
    for (let j = 0; j < sqSz; j++) {
      if (prototypeBinArray[j] === 0) {
        const blurredValue = blurred[j];
        if (blurredValue < value) {
          value = blurredValue;
          idx = j;
        }
      }
    }

    //Remove "1" from tightest cluster in Binary Pattern.
    prototypeBinArray[idx] = 1;
    rankArray[idx] = rank;
    blurred = gaussianBlurWrap(prototypeBinArray, width, height, phase2Sigma, phase2KernelRadius);
  }
  console.log("Phase 2 took " + (performance.now() - t1) + "ms");

  //Phase 3
  t1 = performance.now();
  for (let i = 0; i < sqSz; i++) binaryArray[i] = binaryArray[i] === 1 ? 0 : 1;

  for (let rank = halfSqSz; rank < sqSz; rank++) {
    let value = Infinity;
    let idx;

    blurred = gaussianBlurWrap(binaryArray, width, height, phase3Sigma, phase3KernelRadius);

    //Find location of largest void in Binary Pattern.
    for (let i = 0; i < sqSz; i++) {
      if (binaryArray[i] === 0) {
        const blurredValue = blurred[i];
        if (blurredValue > value) {
          value = blurredValue;
          idx = i;
        }
      }
    }

    //Insert "1" in largest void in Binary Pattern
    binaryArray[idx] = 1;
    rankArray[idx] = rank;
  }
  console.log("Phase 3 took " + (performance.now() - t1) + "ms\n" + "Total time: " + (performance.now() - t0) + "ms");
  return rankArray;
}

function gaussianBlurWrap(inArray, width, height, sigma = 1.5, radius = 3) {
  const out = new Float32Array(inArray.length);

  const kernelSize = 2 * radius + 1;
  const kernel = new Float32Array(kernelSize);
  let sum = 0;

  for (let i = -radius; i <= radius; i++) {
    const val = Math.exp(-Math.pow(i, 2) / (2 * Math.pow(sigma, 2)));
    kernel[i + radius] = val;
    sum += val;
  }

  for (let i = 0; i < kernelSize; i++) kernel[i] /= sum;

  const tmp = new Float32Array(inArray.length);
  for (let y = 0; y < height; y++) {
    const yOffs = y * width;

    for (let x = 0; x < width; x++) {
      let acc = 0;

      for (let k = -radius; k <= radius; k++) {
        acc += inArray[yOffs + ((x + k + width) % width)] * kernel[k + radius];
      }

      tmp[yOffs + x] = acc;
    }
  }

  for (let y = 0; y < height; y++) {
    const yOffsK = y + width;
    const yOffs = y * width;

    for (let x = 0; x < width; x++) {
      let acc = 0;

      for (let k = -radius; k <= radius; k++) {
        acc += tmp[((k + yOffsK) % height) * width + x] * kernel[k + radius];
      }

      out[yOffs + x] = acc;
    }
  }

  return out;
}

function shuffle(array) {
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
