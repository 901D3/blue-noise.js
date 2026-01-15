/**
 * Free JS implementation of Void and Cluster method by Robert Ulichney and other methods
 * Remember to link this script
 *
 * v0.2.9
 * https://github.com/901D3/blue-noise.js
 *
 * Copyright (c) 901D3
 * This code is licensed with GPLv3 license
 */

"use strict";

const BlueNoiseUtils = (function () {
  const candidateShifts = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];

  const initialBoundingPolygon = [
    [-1, -1],
    [2, -1],
    [2, 2],
    [-1, 2],
  ];

  /**
   *
   * @param {*} inArray
   */

  const _shuffle = (inArray) => {
    for (let i = inArray.length - 1; i >= 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;

      const temp = inArray[i];
      inArray[i] = inArray[j];
      inArray[j] = temp;
    }
  };

  /**
   * Convolving with wrap around
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} blurredArray
   * @param {*} kernelArray
   * @param {*} kernelWidth
   * @param {*} kernelHeight
   */

  const _convolveWrapAroundInPlace = (
    inArray,
    blurredArray,
    width,
    height,
    kernelArray,
    kernelWidth,
    kernelHeight
  ) => {
    const halfKernelWidth = kernelWidth >> 1;
    const halfKernelHeight = kernelHeight >> 1;

    for (let idxY = 0; idxY < height; idxY++) {
      const idxYOffs = idxY * width;

      let baseConvolveIdxY = idxY - halfKernelHeight;
      if (baseConvolveIdxY < 0) baseConvolveIdxY = (baseConvolveIdxY + height) % height;

      for (let idxX = 0; idxX < width; idxX++) {
        let baseConvolveIdxX = idxX - halfKernelWidth;
        if (baseConvolveIdxX < 0) baseConvolveIdxX = (baseConvolveIdxX + width) % width;

        let convolveIdxY = baseConvolveIdxY;
        let total = 0;

        for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
          const convolveIdxYOffs = convolveIdxY * width;
          const kernelIdxYOffs = kernelIdxY * kernelWidth;

          let convolveIdxX = baseConvolveIdxX;

          for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
            total +=
              inArray[convolveIdxYOffs + convolveIdxX] *
              kernelArray[kernelIdxYOffs + kernelIdxX];

            if (++convolveIdxX === width) convolveIdxX = 0;
          }

          if (++convolveIdxY === height) convolveIdxY = 0;
        }

        blurredArray[idxYOffs + idxX] = total;
      }
    }
  };

  /**
   * Convolve delta updater with wrap around
   *
   * @param {*} width
   * @param {*} height
   * @param {*} idx
   * @param {*} amount
   * @param {*} blurredArray
   * @param {*} kernelArray
   * @param {*} kernelWidth
   * @param {*} kernelHeight
   */

  const _convolveAddWrapAroundInPlace = (
    blurredArray,
    width,
    height,
    idx,
    amount,
    kernelArray,
    kernelWidth,
    kernelHeight
  ) => {
    const idxY = (idx / width) | 0;
    const idxX = idx - idxY * width;

    let convolveIdxY = idxY - (kernelHeight >> 1);
    if (convolveIdxY < 0) convolveIdxY = (convolveIdxY + height) % height;

    let baseConvolveIdxX = idxX - (kernelWidth >> 1);
    if (baseConvolveIdxX < 0) baseConvolveIdxX = (baseConvolveIdxX + width) % width;

    for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
      const convolveIdxYOffs = convolveIdxY * width;
      const kernelIdxYOffs = kernelIdxY * kernelWidth;

      let convolveIdxX = baseConvolveIdxX;

      for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
        blurredArray[convolveIdxYOffs + convolveIdxX] +=
          kernelArray[kernelIdxYOffs + kernelIdxX] * amount;

        if (++convolveIdxX === width) convolveIdxX = 0;
      }

      if (++convolveIdxY === height) convolveIdxY = 0;
    }
  };

  /**
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} idx
   * @param {*} outArray
   * @param {*} kernelWidth
   * @param {*} kernelHeight
   */

  const _getConvolvedAreaWrapAroundInPlace = (
    inArray,
    width,
    height,
    idx,
    outArray,
    kernelWidth,
    kernelHeight
  ) => {
    const idxY = (idx / width) | 0;
    const idxX = idx - idxY * width;

    let convolveIdxY = idxY - (kernelHeight >> 1);
    if (convolveIdxY < 0) convolveIdxY = (convolveIdxY + height) % height;

    let baseConvolveIdxX = idxX - (kernelWidth >> 1);
    if (baseConvolveIdxX < 0) baseConvolveIdxX = (baseConvolveIdxX + width) % width;

    for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
      const convolveIdxYOffs = convolveIdxY * width;
      const kernelIdxYOffs = kernelIdxY * kernelWidth;

      let convolveIdxX = baseConvolveIdxX;

      for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
        outArray[kernelIdxYOffs + kernelIdxX] = inArray[convolveIdxYOffs + convolveIdxX];

        if (++convolveIdxX === width) convolveIdxX = 0;
      }

      if (++convolveIdxY === height) convolveIdxY = 0;
    }
  };

  /**
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} idx
   * @param {*} kernelArray
   * @param {*} kernelWidth
   * @param {*} kernelHeight
   * @returns
   */

  const _getConvolvedAreaDotProductWrapAroundInPlace = (
    inArray,
    width,
    height,
    idx,
    kernelArray,
    kernelWidth,
    kernelHeight
  ) => {
    const idxY = (idx / width) | 0;
    const idxX = idx - idxY * width;

    let convolveIdxY = idxY - (kernelHeight >> 1);
    if (convolveIdxY < 0) convolveIdxY = (convolveIdxY + height) % height;

    let baseConvolveIdxX = idxX - (kernelWidth >> 1);
    if (baseConvolveIdxX < 0) baseConvolveIdxX = (baseConvolveIdxX + width) % width;

    let total = 0;

    for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
      const convolveIdxYOffs = convolveIdxY * width;
      const kernelIdxYOffs = kernelIdxY * kernelWidth;

      let convolveIdxX = baseConvolveIdxX;

      for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
        total +=
          inArray[convolveIdxYOffs + convolveIdxX] * kernelArray[kernelIdxYOffs + kernelIdxX];

        if (++convolveIdxX === width) convolveIdxX = 0;
      }

      if (++convolveIdxY === height) convolveIdxY = 0;
    }

    return total;
  };

  /**
   *
   * @param {*} inArray
   * @param {*} blurredArray
   * @param {*} width
   * @param {*} height
   * @param {*} kernelArray
   * @param {*} kernelWidth
   * @param {*} kernelHeight
   */

  const _convolveInPlace = (
    inArray,
    blurredArray,
    width,
    height,
    kernelArray,
    kernelWidth,
    kernelHeight
  ) => {
    const halfkernelWidth = kernelWidth >> 1;
    const halfkernelHeight = kernelHeight >> 1;

    for (let idxY = 0; idxY < height; idxY++) {
      const yOffs = idxY * width;
      const kernelCenterConvolveIdxY = idxY - halfkernelHeight;

      const kernelStartIdxY = Math.max(0, halfkernelHeight - idxY);
      const kernelEndIdxY = Math.min(kernelHeight, height + halfkernelHeight - idxY);

      for (let idxX = 0; idxX < width; idxX++) {
        const kernelCenterConvolveIdxX = idxX - halfkernelWidth;
        let total = 0;

        const kernelStartIdxX = Math.max(0, halfkernelWidth - idxX);
        const kernelEndIdxX = Math.min(kernelWidth, width + halfkernelWidth - idxX);

        for (let kernelIdxY = kernelStartIdxY; kernelIdxY < kernelEndIdxY; kernelIdxY++) {
          const convolveIdxYOffs = (kernelCenterConvolveIdxY + kernelIdxY) * width;
          const kernelIdxYOffs = kernelIdxY * kernelWidth;

          for (let kernelIdxX = kernelStartIdxX; kernelIdxX < kernelEndIdxX; kernelIdxX++) {
            total +=
              inArray[convolveIdxYOffs + kernelCenterConvolveIdxX + kernelIdxX] *
              kernelArray[kernelIdxYOffs + kernelIdxX];
          }
        }

        blurredArray[yOffs + idxX] = total;
      }
    }
  };

  /**
   *
   * @param {*} width
   * @param {*} height
   * @param {*} idx
   * @param {*} amount
   * @param {*} blurredArray
   * @param {*} kernelArray
   * @param {*} kernelWidth
   * @param {*} kernelHeight
   */

  const _convolveAddInPlace = (
    blurredArray,
    width,
    height,
    idx,
    amount,
    kernelArray,
    kernelWidth,
    kernelHeight
  ) => {
    const idxY = (idx / width) | 0;
    const idxX = idx - idxY * width;

    const halfkernelWidth = kernelWidth >> 1;
    const halfkernelHeight = kernelHeight >> 1;

    const kernelCenterConvolveIdxX = idxX - halfkernelWidth;
    const kernelCenterConvolveIdxY = idxY - halfkernelHeight;

    const kernelStartIdxY = Math.max(0, halfkernelHeight - idxY);
    const kernelEndIdxY = Math.min(kernelHeight, height + halfkernelHeight - idxY);

    const kernelStartIdxX = Math.max(0, halfkernelWidth - idxX);
    const kernelEndIdxX = Math.min(kernelWidth, width + halfkernelWidth - idxX);

    for (let kernelIdxY = kernelStartIdxY; kernelIdxY < kernelEndIdxY; kernelIdxY++) {
      const convolveIdxYOffs = (kernelCenterConvolveIdxY + kernelIdxY) * width;
      const kernelIdxYOffs = kernelIdxY * kernelWidth;

      for (let kernelIdxX = kernelStartIdxX; kernelIdxX < kernelEndIdxX; kernelIdxX++) {
        blurredArray[convolveIdxYOffs + kernelCenterConvolveIdxX + kernelIdxX] +=
          kernelArray[kernelIdxYOffs + kernelIdxX] * amount;
      }
    }
  };

  /**
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} idx
   * @param {*} outArray
   * @param {*} kernelWidth
   * @param {*} kernelHeight
   */

  const _getConvolvedAreaInPlace = (
    inArray,
    width,
    height,
    idx,
    outArray,
    kernelWidth,
    kernelHeight
  ) => {
    const idxY = (idx / width) | 0;
    const idxX = idx - idxY * width;

    const halfkernelWidth = kernelWidth >> 1;
    const halfkernelHeight = kernelHeight >> 1;

    const kernelCenterConvolveIdxX = idxX - halfkernelWidth;
    const kernelCenterConvolveIdxY = idxY - halfkernelHeight;

    const kernelStartIdxY = Math.max(0, halfkernelHeight - idxY);
    const kernelEndIdxY = Math.min(kernelHeight, height + halfkernelHeight - idxY);

    const kernelStartIdxX = Math.max(0, halfkernelWidth - idxX);
    const kernelEndIdxX = Math.min(kernelWidth, width + halfkernelWidth - idxX);

    for (let kernelIdxY = kernelStartIdxY; kernelIdxY < kernelEndIdxY; kernelIdxY++) {
      const convolveIdxYOffs = (kernelCenterConvolveIdxY + kernelIdxY) * width;
      const kernelIdxYOffs = kernelIdxY * kernelWidth;

      for (let kernelIdxX = kernelStartIdxX; kernelIdxX < kernelEndIdxX; kernelIdxX++) {
        outArray[kernelIdxYOffs + kernelIdxX] =
          inArray[convolveIdxYOffs + kernelCenterConvolveIdxX + kernelIdxX];
      }
    }
  };

  /**
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} idx
   * @param {*} kernelArray
   * @param {*} kernelWidth
   * @param {*} kernelHeight
   * @returns
   */

  const _getConvolvedAreaDotProductInPlace = (
    inArray,
    width,
    height,
    idx,
    kernelArray,
    kernelWidth,
    kernelHeight
  ) => {
    const idxY = (idx / width) | 0;
    const idxX = idx - idxY * width;

    const halfkernelWidth = kernelWidth >> 1;
    const halfkernelHeight = kernelHeight >> 1;

    const kernelCenterConvolveIdxX = idxX - halfkernelWidth;
    const kernelCenterConvolveIdxY = idxY - halfkernelHeight;

    const kernelStartIdxY = Math.max(0, halfkernelHeight - idxY);
    const kernelEndIdxY = Math.min(kernelHeight, height + halfkernelHeight - idxY);

    const kernelStartIdxX = Math.max(0, halfkernelWidth - idxX);
    const kernelEndIdxX = Math.min(kernelWidth, width + halfkernelWidth - idxX);

    let total = 0;

    for (let kernelIdxY = kernelStartIdxY; kernelIdxY < kernelEndIdxY; kernelIdxY++) {
      const convolveIdxYOffs = (kernelCenterConvolveIdxY + kernelIdxY) * width;
      const kernelIdxYOffs = kernelIdxY * kernelWidth;

      for (let kernelIdxX = kernelStartIdxX; kernelIdxX < kernelEndIdxX; kernelIdxX++) {
        total +=
          inArray[convolveIdxYOffs + kernelCenterConvolveIdxX + kernelIdxX] *
          kernelArray[kernelIdxYOffs + kernelIdxX];
      }
    }

    return total;
  };

  /**
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} idx
   * @param {*} sigmaSample
   * @param {*} pNorm
   * @param {*} kernelArray
   * @param {*} kernelWidth
   * @param {*} kernelHeight
   * @returns
   */

  const _computeTotalEnergyGeorgevFajardoWrapAroundInPlace = (
    inArray,
    energyArray,
    width,
    height,
    sigmaSample,
    pNorm,
    kernelArray,
    kernelWidth,
    kernelHeight
  ) => {
    const halfKernelWidth = kernelWidth >> 1;
    const halfKernelHeight = kernelHeight >> 1;

    const invSigmaSample2 = 1 / (sigmaSample * sigmaSample);

    for (let idxY = 0; idxY < height; idxY++) {
      const idxYOffs = idxY * width;

      let baseConvolveIdxY = idxY - halfKernelHeight;
      if (baseConvolveIdxY < 0) baseConvolveIdxY = (baseConvolveIdxY + height) % height;

      for (let idxX = 0; idxX < width; idxX++) {
        const centerValue = inArray[idxYOffs + idxX];

        let baseConvolveIdxX = idxX - halfKernelWidth;
        if (baseConvolveIdxX < 0) baseConvolveIdxX = (baseConvolveIdxX + width) % width;

        let convolveIdxY = baseConvolveIdxY;
        let total = 0;

        for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
          const convolveIdxYOffs = convolveIdxY * width;
          const kernelIdxYOffs = kernelIdxY * kernelWidth;

          let convolveIdxX = baseConvolveIdxX;

          for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
            total +=
              kernelArray[kernelIdxYOffs + kernelIdxX] *
              Math.exp(
                -(
                  Math.abs(centerValue - inArray[convolveIdxYOffs + convolveIdxX]) ** pNorm *
                  invSigmaSample2
                )
              );

            if (++convolveIdxX === width) convolveIdxX = 0;
          }

          if (++convolveIdxY === height) convolveIdxY = 0;
        }

        energyArray[idxYOffs + idxX] = total;
      }
    }
  };

  /**
   *
   * @param {*} inArray
   * @param {*} width
   * @param {*} height
   * @param {*} idx
   * @param {*} sigmaSample
   * @param {*} pNorm
   * @param {*} kernelArray
   * @param {*} kernelWidth
   * @param {*} kernelHeight
   * @returns
   */

  const _computeEnergyGeorgevFajardoWrapAround = (
    inArray,
    width,
    height,
    idx,
    sigmaSample,
    pNorm,
    kernelArray,
    kernelWidth,
    kernelHeight
  ) => {
    const idxY = (idx / width) | 0;
    const idxX = idx - idxY * width;

    let convolveIdxY = idxY - (kernelHeight >> 1);
    if (convolveIdxY < 0) convolveIdxY = (convolveIdxY + height) % height;

    let baseConvolveIdxX = idxX - (kernelWidth >> 1);
    if (baseConvolveIdxX < 0) baseConvolveIdxX = (baseConvolveIdxX + width) % width;

    const invSigmaSample2 = 1 / (sigmaSample * sigmaSample);
    const centerConvolveIdx = inArray[idx];

    let total = 0;

    for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
      const convolveIdxYOffs = convolveIdxY * width;
      const kernelIdxYOffs = kernelIdxY * kernelWidth;

      let convolveIdxX = baseConvolveIdxX;

      for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
        total +=
          kernelArray[kernelIdxYOffs + kernelIdxX] *
          Math.exp(
            -(
              Math.abs(centerConvolveIdx - inArray[convolveIdxYOffs + convolveIdxX]) ** pNorm *
              invSigmaSample2
            )
          );

        if (++convolveIdxX === width) convolveIdxX = 0;
      }

      if (++convolveIdxY === height) convolveIdxY = 0;
    }

    return total;
  };

  /**
   * Voronoi diagram builder with out of bounds vertices
   * https://en.wikipedia.org/wiki/Voronoi_diagram
   *
   * @param {*} idxXArray
   * @param {*} idxYArray
   * @param {*} width
   * @param {*} height
   * @returns
   */

  const _buildVoronoiDiagramWrapAroundOutOfBounds = (idxXArray, idxYArray, width, height) => {
    const samples = idxXArray.length;
    const shiftsLength = candidateShifts.length;
    const initialBoundingPolygonVertices = initialBoundingPolygon.length;

    const voronoi = Array(samples);

    for (let sample = 0; sample < samples; sample++) {
      const sampleIdxX = idxXArray[sample];
      const sampleIdxY = idxYArray[sample];

      let polygon = Array(initialBoundingPolygonVertices);
      for (let i = 0; i < initialBoundingPolygonVertices; i++) {
        const currentVertex = initialBoundingPolygon[i];
        polygon[i] = [currentVertex[0] * width, currentVertex[1] * height];
      }

      for (let candidate = 0; candidate < samples; candidate++) {
        if (candidate === sample) continue;

        const candidateIdxX = idxXArray[candidate];
        const candidateIdxY = idxYArray[candidate];

        for (let shift = 0; shift < shiftsLength; shift++) {
          const currentShift = candidateShifts[shift];
          const shiftedCandidateIdxX = candidateIdxX + currentShift[0] * width;
          const shiftedCandidateIdxY = candidateIdxY + currentShift[1] * height;

          const newVerticesList = [];
          const verticesListLength = polygon.length;

          for (let vertex = 0; vertex < verticesListLength; vertex++) {
            const vertex0 = polygon[vertex];
            const vertex0IdxX = vertex0[0];
            const vertex0IdxY = vertex0[1];

            const vertex1 = polygon[vertex === verticesListLength - 1 ? 0 : vertex + 1];
            const vertex1IdxX = vertex1[0];
            const vertex1IdxY = vertex1[1];

            const distanceVertex0Diffs =
              (vertex0IdxX - sampleIdxX) ** 2 +
              (vertex0IdxY - sampleIdxY) ** 2 -
              (vertex0IdxX - shiftedCandidateIdxX) ** 2 -
              (vertex0IdxY - shiftedCandidateIdxY) ** 2;

            const distanceVertex1Diffs =
              (vertex1IdxX - sampleIdxX) ** 2 +
              (vertex1IdxY - sampleIdxY) ** 2 -
              (vertex1IdxX - shiftedCandidateIdxX) ** 2 -
              (vertex1IdxY - shiftedCandidateIdxY) ** 2;

            const denominator = distanceVertex0Diffs - distanceVertex1Diffs;
            if (denominator === 0) continue;

            if (distanceVertex0Diffs <= 0) {
              if (distanceVertex1Diffs <= 0) newVerticesList.push(vertex1);
              else {
                const interpolation = distanceVertex0Diffs / denominator;

                newVerticesList.push([
                  vertex0IdxX + (vertex1IdxX - vertex0IdxX) * interpolation,
                  vertex0IdxY + (vertex1IdxY - vertex0IdxY) * interpolation,
                ]);
              }
            } else if (distanceVertex0Diffs > 0 && distanceVertex1Diffs <= 0) {
              const interpolation = distanceVertex0Diffs / denominator;

              newVerticesList.push([
                vertex0IdxX + (vertex1IdxX - vertex0IdxX) * interpolation,
                vertex0IdxY + (vertex1IdxY - vertex0IdxY) * interpolation,
              ]);

              newVerticesList.push(vertex1);
            }
          }

          polygon = newVerticesList;
          if (polygon.length === 0) break;
        }
      }

      voronoi[sample] = polygon;
    }

    return voronoi;
  };

  /**
   * Delaunay triangles builder with out of bounds vertices
   * https://en.wikipedia.org/wiki/Delaunay_triangulation
   * Brute force version
   *
   * @param {*} idxXArray
   * @param {*} idxYArray
   * @param {*} width
   * @param {*} height
   * @returns
   */

  const _buildDelaunayTrianglesSimple = (idxXArray, idxYArray, width, height) => {
    throw new Error(
      "This Delaunay triangle builder is for educational purposes only, you can run it anyway but it is very slow. Consider using the optimized version.\n" +
        "This Delaunay triangle builder will not be removed."
    );

    const samples = idxXArray.length;

    const halfWidth = width * 0.5;
    const halfHeight = height * 0.5;

    const delaunay = [];

    for (let sample = 0; sample < samples - 2; sample++) {
      // A
      const sampleIdxX = idxXArray[sample];
      const sampleIdxY = idxYArray[sample];

      for (let candidate0 = sample + 1; candidate0 < samples - 1; candidate0++) {
        // B
        let candidate0IdxX = idxXArray[candidate0];
        let candidate0IdxY = idxYArray[candidate0];

        let distanceCandidate0SampleX = candidate0IdxX - sampleIdxX;
        let distanceCandidate0SampleY = candidate0IdxY - sampleIdxY;

        if (distanceCandidate0SampleX > halfWidth) candidate0IdxX -= width;
        else if (distanceCandidate0SampleX < -halfWidth) candidate0IdxX += width;

        if (distanceCandidate0SampleY > halfHeight) candidate0IdxY -= height;
        else if (distanceCandidate0SampleY < -halfHeight) candidate0IdxY += height;

        // Recompute distances with toroidal candidates indexes
        distanceCandidate0SampleX = candidate0IdxX - sampleIdxX;
        distanceCandidate0SampleY = candidate0IdxY - sampleIdxY;

        for (let candidate1 = candidate0 + 1; candidate1 < samples; candidate1++) {
          // C
          let candidate1IdxX = idxXArray[candidate1];
          let candidate1IdxY = idxYArray[candidate1];

          let distanceCandidate1SampleX = candidate1IdxX - sampleIdxX;
          let distanceCandidate1SampleY = candidate1IdxY - sampleIdxY;

          if (distanceCandidate1SampleX > halfWidth) candidate1IdxX -= width;
          else if (distanceCandidate1SampleX < -halfWidth) candidate1IdxX += width;

          if (distanceCandidate1SampleY > halfHeight) candidate1IdxY -= height;
          else if (distanceCandidate1SampleY < -halfHeight) candidate1IdxY += height;

          distanceCandidate1SampleX = candidate1IdxX - sampleIdxX;
          distanceCandidate1SampleY = candidate1IdxY - sampleIdxY;

          const RHSAB =
            distanceCandidate0SampleX * (sampleIdxX + candidate0IdxX) +
            distanceCandidate0SampleY * (sampleIdxY + candidate0IdxY);

          const RHSAC =
            distanceCandidate1SampleX * (sampleIdxX + candidate1IdxX) +
            distanceCandidate1SampleY * (sampleIdxY + candidate1IdxY);

          const G =
            2 *
            (distanceCandidate0SampleX * (candidate1IdxY - candidate0IdxY) -
              distanceCandidate0SampleY * (candidate1IdxX - candidate0IdxX));

          const circumcenterX =
            (distanceCandidate1SampleY * RHSAB - distanceCandidate0SampleY * RHSAC) / G;
          const circumcenterY =
            (distanceCandidate0SampleX * RHSAC - distanceCandidate1SampleX * RHSAB) / G;

          const circleRadius =
            (circumcenterX - sampleIdxX) ** 2 + (circumcenterY - sampleIdxY) ** 2;

          let empty = true;
          for (let otherSample = 0; otherSample < samples; otherSample++) {
            if (
              otherSample === sample ||
              otherSample === candidate0 ||
              otherSample === candidate1
            ) {
              continue;
            }

            let distanceX = idxXArray[otherSample] - circumcenterX;
            let distanceY = idxYArray[otherSample] - circumcenterY;

            if (distanceX < 0) distanceX = -distanceX;
            if (distanceY < 0) distanceY = -distanceY;

            if (distanceX > halfWidth) distanceX = width - distanceX;
            if (distanceY > halfHeight) distanceY = height - distanceY;

            if (distanceX * distanceX + distanceY * distanceY < circleRadius) {
              empty = false;
              break;
            }
          }

          if (empty) {
            delaunay.push([
              [sampleIdxX, sampleIdxY],
              [candidate0IdxX, candidate0IdxY],
              [candidate1IdxX, candidate1IdxY],
            ]);
          }
        }
      }
    }

    return delaunay;
  };

  /**
   *
   * @param {*} idxXArray
   * @param {*} idxYArray
   * @param {*} width
   * @param {*} height
   * @returns
   */

  const _buildDelaunayTrianglesBowyerWatsonWrapAroundOutOfBounds = (
    idxXArray,
    idxYArray,
    width,
    height
  ) => {
    const samples = idxXArray.length;
    const shiftsLength = candidateShifts.length;

    const minIdxX = -width - 1;
    const maxIdxX = width * 2 + 1;
    const minIdxY = -height - 1;
    const maxIdxY = height * 2 + 1;
    const deltaMax = Math.max(maxIdxX - minIdxX, maxIdxY - minIdxY);

    const triangleList = [
      [
        [minIdxX - deltaMax, minIdxY - deltaMax],
        [minIdxX + 3 * deltaMax, minIdxY - deltaMax],
        [minIdxX - deltaMax, minIdxY + 3 * deltaMax],
      ],
    ];

    const extendedSampleSet = [];

    for (let sample = 0; sample < samples; sample++) {
      const sampleIdxX = idxXArray[sample];
      const sampleIdxY = idxYArray[sample];

      extendedSampleSet.push([sampleIdxX, sampleIdxY, true]);

      for (let shift = 1; shift < shiftsLength; shift++) {
        const currentShift = candidateShifts[shift];

        extendedSampleSet.push([
          sampleIdxX + currentShift[0] * width,
          sampleIdxY + currentShift[1] * height,
        ]);
      }
    }

    for (
      let extendedSample = extendedSampleSet.length - 1;
      extendedSample >= 0;
      extendedSample--
    ) {
      const currentExtendedSample = extendedSampleSet[extendedSample];
      const currentExtendedSampleIdxX = currentExtendedSample[0];
      const currentExtendedSampleIdxY = currentExtendedSample[1];

      const badTriangles = [];
      for (let i = triangleList.length - 1; i >= 0; i--) {
        const currentTriangle = triangleList[i];

        // A
        const vertex0 = currentTriangle[0];
        // B
        const vertex1 = currentTriangle[1];
        // C
        const vertex2 = currentTriangle[2];

        const distanceAPX = vertex0[0] - currentExtendedSampleIdxX;
        const distanceAPY = vertex0[1] - currentExtendedSampleIdxY;

        const distanceBPX = vertex1[0] - currentExtendedSampleIdxX;
        const distanceBPY = vertex1[1] - currentExtendedSampleIdxY;

        const distanceCPX = vertex2[0] - currentExtendedSampleIdxX;
        const distanceCPY = vertex2[1] - currentExtendedSampleIdxY;

        if (
          (distanceAPX * distanceAPX + distanceAPY * distanceAPY) *
            (distanceBPX * distanceCPY - distanceCPX * distanceBPY) +
            (distanceBPX * distanceBPX + distanceBPY * distanceBPY) *
              (distanceCPX * distanceAPY - distanceAPX * distanceCPY) +
            (distanceCPX * distanceCPX + distanceCPY * distanceCPY) *
              (distanceAPX * distanceBPY - distanceBPX * distanceAPY) >
          0
        ) {
          badTriangles.push(currentTriangle);
          triangleList.splice(i, 1);
        }
      }

      const badTriangleEdges = [];
      for (let triangle = badTriangles.length - 1; triangle >= 0; triangle--) {
        const currentBadTriangle = badTriangles[triangle];

        const vertex0 = currentBadTriangle[0];
        const vertex1 = currentBadTriangle[1];
        const vertex2 = currentBadTriangle[2];

        badTriangleEdges.push([vertex0, vertex1]);
        badTriangleEdges.push([vertex1, vertex2]);
        badTriangleEdges.push([vertex2, vertex0]);
      }

      const boundary = [];
      const edges = badTriangleEdges.length;

      for (let edge0 = 0; edge0 < edges; edge0++) {
        let isSharedEdge = false;

        const currentEdge0 = badTriangleEdges[edge0];
        const currentEdge0Vertex0 = currentEdge0[0];
        const currentEdge0Vertex0IdxX = currentEdge0Vertex0[0];
        const currentEdge0Vertex0IdxY = currentEdge0Vertex0[1];

        const currentEdge0Vertex1 = currentEdge0[1];
        const currentEdge0Vertex1IdxX = currentEdge0Vertex1[0];
        const currentEdge0Vertex1IdxY = currentEdge0Vertex1[1];

        for (let edge1 = 0; edge1 < edges; edge1++) {
          if (edge0 === edge1) continue;

          const currentEdge1 = badTriangleEdges[edge1];
          const currentEdge1Vertex0 = currentEdge1[0];
          const currentEdge1Vertex0IdxX = currentEdge1Vertex0[0];
          const currentEdge1Vertex0IdxY = currentEdge1Vertex0[1];

          const currentEdge1Vertex1 = currentEdge1[1];
          const currentEdge1Vertex1IdxX = currentEdge1Vertex1[0];
          const currentEdge1Vertex1IdxY = currentEdge1Vertex1[1];

          if (
            (currentEdge0Vertex0IdxX === currentEdge1Vertex0IdxX &&
              currentEdge0Vertex0IdxY === currentEdge1Vertex0IdxY &&
              currentEdge0Vertex1IdxX === currentEdge1Vertex1IdxX &&
              currentEdge0Vertex1IdxY === currentEdge1Vertex1IdxY) ||
            (currentEdge0Vertex0IdxX === currentEdge1Vertex1IdxX &&
              currentEdge0Vertex0IdxY === currentEdge1Vertex1IdxY &&
              currentEdge0Vertex1IdxX === currentEdge1Vertex0IdxX &&
              currentEdge0Vertex1IdxY === currentEdge1Vertex0IdxY)
          ) {
            isSharedEdge = true;
            break;
          }
        }

        if (!isSharedEdge) boundary.push(currentEdge0);
      }

      for (let i = boundary.length - 1; i >= 0; i--) {
        const currentBoundary = boundary[i];
        triangleList.push([currentBoundary[0], currentBoundary[1], currentExtendedSample]);
      }
    }

    for (let triangle = triangleList.length - 1; triangle >= 0; triangle--) {
      const currentTriangle = triangleList[triangle];

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
  };

  const _delaunayTrianglesBowyerWatsonFilter = (triangleList, width, height) => {
    const delaunay = [];

    for (let triangle = triangleList.length - 1; triangle >= 0; triangle--) {
      const currentTriangle = triangleList[triangle];

      const vertex0 = currentTriangle[0];
      const vertex1 = currentTriangle[1];
      const vertex2 = currentTriangle[2];

      if (vertex0[2] || vertex1[2] || vertex2[2]) {
        const vertex0IdxX = vertex0[0];
        const vertex0IdxY = vertex0[1];

        const vertex1IdxX = vertex1[0];
        const vertex1IdxY = vertex1[1];

        const vertex2IdxX = vertex2[0];
        const vertex2IdxY = vertex2[1];

        const centerIdxX = (vertex0IdxX + vertex1IdxX + vertex2IdxX) / 3;
        const centerIdxY = (vertex0IdxY + vertex1IdxY + vertex2IdxY) / 3;

        if (centerIdxX >= 0 && centerIdxX < width && centerIdxY >= 0 && centerIdxY < height) {
          delaunay.push([
            [vertex0IdxX, vertex0IdxY],
            [vertex1IdxX, vertex1IdxY],
            [vertex2IdxX, vertex2IdxY],
          ]);
        }
      }
    }

    return delaunay;
  };

  return {
    shuffle: _shuffle,

    convolveWrapAroundInPlace: _convolveWrapAroundInPlace,
    convolveAddWrapAroundInPlace: _convolveAddWrapAroundInPlace,
    getConvolvedAreaWrapAroundInPlace: _getConvolvedAreaWrapAroundInPlace,
    getConvolvedAreaDotProductWrapAroundInPlace: _getConvolvedAreaDotProductWrapAroundInPlace,

    convolveInPlace: _convolveInPlace,
    convolveAddInPlace: _convolveAddInPlace,
    getConvolvedAreaInPlace: _getConvolvedAreaInPlace,
    getConvolvedAreaDotProductInPlace: _getConvolvedAreaDotProductInPlace,

    computeTotalEnergyGeorgevFajardoWrapAroundInPlace:
      _computeTotalEnergyGeorgevFajardoWrapAroundInPlace,
    computeEnergyGeorgevFajardoWrapAround: _computeEnergyGeorgevFajardoWrapAround,

    buildVoronoiDiagramWrapAroundOutOfBounds: _buildVoronoiDiagramWrapAroundOutOfBounds,

    buildDelaunayTrianglesBowyerWatsonWrapAroundOutOfBounds:
      _buildDelaunayTrianglesBowyerWatsonWrapAroundOutOfBounds,
    delaunayTrianglesBowyerWatsonFilter: _delaunayTrianglesBowyerWatsonFilter,
  };
})();
