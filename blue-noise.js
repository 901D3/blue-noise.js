/**
 * Free JS implementation of every blue noise related stuff 
 *
 * v0.3.01
 * https://github.com/901D3/blue-noise.js
 *
 * Cody0right (c) 901D3
 * Licensed with GPLv3 license
 */

"use strict";

const BNJS = {
  // [1]: https://cv.ulichney.com/papers/1993-void-cluster.pdf
  VoidAndClusterWrap() { throw new Error("not implemented"); },

  // [2]: https://www.iliyan.com/publications/DitheredSampling
  IliyanDitheredSamplingWrap() { throw new Error("not implemented"); },

  // [3]: https://ieeexplore.ieee.org/document/559555
  DirectBinarySearch() { throw new Error("not implemented"); },

  // [1]
  VoidAndClusterCandidateWrap() { throw new Error("not implemented"); },

  // [4]: https://dl.acm.org/doi/10.1145/127719.122736
  MitchellBestCandidateWrap() { throw new Error("not implemented"); },

  // [5]: https://en.wikipedia.org/wiki/Lloyd%27s_algorithm
  LloydRelaxationWrap() { throw new Error("not implemented"); },

  // [6]: https://arxiv.org/pdf/2206.07798, https://dl.acm.org/doi/10.1145/3550454.3555519
  GaussianBlueNoiseWrap() { throw new Error("not implemented"); },

  // [7]: https://dl.acm.org/doi/10.1145/2185520.2185572
  GeneralSpectrumNoiseWrap() { throw new Error("not implemented"); },

  BuildGaussianKernel() { throw new Error("not implemented"); },

  // [7]
  BuildGaussianDerivateKernels() { throw new Error("not implemented"); },

  // [9]: https://www.hajim.rochester.edu/ece/sites/parker/research/blue-noise-mask.html, https://github.com/yosefm/blue_noise
  ComputeDesiredPSD() { throw new Error("not implemented"); },

  // [2]
  CalcTotalEnergyIliyanWrap() { throw new Error("not implemented"); },
  CalcEnergyIliyanWrap() { throw new Error("not implemented"); },

  // [10]: https://en.wikipedia.org/wiki/Voronoi_diagram
  BuildVoronoiDiagramWrap() { throw new Error("not implemented"); },

  // [11]: https://en.wikipedia.org/wiki/Delaunay_triangulation
  BuildDelaunayTrianglesBowyerWatsonWrapOOB() { throw new Error("not implemented"); },
  DelaunayTrianglesBowyerWatsonOOBFilter() { throw new Error("not implemented"); },

  BuildDifferentialDomainBilinearWrap() { throw new Error("not implemented"); },
  DifferentialDomainAddBilinearWrap() { throw new Error("not implemented"); },
  DifferentialDomainUpdateBilinearWrap() { throw new Error("not implemented"); },

  InvCosineTransform2D() { throw new Error("not implemented"); },

  shiftList: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]],
  initBoundPoly: [[-1, -1], [2, -1], [2, 2], [-1, 2]],
};

const BNUtils = {
  Shuffle() { throw new Error("not implemented"); },

  ConvolveWrap() { throw new Error("not implemented"); },
  Convolve() { throw new Error("not implemented"); },

  ConvolveAddWrap() { throw new Error("not implemented"); },
  ConvolveAdd() { throw new Error("not implemented"); },

  GetConvolvedAreaWrap() { throw new Error("not implemented"); },
  GetConvolvedArea() { throw new Error("not implemented"); },

  GetConvolvedAreaDotProductWrap() { throw new Error("not implemented"); },
  GetConvolvedAreaDotProduct() { throw new Error("not implemented"); },

  BilinearAddWrap() { throw new Error("not implemented"); },
  BilinearLookupWrap() { throw new Error("not implemented"); },
};

// ///////////////////////////////////
//                BNJS
// ///////////////////////////////////

BNJS.VoidAndClusterWrap = function (
  rankMap, blurMap, sampleMap, width, height, sampleCount,
  kernel, kWidth, kHeight) {

  const sqSz = width * height;

  BNUtils.ConvolveWrap(sampleMap, blurMap, width, height, kernel, kWidth, kHeight);

  const blurTemp = blurMap.slice();

  const sampleCache = [];
  for (let i = 0, i2 = 0; i < sqSz; i++) {
    if (sampleMap[i])
      sampleCache[i2++] = i;
  }

  let aliveSampleCount = sampleCount;

  for (let rank = sampleCount - 1; rank >= 0; rank--) {
    let idx;
    let value = -Infinity;

    let cacheIdx = 0;

    for (let i = 0; i < aliveSampleCount; i++) {
      const blurredValue = blurMap[sampleCache[i]];

      if (blurredValue > value) {
        value = blurredValue;
        cacheIdx = i;
      }
    }

    const sampleIdx = sampleCache[cacheIdx];

    sampleMap[sampleIdx] = 0;
    rankMap[sampleIdx] = rank;

    sampleCache[aliveSampleCount-- - 1] = sampleCache[cacheIdx];

    BNUtils.ConvolveAddWrap(
      blurMap, width, height,
      idx % width, Math.floor(idx / width),
      kernel, kWidth, kHeight, -1);
  }

  blurMap.set(blurTemp);
  for (let i = 0; i < sampleCount; i++)
    sampleMap[sampleCache[i]] = 1;

  for (let rank = sampleCount; rank < sqSz; rank++) {
    let idx;
    let value = Infinity;

    for (let i = 0; i < sqSz; i++) {
      if (sampleMap[i] === 0) {
        const blurredValue = blurMap[i];

        if (blurredValue < value) {
          value = blurredValue;
          idx = i;
        }
      }
    }

    sampleMap[idx] = 1;
    rankMap[idx] = rank;

    BNUtils.ConvolveAddWrap(
      blurMap, width, height,
      idx % width, Math.floor(idx / width),
      kernel, kWidth, kHeight, 1);
  }

  return rankMap;
}

BNJS.IliyanDitheredSamplingWrap = function (
  inArray, energyMap, width, height,
  kernel, kWidth, kHeight,
  sigmaSample, pNorm, iterationCount) {

  const sqSz = width * height;

  BNJS.CalcTotalEnergyIliyanWrap(
    inArray, energyMap, width, height,
    kernel, kWidth, kHeight,
    sigmaSample, pNorm);

  for (let i = 0; i < iterationCount; i++) {
    const p = Math.floor(Math.random() * sqSz);
    const q = i % sqSz;

    // Swap pixels
    const temp = inArray[p];
    inArray[p] = inArray[q];
    inArray[q] = temp;

    // Compute energy for both swapped pixel indexes
    const newEnergy1 = BNJS.CalcEnergyIliyanWrap(
      inArray, width, height, p % width, Math.floor(p / width),
      kernel, kWidth, kHeight,
      sigmaSample, pNorm);

    const newEnergy2 = BNJS.CalcEnergyIliyanWrap(
      inArray, width, height, q % width, Math.floor(q / width),
      kernel, kWidth, kHeight,
      sigmaSample, pNorm);

    if (newEnergy1 + newEnergy2 < energyMap[p] + energyMap[q]) {
      energyMap[p] = newEnergy1;
      energyMap[q] = newEnergy2;
    }
    else {
      const tmp = inArray[p];
      inArray[p] = inArray[q];
      inArray[q] = tmp;
    }
  }
}

BNJS.DirectBinarySearch = function (
  inArray, ditheredArray, errorMap, blurMap, indicesMap, width, height,
  kernel, kWidth, kHeight, iterationCount) {

  const sqSz = width * height;

  let kernelEnergy = 0;
  for (let i = kWidth * kHeight - 1; i >= 0; i--) kernelEnergy += kernel[i] ** 2;

  for (let i = 0; i < sqSz; i++)
    errorMap[i] = inArray[i] - ditheredArray[i];

  BNUtils.Convolve(errorMap, blurMap, width, height, kernel, kWidth, kHeight);

  for (let iter = 0; iter < iterationCount; iter++) {
    for (let i = 0; i < sqSz; i++) {
      const idx = indicesMap[i];

      const x = idx % width;
      const y = Math.floor(idx / width);

      const oldPixel = ditheredArray[idx];
      const newPixel = !oldPixel;
      const deltaErr = oldPixel - newPixel;

      const dotProduct =
        BNUtils.GetConvolvedAreaDotProduct(blurMap, width, height, x, y, kernel, kWidth, kHeight);

      const deltaEnergy = 2 * deltaErr * dotProduct + deltaErr * deltaErr * kernelEnergy;

      if (deltaEnergy < 0) {
        ditheredArray[idx] = newPixel;
        errorMap[idx] += deltaErr;

        BNUtils.ConvolveAdd(blurMap, width, height, x, y, kernel, kWidth, kHeight, deltaErr);
      }
    }
  }
}

BNJS.VoidAndClusterCandidateWrap = function (sampleMap, blurMap, width, height, kernel, kWidth, kHeight) {
  const sqSz = width * height;

  BNUtils.ConvolveWrap(sampleMap, blurMap, width, height, kernel, kWidth, kHeight);

  while (true) {
    let clusterValue = -Infinity;
    let voidValue = Infinity;
    let clusterIdx;
    let voidIdx;

    for (let i = 0; i < sqSz; i++) {
      if (sampleMap[i] === 1) {
        const blurredValue = blurMap[i];

        if (blurredValue > clusterValue) {
          clusterValue = blurredValue;
          clusterIdx = i;
        }
      }
    }

    sampleMap[clusterIdx] = 0;

    BNUtils.ConvolveAddWrap(
      blurMap, width, height,
      clusterIdx % width, Math.floor(clusterIdx / width),
      kernel, kWidth, kHeight, -1);

    for (let i = 0; i < sqSz; i++) {
      if (sampleMap[i] === 0) {
        const blurredValue = blurMap[i];

        if (blurredValue < voidValue) {
          voidValue = blurredValue;
          voidIdx = i;
        }
      }
    }

    if (clusterIdx === voidIdx) {
      sampleMap[clusterIdx] = 1;
      break;
    }

    sampleMap[voidIdx] = 1;

    BNUtils.ConvolveAddWrap(
      blurMap, width, height,
      voidIdx % width, Math.floor(voidIdx / width),
      kernel, kWidth, kHeight, 1);
  }
}

BNJS.MitchellBestCandidateWrap = function (sampleList, sampleCount, candidateCount, width, height, wrapX, wrapY) {
  // initalize with a randomly placed point
  sampleList[0] = Math.random() * width;
  sampleList[1] = Math.random() * height;

  for (let i = 1; i < sampleCount; i++) {
    let bestDist = -Infinity;
    let bestX = 0;
    let bestY = 0;

    for (let j = 0; j < candidateCount; j++) {
      const randomX = Math.random() * width;
      const randomY = Math.random() * height;

      let minDist = Number.MAX_VALUE;

      for (let k = 0; k < i; k++) {
        // calculate distances
        let dx = Math.abs(randomX - sampleList[k * 2]);
        let dy = Math.abs(randomY - sampleList[k * 2 + 1]);

        if (dx > wrapX)
          dx = width - dx;

        if (dy > wrapY)
          dy = height - dy;

        minDist = Math.min(minDist, dx ** 2 + dy ** 2);
      }

      if (minDist > bestDist) {
        bestDist = minDist;
        bestX = randomX;
        bestY = randomY;
      }
    }

    sampleList[i * 2] = bestX;
    sampleList[i * 2 + 1] = bestY;
  }

  return sampleList;
}

BNJS.LloydRelaxationWrap = function (sampleList, sampleCount, width, height, wrapX, wrapY, iterationCount) {
  for (let iter = 0; iter < iterationCount; iter++) {
    const voronoi = BNJS.BuildVoronoiDiagramWrap(sampleList, sampleCount, width, height);

    for (let i = voronoi.length - 1; i >= 0; i--) {
      const polygon = voronoi[i];
      const vertexCount = polygon.length;
      if (vertexCount === 0)
        continue;

      const baseVertexX = polygon[0][0];
      const baseVertexY = polygon[0][1];

      let accumX = baseVertexX;
      let accumY = baseVertexY;

      for (let j = 1; j < vertexCount; j++) {
        const currentVertex = polygon[j];

        let distanceX = currentVertex[0] - baseVertexX;
        let distanceY = currentVertex[1] - baseVertexY;

        if (distanceX > wrapX) distanceX -= width;
        else if (distanceX < -wrapX) distanceX += width;

        if (distanceY > wrapY) distanceY -= height;
        else if (distanceY < -wrapY) distanceY += height;

        // Sum
        accumX += baseVertexX + distanceX;
        accumY += baseVertexY + distanceY;
      }

      sampleList[i * 2] = (accumX / vertexCount + width) % width;
      sampleList[i * 2 + 1] = (accumY / vertexCount + height) % height;
    }
  }
}

BNJS.GaussianBlueNoiseWrap = function (
  sampleList, sampleCount, width, height, wrapX, wrapY,
  sigma, iterationCount) {

  const invDenom = 1 / (2 * sigma ** 2);

  for (let iter = 0; iter < iterationCount; iter++) {
    for (let i = 0; i < sampleCount; i++) {
      const sampleIdx = i * 2;

      const x1 = sampleList[sampleIdx];
      const y1 = sampleList[sampleIdx + 1];

      let gDistX = 0;
      let gDistY = 0;

      for (let j = 0; j < sampleCount; j++) {
        if (i === j) continue;

        let dx = x1 - sampleList[j * 2];
        let dy = y1 - sampleList[j * 2 + 1];

        if (dx > wrapX) dx -= width;
        else if (dx < -wrapX) dx += width;

        if (dy > wrapY) dy -= height;
        else if (dy < -wrapY) dy += height;

        const gauss = Math.exp(-(dx ** 2 + dy ** 2) * invDenom);

        gDistX += dx * gauss;
        gDistY += dy * gauss;
      }

      sampleList[sampleIdx] = (x1 + gDistX + width) % width;
      sampleList[sampleIdx + 1] = (y1 + gDistY + height) % height;
    }
  }
}

BNJS.GeneralSpectrumNoiseWrap = function (
  sampleList, sampleCount, width, height, centerX, centerY,
  currentDDA, targetDDA, errorDDA, errorDerivateX, errorDerivateY, forceX, forceY, ddaWidth, ddaHeight,
  derivativeKernelX, derivativeKernelY, kWidth, kHeight,
  stepScale, iterationCount) {

  const ddaSqSz = ddaWidth * ddaHeight;

  const rescaledWidth = ddaWidth / width;
  const rescaledHeight = ddaHeight / height;

  const scaledDDASqSz = stepScale * Math.sqrt(ddaSqSz);

  BNJS.BuildDifferentialDomainBilinearWrap(
    sampleList, sampleCount, width, height, centerX, centerY,
    currentDDA, ddaWidth, ddaWidth);

  for (let iter = 0; iter < iterationCount; iter++) {
    forceX.fill(0);
    forceY.fill(0);

    for (let i = 0; i < ddaSqSz; i++)
      errorDDA[i] = currentDDA[i] - targetDDA[i];

    BNUtils.ConvolveWrap(
      errorDDA, errorDerivateX, ddaWidth, ddaHeight,
      derivativeKernelX, kWidth, kHeight);

    BNUtils.ConvolveWrap(
      errorDDA, errorDerivateY, ddaWidth, ddaHeight,
      derivativeKernelY, kWidth, kHeight);

    let maxPower = -Infinity;

    for (let i = 0; i < sampleCount; i++) {
      let accumX = 0;
      let accumY = 0;

      let sampleX = sampleList[i * 2];
      let sampleY = sampleList[i * 2 + 1];

      for (let j = 0; j < sampleCount; j++) {
        if (i === j) continue;

        let distanceX = sampleX - sampleList[j * 2];
        let distanceY = sampleY - sampleList[j * 2 + 1];

        if (distanceX > centerX) distanceX -= width;
        else if (distanceX < -centerX) distanceX += width;

        if (distanceY > centerY) distanceY -= height;
        else if (distanceY < -centerY) distanceY += height;

        let lookupX = (distanceX + centerX) * rescaledWidth;
        let lookupY = (distanceY + centerY) * rescaledHeight;

        if (lookupX >= ddaWidth) lookupX -= ddaWidth;
        if (lookupY >= ddaHeight) lookupY -= ddaHeight;

        accumX += BNUtils.BilinearLookupWrap(errorDerivateX, ddaWidth, ddaHeight, lookupX, lookupY);
        accumY += BNUtils.BilinearLookupWrap(errorDerivateY, ddaWidth, ddaHeight, lookupX, lookupY);
      }

      forceX[i] = accumX;
      forceY[i] = accumY;

      maxPower = Math.max(maxPower, accumX ** 2 + accumY ** 2);
    }

    let finalStep = scaledDDASqSz / Math.sqrt(maxPower);

    for (let i = 0; i < sampleCount; i++) {
      let sampleX = sampleList[i * 2];
      let sampleY = sampleList[i * 2 + 1];

      let newX = (sampleX + forceX[i] * finalStep) % width;
      let newY = (sampleY + forceY[i] * finalStep) % height;

      BNJS.DifferentialDomainUpdateBilinearWrap(
        sampleList, sampleCount, width, height, centerX, centerY, newX, newY, i,
        currentDDA, ddaWidth, ddaWidth);

      sampleList[i * 2] = newX;
      sampleList[i * 2 + 1] = newY;
    }
  }
}

BNJS.BuildGaussianKernel = function (outKernel, sigma, radiusMul) {
  const radius = Math.ceil(radiusMul * sigma);
  const kWidth = radius * 2 + 1;

  const invDenom = 1 / (2 * sigma ** 2);

  let accum = 0;
  for (let y = -radius; y < radius; y++) {
    const yPow2 = y ** 2;
    const yRow = (y + radius) * kWidth;

    for (let x = -radius; x < radius; x++) {
      const v = Math.exp(-(x ** 2 + yPow2) * invDenom);

      outKernel[yRow + (x + radius)] = v;
      accum += v;
    }
  }

  for (let i = 0, length = kWidth * 2; i < length; i++)
    outKernel[i] /= accum;

  return outKernel;
}

BNJS.BuildGaussianDerivateKernels = function (derivativeKernelX, derivativeKernelY, sigma, radiusMul) {
  const radius = Math.ceil(radiusMul * sigma);
  const kWidth = radius * 2 + 1;

  const dbSigma = sigma ** 2;

  const invDenom = 1 / (2 * dbSigma);

  let accumX = 0;
  let accumY = 0;

  for (let y = -radius; y < radius; y++) {
    const yPow2 = y ** 2;
    const yRow = (y + radius) * kWidth;

    for (let x = -radius; x < radius; x++) {
      const idx = yRow + (x + radius);

      const v = Math.exp(-(x ** 2 + yPow2) * invDenom);
      const scale = (v ** 2) / dbSigma;

      const vx = -x * scale;
      const vy = -y * scale;

      derivativeKernelX[idx] = vx;
      derivativeKernelY[idx] = vy;

      accumX += vx;
      accumY += vy;
    }
  }

  for (let i = 0; i < kWidth ** 2; i++) {
    derivativeKernelX[i] /= accumX;
    derivativeKernelY[i] /= accumY;
  }
}

BNJS.ComputeDesiredPSD = function (PSD, width, height, gray, peakScale) {
  const sqSz = width * height;

  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);

  const halfPI = Math.PI / 2;

  const maxRadius = Math.sqrt(halfWidth ** 2 + halfHeight ** 2);
  const totalEnergy = sqSz * gray;
  const DCPower = totalEnergy ** 2;
  const requiredSum = sqSz * totalEnergy - DCPower;

  const peak = Math.sqrt(gray / 2) * maxRadius;
  const scaledPeak = peakScale * peak;
  const peakValue = Math.sin(halfPI * (scaledPeak / peak)) ** 4;

  let accum = 0;
  for (let y = 0; y < height; y++) {
    const yRow = y * width;
    const y = y - halfHeight;

    for (let x = 0; x < width; x++) {
      const x = x - halfWidth;
      const radius = Math.sqrt(x * x + y * y);

      if (radius <= scaledPeak) {
        const v = Math.sin(halfPI * (radius / peak)) ** 4;
        PSD[yRow + x] = v;
        accum += v;
      }
      else {
        PSD[yRow + x] = peakValue;
        accum += peakValue;
      }
    }
  }

  const parseval = requiredSum / accum;
  for (let i = 0; i < sqSz; i++) PSD[i] *= parseval;

  PSD[halfHeight * width + halfWidth] = DCPower;

  return PSD;
}

BNJS.CalcTotalEnergyIliyanWrap = function (inArray, energyMap, width, height, kernel, kWidth, kHeight, sigmaSample, pNorm) {
  const halfKernelWidth = Math.floor(kWidth / 2);
  const halfKernelHeight = Math.floor(kHeight / 2);

  const invDenom = 1 / (sigmaSample ** 2);

  for (let y = 0; y < height; y++) {
    const yRow = y * width;

    let baseConvY = y - halfKernelHeight;
    if (baseConvY < 0) baseConvY = (baseConvY + height) % height;

    for (let x = 0; x < width; x++) {
      const centerValue = inArray[yRow + x];

      let baseConvX = x - halfKernelWidth;
      if (baseConvX < 0) baseConvX = (baseConvX + width) % width;

      let convY = baseConvY;
      let accum = 0;

      for (let ky = 0; ky < kHeight; ky++) {
        const convYRow = convY * width;
        const kyRow = ky * kWidth;

        let convX = baseConvX;

        for (let kx = 0; kx < kWidth; kx++) {
          accum += kernel[kyRow + kx] * Math.exp(-(Math.abs(centerValue - inArray[convYRow + convX]) ** pNorm * invDenom));

          if (++convX === width) convX = 0;
        }

        if (++convY === height) convY = 0;
      }

      energyMap[yRow + x] = accum;
    }
  }
}

BNJS.CalcEnergyIliyanWrap = function (inArray, width, height, x, y, kernel, kWidth, kHeight, sigmaSample, pNorm) {
  let convY = y - Math.floor(kHeight / 2);
  if (convY < 0) convY = (convY + height) % height;

  let baseConvX = x - Math.floor(kWidth / 2);
  if (baseConvX < 0) baseConvX = (baseConvX + width) % width;

  const invDenom = 1 / (sigmaSample * sigmaSample);
  const center = inArray[y * width + x];

  let accum = 0;

  for (let ky = 0; ky < kHeight; ky++) {
    const convYRow = convY * width;
    const kyRow = ky * kWidth;

    let convX = baseConvX;

    for (let kx = 0; kx < kWidth; kx++) {
      accum +=
        kernel[kyRow + kx] *
        Math.exp(-(Math.abs(center - inArray[convYRow + convX]) ** pNorm * invDenom));

      if (++convX === width) convX = 0;
    }

    if (++convY === height) convY = 0;
  }

  return accum;
}

BNJS.BuildVoronoiDiagramWrap = function (sampleList, sampleCount, width, height) {
  const candidateShifts = BNJS.shiftList;
  const initBoundPoly = BNJS.initBoundPoly;

  const shiftsLength = candidateShifts.length;

  const voronoi = Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const sampleX = sampleList[i * 2];
    const sampleY = sampleList[i * 2 + 1];

    let polygon = Array(initBoundPoly.length);
    for (let i = 0; i < initBoundPoly.length; i++) {
      const currentVertex = initBoundPoly[i];
      polygon[i] = [currentVertex[0] * width, currentVertex[1] * height];
    }

    for (let j = 0; j < sampleCount; j++) {
      if (i === j)
        continue;

      const candX = sampleList[j * 2];
      const candY = sampleList[j * 2 + 1];

      for (let shift = 0; shift < shiftsLength; shift++) {
        const shiftedCandX = candX + candidateShifts[shift][0] * width;
        const shiftedCandY = candY + candidateShifts[shift][1] * height;

        const newVertexList = [];
        const vertexListLength = polygon.length;

        for (let vertex = 0; vertex < vertexListLength; vertex++) {
          const v0x = polygon[vertex][0];
          const v0y = polygon[vertex][1];

          const v1 = polygon[vertex === vertexListLength - 1 ? 0 : vertex + 1];
          const v1x = v1[0];
          const v1y = v1[1];

          const distV0 =
            (v0x - sampleX) ** 2 +
            (v0y - sampleY) ** 2 -
            (v0x - shiftedCandX) ** 2 -
            (v0y - shiftedCandY) ** 2;

          const distanceVertex1Diffs =
            (v1x - sampleX) ** 2 +
            (v1y - sampleY) ** 2 -
            (v1x - shiftedCandX) ** 2 -
            (v1y - shiftedCandY) ** 2;

          const denominator = distV0 - distanceVertex1Diffs;
          if (denominator === 0) continue;

          if (distV0 <= 0) {
            if (distanceVertex1Diffs <= 0) newVertexList.push(v1);
            else {
              const interpolation = distV0 / denominator;

              newVertexList.push([
                v0x + (v1x - v0x) * interpolation,
                v0y + (v1y - v0y) * interpolation,
              ]);
            }
          } else if (distV0 > 0 && distanceVertex1Diffs <= 0) {
            const interpolation = distV0 / denominator;

            newVertexList.push([
              v0x + (v1x - v0x) * interpolation,
              v0y + (v1y - v0y) * interpolation,
            ]);

            newVertexList.push(v1);
          }
        }

        polygon = newVertexList;
        if (polygon.length === 0) break;
      }
    }

    voronoi[i] = polygon;
  }

  return voronoi;
}

BNJS.BuildDelaunayTrianglesBowyerWatsonWrapOOB = (sampleList, sampleCount, width, height) => {
  const shiftList = BNJS.shiftList;
  const shiftCount = shiftList.length;

  const minX = -width - 1;
  const maxX = width * 2 + 1;
  const minY = -height - 1;
  const maxY = height * 2 + 1;
  const deltaMax = Math.max(maxX - minX, maxY - minY);

  const triangleList = [
    [
      [minX - deltaMax, minY - deltaMax],
      [minX + 3 * deltaMax, minY - deltaMax],
      [minX - deltaMax, minY + 3 * deltaMax]
    ]
  ];

  const extSampleList = [];

  for (let i = 0; i < sampleCount; i++) {
    const sampleX = sampleList[i * 2];
    const sampleY = sampleList[i * 2 + 1];

    extSampleList.push([sampleX, sampleY, true]);

    for (let j = 1; j < shiftCount; j++) {
      const currentShift = shiftList[j];

      extSampleList.push([
        sampleX + currentShift[0] * width,
        sampleY + currentShift[1] * height]);
    }
  }

  for (let i = extSampleList.length - 1; i >= 0; i--) {
    const extSampleX = extSampleList[i][0];
    const extSampleY = extSampleList[i][1];

    const badTriangles = [];
    for (let j = triangleList.length - 1; j >= 0; j--) {
      const v1 = triangleList[j][0];
      const v2 = triangleList[j][1];
      const v3 = triangleList[j][2];

      const distX1 = v1[0] - extSampleX;
      const distY1 = v1[1] - extSampleY;

      const distX2 = v2[0] - extSampleX;
      const distY2 = v2[1] - extSampleY;

      const distX3 = v3[0] - extSampleX;
      const distY3 = v3[1] - extSampleY;

      if (
        (distX1 * distX1 + distY1 * distY1) * (distX2 * distY3 - distX3 * distY2) +
        (distX2 * distX2 + distY2 * distY2) * (distX3 * distY1 - distX1 * distY3) +
        (distX3 * distX3 + distY3 * distY3) * (distX1 * distY2 - distX2 * distY1) > 0) {
        badTriangles.push(triangleList[j]);
        triangleList.splice(j, 1);
      }
    }

    const badEdgeList = [];
    for (let j = badTriangles.length - 1; j >= 0; j--) {
      const v1 = badTriangles[j][0];
      const v2 = badTriangles[j][1];
      const v3 = badTriangles[j][2];

      badEdgeList.push([v1, v2]);
      badEdgeList.push([v2, v3]);
      badEdgeList.push([v3, v1]);
    }

    const boundary = [];
    const badEdgeCount = badEdgeList.length;

    for (let j = 0; j < badEdgeCount; j++) {
      let isSharedEdge = false;

      const e0v0 = badEdgeList[j][0];
      const e0v0x = e0v0[0];
      const e0v0y = e0v0[1];

      const e0v1 = badEdgeList[j][1];
      const e0v1x = e0v1[0];
      const e0v1y = e0v1[1];

      for (let k = 0; k < badEdgeCount; k++) {
        if (k === j) continue;

        const e1v0 = badEdgeList[k][0];
        const e1v0x = e1v0[0];
        const e1v0y = e1v0[1];

        const e1v1 = badEdgeList[k][1];
        const e1v1x = e1v1[0];
        const e1v1y = e1v1[1];

        if (
          (e0v0x === e1v0x && e0v0y === e1v0y && e0v1x === e1v1x && e0v1y === e1v1y) ||
          (e0v0x === e1v1x && e0v0y === e1v1y && e0v1x === e1v0x && e0v1y === e1v0y)) {
          isSharedEdge = true;
          break;
        }
      }

      if (!isSharedEdge) boundary.push(badEdgeList[j]);
    }

    for (let j = boundary.length - 1; j >= 0; j--) {
      const currentBoundary = boundary[j];
      triangleList.push([currentBoundary[0], currentBoundary[1], extSampleList[i]]);
    }
  }

  for (let i = triangleList.length - 1; i >= 0; i--) {
    const currentTriangle = triangleList[i];

    const vertex0 = currentTriangle[0];
    const vertex1 = currentTriangle[1];
    const vertex2 = currentTriangle[2];

    if (vertex0[2] || vertex1[2] || vertex2[2]) {
      triangleList.push([
        [vertex0[0], vertex0[1]],
        [vertex1[0], vertex1[1]],
        [vertex2[0], vertex2[1]],
      ]);
    }
  }

  return triangleList;
}

BNJS.DelaunayTrianglesBowyerWatsonOOBFilter = function (triangleList, width, height) {
  const delaunay = [];

  for (let i = triangleList.length - 1; i >= 0; i--) {
    const currentTriangle = triangleList[i];

    const v0 = currentTriangle[0];
    const v1 = currentTriangle[1];
    const v2 = currentTriangle[2];

    if (v0[2] || v1[2] || v2[2]) {
      const v0x = v0[0];
      const v0y = v0[1];

      const v1x = v1[0];
      const v1y = v1[1];

      const v2x = v2[0];
      const v2y = v2[1];

      const centerX = (v0x + v1x + v2x) / 3;
      const centerY = (v0y + v1y + v2y) / 3;

      if (centerX >= 0 && centerX < width && centerY >= 0 && centerY < height) {
        delaunay.push([
          [v0x, v0y],
          [v1x, v1y],
          [v2x, v2y],
        ]);
      }
    }
  }

  return delaunay;
}

BNJS.BuildDifferentialDomainBilinearWrap = function (
  sampleList, sampleCount, width, height, centerX, centerY,
  differentialDomain, ddaWidth, ddaheight) {

  const rescaledWidth = ddaWidth / width;
  const rescaledHeight = ddaheight / height;

  for (let i = 0; i < sampleCount; i++) {
    let sampleX = sampleList[i * 2];
    let sampleY = sampleList[i * 2 + 1];

    for (let j = i + 1; j < sampleCount; j++) {
      let distanceX = sampleX - sampleList[j * 2];
      let distanceY = sampleY - sampleList[j * 2 + 1];

      if (distanceX > centerX) distanceX -= width;
      if (distanceX < -centerX) distanceX += width;

      if (distanceY > centerY) distanceY -= height;
      if (distanceY < -centerY) distanceY += height;

      BNUtils.BilinearAddWrap(
        differentialDomain, ddaWidth, ddaheight,
        (centerX + distanceX) * rescaledWidth,
        (centerY + distanceY) * rescaledHeight,
        1);

      BNUtils.BilinearAddWrap(
        differentialDomain, ddaWidth, ddaheight,
        (centerX - distanceX) * rescaledWidth,
        (centerY - distanceY) * rescaledHeight,
        1);
    }
  }
}

BNJS.DifferentialDomainAddBilinearWrap = function (
  sampleList, sampleCount, width, height, centerX, centerY, x, y,
  differentialDomain, ddaWidth, ddaHeight) {

  const rescaledWidth = ddaWidth / width;
  const rescaledHeight = ddaHeight / height;

  for (let i = 0; i < sampleCount; i++) {
    let sampleX = sampleList[i * 2];
    let sampleY = sampleList[i * 2 + 1];

    let distanceX = sampleX - x;
    let distanceY = sampleY - y;

    if (distanceX > centerX) distanceX -= width;
    if (distanceX < -centerX) distanceX += width;

    if (distanceY > centerY) distanceY -= height;
    if (distanceY < -centerY) distanceY += height;

    BNUtils.BilinearAddWrap(
      differentialDomain, ddaWidth, ddaHeight,
      (centerX + distanceX) * rescaledWidth,
      (centerY + distanceY) * rescaledHeight,
      1);

    BNUtils.BilinearAddWrap(
      differentialDomain, ddaWidth, ddaHeight,
      (centerX - distanceX) * rescaledWidth,
      (centerY - distanceY) * rescaledHeight,
      1);
  }
}

BNJS.DifferentialDomainUpdateBilinearWrap = function (
  sampleList, sampleCount, width, height, centerX, centerY, newX, newY, oldSampleIdx,
  differentialDomain, ddaWidth, ddaHeight) {

  const rescaledWidth = ddaWidth / width;
  const rescaledHeight = ddaHeight / height;

  const oldSampleX = sampleList[oldSampleIdx * 2];
  const oldSampleY = sampleList[oldSampleIdx * 2 + 1];

  for (let i = 0; i < sampleCount; i++) {
    if (i === oldSampleIdx) continue;

    const sampleX = sampleList[i * 2];
    const sampleY = sampleList[i * 2 + 1];

    let distanceX = sampleX - oldSampleX;
    let distanceY = sampleY - oldSampleY;

    if (distanceX > centerX) distanceX -= width;
    if (distanceX < -centerX) distanceX += width;

    if (distanceY > centerY) distanceY -= height;
    if (distanceY < -centerY) distanceY += height;

    BNUtils.BilinearAddWrap(
      differentialDomain, ddaWidth, ddaHeight,
      (centerX + distanceX) * rescaledWidth,
      (centerY + distanceY) * rescaledHeight,
      -1);

    BNUtils.BilinearAddWrap(
      differentialDomain, ddaWidth, ddaHeight,
      (centerX - distanceX) * rescaledWidth,
      (centerY - distanceY) * rescaledHeight,
      -1);

    distanceX = sampleX - newX;
    distanceY = sampleY - newY;

    if (distanceX > centerX) distanceX -= width;
    if (distanceX < -centerX) distanceX += width;

    if (distanceY > centerY) distanceY -= height;
    if (distanceY < -centerY) distanceY += height;

    BNUtils.BilinearAddWrap(
      differentialDomain, ddaWidth, ddaHeight,
      (centerX + distanceX) * rescaledWidth,
      (centerY + distanceY) * rescaledHeight,
      1);

    BNUtils.BilinearAddWrap(
      differentialDomain, ddaWidth, ddaHeight,
      (centerX - distanceX) * rescaledWidth,
      (centerY - distanceY) * rescaledHeight,
      1);
  }
}

BNJS.InvCosineTransform2D = function (powerDomain, differentialDomain, width, height, centerX, centerY) {
  for (let y0 = 0; y0 < height; y0++) {
    const y0Row = y0 * width;
    const y0Shifted = (y0 - centerX) / height;

    for (let x0 = 0; x0 < width; x0++) {
      const x0Shifted = (x0 - centerY) / width;
      let accum = 0;

      for (let y1 = 0; y1 < height; y1++) {
        const y1Row = y1 * width;

        const y1Shifted = y1 - centerY;
        const yShiftedProduct = y0Shifted * y1Shifted;

        for (let x1 = 0; x1 < width; x1++) {
          const x1Shifted = x1 - centerX;
          const xShiftedProduct = x0Shifted * x1Shifted;

          accum += powerDomain[y1Row + x1] * Math.cos((xShiftedProduct + yShiftedProduct) * (2 * Math.PI));
        }
      }

      differentialDomain[y0Row + x0] = accum;
    }
  }
}

// ///////////////////////////////////
//              BNUtils
// ///////////////////////////////////

BNUtils.Shuffle = function (inArray) {
  for (let i = inArray.length - 1; i >= 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;

    const temp = inArray[i];
    inArray[i] = inArray[j];
    inArray[j] = temp;
  }
}

BNUtils.ConvolveWrap = function (inArray, outArray, width, height, kernel, kWidth, kHeight) {
  const halfKWidth = kWidth >> 1;
  const halfKHeight = kHeight >> 1;

  for (let y = 0; y < height; y++) {
    const yRow = y * width;

    let baseConvY = y - halfKHeight;
    if (baseConvY < 0)
      baseConvY = (baseConvY + height) % height;

    for (let x = 0; x < width; x++) {
      let baseConvX = x - halfKWidth;
      if (baseConvX < 0)
        baseConvX = (baseConvX + width) % width;

      let convY = baseConvY;
      let accum = 0;

      for (let ky = 0; ky < kHeight; ky++) {
        const convYRow = convY * width;
        const kyRow = ky * kWidth;

        let convX = baseConvX;

        for (let kx = 0; kx < kWidth; kx++) {
          accum += inArray[convYRow + convX] * kernel[kyRow + kx];

          if (++convX === width)
            convX = 0;
        }

        if (++convY === height)
          convY = 0;
      }

      outArray[yRow + x] = accum;
    }
  }
}

BNUtils.ConvolveAddWrap = function (inArray, width, height, x, y, kernel, kWidth, kHeight, amount) {
  let convY = y - (kHeight >> 1);
  if (convY < 0)
    convY = (convY + height) % height;

  let baseConvX = x - (kWidth >> 1);
  if (baseConvX < 0)
    baseConvX = (baseConvX + width) % width;

  for (let ky = 0; ky < kHeight; ky++) {
    const convYRow = convY * width;
    const kyRow = ky * kWidth;

    let convX = baseConvX;

    for (let kx = 0; kx < kWidth; kx++) {
      inArray[convYRow + convX] += kernel[kyRow + kx] * amount;

      if (++convX === width)
        convX = 0;
    }

    if (++convY === height)
      convY = 0;
  }
}

BNUtils.GetConvolvedAreaWrap = function (inArray, width, height, x, y, outArray, kWidth, kHeight) {
  let convY = y - (kHeight >> 1);
  if (convY < 0) convY = (convY + height) % height;

  let baseConvX = x - (kWidth >> 1);
  if (baseConvX < 0) baseConvX = (baseConvX + width) % width;

  for (let ky = 0; ky < kHeight; ky++, convY++) {
    if (convY === height) convY = 0;

    const convYRow = convY * width;
    const kyRow = ky * kWidth;

    for (let kx = 0, convX = baseConvX; kx < kWidth; kx++, convX++) {
      if (convX === width) convX = 0;

      outArray[kyRow + kx] = inArray[convYRow + convX];
    }
  }
}

BNUtils.GetConvolvedAreaDotProductWrap = function (inArray, width, height, x, y, kernel, kWidth, kHeight) {
  let convY = y - (kHeight >> 1);
  if (convY < 0) convY = (convY + height) % height;

  let baseConvX = x - (kWidth >> 1);
  if (baseConvX < 0) baseConvX = (baseConvX + width) % width;

  let dotProduct = 0;

  for (let ky = 0; ky < kHeight; ky++, convY++) {
    if (convY === height) convY = 0;
    const convYRow = convY * width;
    const kyRow = ky * kWidth;

    for (let kx = 0, convX = baseConvX; kx < kWidth; kx++, convX++) {
      if (convX === width) convX = 0;

      dotProduct += inArray[convYRow + convX] * kernel[kyRow + kx];
    }
  }

  return dotProduct;
}

BNUtils.Convolve = function (inArray, blurredArray, width, height, kernel, kWidth, kHeight) {
  const halfkWidth = kWidth >> 1;
  const halfkHeight = kHeight >> 1;

  for (let y = 0; y < height; y++) {
    const yRow = y * width;
    const baseConvY = y - halfkHeight;

    const kyStart = Math.max(0, halfkHeight - y);
    const kyEnd = Math.min(kHeight, height + halfkHeight - y);

    for (let x = 0; x < width; x++) {
      const baseConvX = x - halfkWidth;
      let accum = 0;

      const kxStart = Math.max(0, halfkWidth - x);
      const kxEnd = Math.min(kWidth, width + halfkWidth - x);

      for (let ky = kyStart; ky < kyEnd; ky++) {
        const convYRow = (baseConvY + ky) * width;
        const kyRow = ky * kWidth;

        for (let kx = kxStart; kx < kxEnd; kx++)
          accum += inArray[convYRow + baseConvX + kx] * kernel[kyRow + kx];
      }

      blurredArray[yRow + x] = accum;
    }
  }
}

BNUtils.ConvolveAdd = function (blurredArray, width, height, x, y, kernel, kWidth, kHeight, amount) {
  const halfkWidth = kWidth >> 1;
  const halfkHeight = kHeight >> 1;

  const convX = x - halfkWidth;
  const convY = y - halfkHeight;

  const kxStart = Math.max(0, halfkWidth - x);
  const kxEnd = Math.min(kWidth, width + halfkWidth - x);

  const kyStart = Math.max(0, halfkHeight - y);
  const kyEnd = Math.min(kHeight, height + halfkHeight - y);

  for (let ky = kyStart; ky < kyEnd; ky++) {
    const convYRow = (convY + ky) * width;
    const kyRow = ky * kWidth;

    for (let kx = kxStart; kx < kxEnd; kx++)
      blurredArray[convYRow + convX + kx] += kernel[kyRow + kx] * amount;
  }
}

BNUtils.GetConvolvedArea = function (inArray, width, height, x, y, outArray, kWidth, kHeight) {
  const halfkWidth = kWidth >> 1;
  const halfkHeight = kHeight >> 1;

  const convX = x - halfkWidth;
  const convY = y - halfkHeight;

  const kxStart = Math.max(0, halfkWidth - x);
  const kxEnd = Math.min(kWidth, width + halfkWidth - x);

  const kyStart = Math.max(0, halfkHeight - y);
  const kyEnd = Math.min(kHeight, height + halfkHeight - y);

  for (let ky = kyStart; ky < kyEnd; ky++) {
    const convRow = (convY + ky) * width;
    const kyRow = ky * kWidth;

    for (let kx = kxStart; kx < kxEnd; kx++)
      outArray[kyRow + kx] = inArray[convRow + convX + kx];
  }
}

BNUtils.GetConvolvedAreaDotProduct = function (inArray, width, height, x, y, kernel, kWidth, kHeight) {
  const halfkWidth = kWidth >> 1;
  const halfkHeight = kHeight >> 1;

  const convX = x - halfkWidth;
  const convY = y - halfkHeight;

  const kxStart = Math.max(0, halfkWidth - x);
  const kxEnd = Math.min(kWidth, width + halfkWidth - x);

  const kyStart = Math.max(0, halfkHeight - y);
  const kyEnd = Math.min(kHeight, height + halfkHeight - y);

  let dotProduct = 0;

  for (let ky = kyStart; ky < kyEnd; ky++) {
    const convRow = (convY + ky) * width;
    const kyRow = ky * kWidth;

    for (let kx = kxStart; kx < kxEnd; kx++)
      dotProduct += inArray[convRow + convX + kx] * kernel[kyRow + kx];
  }

  return dotProduct;
}

BNUtils.BilinearAddWrap = function (inArray, width, height, x, y, amount) {
  const floorX = Math.floor(x);
  const floorY = Math.floor(y);

  let nextFloorX = floorX + 1;
  let nextFloorY = floorY + 1;

  if (nextFloorX === width) nextFloorX = 0;
  if (nextFloorY === height) nextFloorY = 0;

  const yRow1 = floorY * width;
  const yRow2 = nextFloorY * width;

  const fracX = x - floorX;
  const fracY = y - floorY;

  const invFracY = 1 - fracY;
  const invFracX = 1 - fracX;

  const leftScale = amount * invFracX;
  const rightScale = amount * fracX;

  inArray[yRow1 + floorX] += leftScale * invFracY;
  inArray[yRow1 + nextFloorX] += rightScale * invFracY;
  inArray[yRow2 + floorX] += leftScale * fracY;
  inArray[yRow2 + nextFloorX] += rightScale * fracY;
}

BNUtils.BilinearLookupWrap = function (inArray, width, height, x, y) {
  const floorX = Math.floor(x);
  const floorY = Math.floor(y);

  let nextFloorX = floorX + 1;
  let nextFloorY = floorY + 1;

  if (nextFloorX === width) nextFloorX = 0;
  if (nextFloorY === height) nextFloorY = 0;

  const yRow1 = floorY * width;
  const yRow2 = nextFloorY * width;

  const fracX = x - floorX;
  const fracY = y - floorY;

  const invFracX = 1 - fracX;
  const invFracY = 1 - fracY;

  const topValue = inArray[yRow1 + floorX] * invFracX + inArray[yRow1 + nextFloorX] * fracX;
  const bottomValue = inArray[yRow2 + floorX] * invFracX + inArray[yRow2 + nextFloorX] * fracX;

  return (bottomValue - topValue) * fracY + topValue;
}
