/**
 * Free JS implementation of Void and Cluster method by Robert Ulichney and other methods
 * Remember to link this script
 *
 * v0.2.8
 * https://github.com/901D3/blue-noise.js
 *
 * Copyright (c) 901D3
 * This code is licensed with GPLv3 license
 */

"use strict";

const BlueNoiseUtils = (function () {
  const voronoiCandidateShifts = [
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
  const voronoiInitialBoundingPolygon = [
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
    const halfkernelWidth = kernelWidth >> 1;
    const halfkernelHeight = kernelHeight >> 1;

    for (let idxY = 0; idxY < height; idxY++) {
      const yOffs = idxY * width;
      const currentKernelCenteredIdxY = idxY - halfkernelHeight;

      for (let idxX = 0; idxX < width; idxX++) {
        const currentKernelCenteredIdxX = idxX - halfkernelWidth;
        let total = 0;

        for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
          const kernelIdxYOffs = kernelIdxY * kernelWidth;
          const convolveIdxYOffs =
            ((kernelIdxY + currentKernelCenteredIdxY + height) % height) * width;

          for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
            total +=
              inArray[
                convolveIdxYOffs + ((kernelIdxX + currentKernelCenteredIdxX + width) % width)
              ] * kernelArray[kernelIdxYOffs + kernelIdxX];
          }
        }

        blurredArray[yOffs + idxX] = total;
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
    const idxX = idx % width;
    const idxY = (idx / width) | 0;

    const currentKernelCenteredIdxX = idxX - (kernelWidth >> 1);
    const currentKernelCenteredIdxY = idxY - (kernelHeight >> 1);

    for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
      const kernelIdxYOffs = kernelIdxY * kernelWidth;
      const convolveIdxYOffs =
        ((kernelIdxY + currentKernelCenteredIdxY + height) % height) * width;

      for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
        blurredArray[
          convolveIdxYOffs + ((kernelIdxX + currentKernelCenteredIdxX + width) % width)
        ] += kernelArray[kernelIdxYOffs + kernelIdxX] * amount;
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

  const _getConvolvedAreaWrapAroundInPlace = (
    inArray,
    width,
    height,
    idx,
    outArray,
    kernelWidth,
    kernelHeight
  ) => {
    const idxX = idx % width;
    const idxY = (idx / width) | 0;

    const currentKernelCenteredIdxX = idxX - (kernelWidth >> 1);
    const currentKernelCenteredIdxY = idxY - (kernelHeight >> 1);

    for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
      const kernelIdxYOffs = kernelIdxY * kernelWidth;
      const convolveIdxYOffs =
        ((kernelIdxY + currentKernelCenteredIdxY + height) % height) * width;

      for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
        outArray[kernelIdxYOffs + kernelIdxX] =
          inArray[
            convolveIdxYOffs + ((kernelIdxX + currentKernelCenteredIdxX + width) % width)
          ];
      }
    }
  };

  const _getConvolvedAreaDotProductWrapAroundInPlace = (
    inArray,
    width,
    height,
    idx,
    kernelArray,
    kernelWidth,
    kernelHeight
  ) => {
    const idxX = idx % width;
    const idxY = (idx / width) | 0;

    const currentKernelCenteredIdxX = idxX - (kernelWidth >> 1);
    const currentKernelCenteredIdxY = idxY - (kernelHeight >> 1);

    let total = 0;

    for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
      const kernelIdxYOffs = kernelIdxY * kernelWidth;
      const convolveIdxYOffs =
        ((kernelIdxY + currentKernelCenteredIdxY + height) % height) * width;

      for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
        total +=
          inArray[
            convolveIdxYOffs + ((kernelIdxX + currentKernelCenteredIdxX + width) % width)
          ] * kernelArray[kernelIdxYOffs + kernelIdxX];
      }
    }

    return total;
  };

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
      const currentKernelCenteredIdxY = idxY - halfkernelHeight;

      for (let idxX = 0; idxX < width; idxX++) {
        const currentKernelCenteredIdxX = idxX - halfkernelWidth;
        let total = 0;

        for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
          const convolveIdxY = kernelIdxY + currentKernelCenteredIdxY;
          if (convolveIdxY < 0 || convolveIdxY >= height) continue;

          const convolveIdxYOffs = convolveIdxY * width;
          const kernelIdxYOffs = kernelIdxY * kernelWidth;

          for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
            const convolveIdxX = kernelIdxX + currentKernelCenteredIdxX;
            if (convolveIdxX < 0 || convolveIdxX >= width) continue;

            total +=
              inArray[convolveIdxYOffs + convolveIdxX] *
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
    const idxX = idx % width;
    const idxY = (idx / width) | 0;

    const currentKernelCenteredIdxX = idxX - (kernelWidth >> 1);
    const currentKernelCenteredIdxY = idxY - (kernelHeight >> 1);

    for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
      const convolveIdxY = kernelIdxY + currentKernelCenteredIdxY;
      if (convolveIdxY < 0 || convolveIdxY >= height) continue;

      const kernelIdxYOffs = kernelIdxY * kernelWidth;
      const convolveIdxYOffs = convolveIdxY * width;

      for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
        const convolveIdxX = kernelIdxX + currentKernelCenteredIdxX;
        if (convolveIdxX < 0 || convolveIdxX >= width) continue;

        blurredArray[convolveIdxYOffs + convolveIdxX] +=
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
    const idxX = idx % width;
    const idxY = (idx / width) | 0;

    const currentKernelCenteredIdxX = idxX - (kernelWidth >> 1);
    const currentKernelCenteredIdxY = idxY - (kernelHeight >> 1);

    for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
      const kernelIdxYOffs = kernelIdxY * kernelWidth;
      const convolveIdxY = kernelIdxY + currentKernelCenteredIdxY;
      if (convolveIdxY < 0 || convolveIdxY >= height) continue;

      const convolveIdxYOffs = convolveIdxY * width;

      for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
        const convolveIdxX = kernelIdxX + currentKernelCenteredIdxX;
        if (convolveIdxX < 0 || convolveIdxX >= width) continue;

        outArray[kernelIdxYOffs + kernelIdxX] = inArray[convolveIdxYOffs + convolveIdxX];
      }
    }
  };

  const _getConvolvedAreaDotProductInPlace = (
    inArray,
    width,
    height,
    idx,
    kernelArray,
    kernelWidth,
    kernelHeight
  ) => {
    const idxX = idx % width;
    const idxY = (idx / width) | 0;

    const currentKernelCenteredIdxX = idxX - (kernelWidth >> 1);
    const currentKernelCenteredIdxY = idxY - (kernelHeight >> 1);

    let total = 0;

    for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
      const kernelIdxYOffs = kernelIdxY * kernelWidth;
      const convolveIdxY = kernelIdxY + currentKernelCenteredIdxY;
      if (convolveIdxY < 0 || convolveIdxY >= height) continue;

      const convolveIdxYOffs = convolveIdxY * width;

      for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
        const convolveIdxX = kernelIdxX + currentKernelCenteredIdxX;
        if (convolveIdxX < 0 || convolveIdxX >= width) continue;

        total +=
          inArray[convolveIdxYOffs + convolveIdxX] * kernelArray[kernelIdxYOffs + kernelIdxX];
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
    const halfkernelWidth = kernelWidth >> 1;
    const halfkernelHeight = kernelHeight >> 1;

    const invSigmaSample2 = 1 / (sigmaSample * sigmaSample);

    for (let idxY = 0; idxY < height; idxY++) {
      const yOffs = idxY * width;
      const currentKernelCenteredIdxY = idxY - halfkernelHeight;

      for (let idxX = 0; idxX < width; idxX++) {
        const currentKernelCenteredIdxX = idxX - halfkernelWidth;
        const centerConvolveIdx = inArray[yOffs + idxX];
        let total = 0;

        for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
          const kernelIdxYOffs = kernelIdxY * kernelWidth;
          const convolveIdxYOffs =
            ((kernelIdxY + currentKernelCenteredIdxY + height) % height) * width;

          for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
            let convolveIdxX = (kernelIdxX + currentKernelCenteredIdxX) % width;
            if (convolveIdxX < 0) convolveIdxX += width;

            total +=
              kernelArray[kernelIdxYOffs + kernelIdxX] *
              Math.exp(
                -(
                  Math.abs(centerConvolveIdx - inArray[convolveIdxYOffs + convolveIdxX]) **
                    pNorm *
                  invSigmaSample2
                )
              );
          }
        }

        energyArray[yOffs + idxX] = total;
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
    const idxX = idx % width;
    const idxY = (idx / width) | 0;

    const currentKernelCenteredIdxX = idxX - (kernelWidth >> 1);
    const currentKernelCenteredIdxY = idxY - (kernelHeight >> 1);

    const invSigmaSample2 = 1 / (sigmaSample * sigmaSample);
    const centerConvolveIdx = inArray[idx];

    let total = 0;

    for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
      const kernelIdxYOffs = kernelIdxY * kernelWidth;
      const convolveIdxYOffs =
        ((kernelIdxY + currentKernelCenteredIdxY + height) % height) * width;

      for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
        total +=
          kernelArray[kernelIdxYOffs + kernelIdxX] *
          -(
            Math.abs(
              centerConvolveIdx -
                inArray[
                  convolveIdxYOffs + ((kernelIdxX + currentKernelCenteredIdxX + width) % width)
                ]
            ) **
              pNorm *
            invSigmaSample2
          );
      }
    }

    return total;
  };

  const _computeEnergyWrapAround = (
    inArray,
    width,
    height,
    kernelArray,
    kernelWidth,
    kernelHeight
  ) => {
    const halfkernelWidth = kernelWidth >> 1;
    const halfkernelHeight = kernelHeight >> 1;

    let totalEnergy = 0;

    for (let idxY = 0; idxY < height; idxY++) {
      const currentKernelCenteredIdxY = idxY - halfkernelHeight;

      for (let idxX = 0; idxX < width; idxX++) {
        const currentKernelCenteredIdxX = idxX - halfkernelWidth;
        let total = 0;

        for (let kernelIdxY = 0; kernelIdxY < kernelHeight; kernelIdxY++) {
          const kernelIdxYOffs = kernelIdxY * kernelWidth;
          const convolveIdxYOffs =
            ((kernelIdxY + currentKernelCenteredIdxY + height) % height) * width;

          for (let kernelIdxX = 0; kernelIdxX < kernelWidth; kernelIdxX++) {
            total +=
              inArray[
                convolveIdxYOffs + ((kernelIdxX + currentKernelCenteredIdxX + width) % width)
              ] * kernelArray[kernelIdxYOffs + kernelIdxX];
          }
        }

        totalEnergy += total * total;
      }
    }

    return totalEnergy;
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
    const shiftsLength = voronoiCandidateShifts.length;
    const initialBoundingPolygonVertices = voronoiInitialBoundingPolygon.length;

    const voronoi = Array(samples);

    for (let sample = 0; sample < samples; sample++) {
      const sampleIdxX = idxXArray[sample];
      const sampleIdxY = idxYArray[sample];

      let polygon = [];
      for (let i = 0; i < initialBoundingPolygonVertices; i++) {
        const currentVertex = voronoiInitialBoundingPolygon[i];

        polygon[i] = [currentVertex[0] * width, currentVertex[1] * height, -1];
      }

      for (let candidate = 0; candidate < samples; candidate++) {
        if (candidate === sample) continue;

        const candidateIdxX = idxXArray[candidate];
        const candidateIdxY = idxYArray[candidate];

        for (let shift = 0; shift < shiftsLength; shift++) {
          const currentShift = voronoiCandidateShifts[shift];
          const shiftedCandidateIdxX = candidateIdxX + currentShift[0] * width;
          const shiftedCandidateIdxY = candidateIdxY + currentShift[1] * height;

          const newVerticesList = [];
          const verticesListLength = polygon.length;

          for (let vertex = 0; vertex < verticesListLength; vertex++) {
            const voronoiVertex = polygon[vertex];
            const voronoiVertexIdxX = voronoiVertex[0];
            const voronoiVertexIdxY = voronoiVertex[1];

            const vertex2 = polygon[(vertex + 1) % verticesListLength];
            const vertex2IdxX = vertex2[0];
            const vertex2IdxY = vertex2[1];

            const distanceVoronoiVertex1Diffs =
              (voronoiVertexIdxX - sampleIdxX) ** 2 +
              (voronoiVertexIdxY - sampleIdxY) ** 2 -
              (voronoiVertexIdxX - shiftedCandidateIdxX) ** 2 -
              (voronoiVertexIdxY - shiftedCandidateIdxY) ** 2;

            const distanceVoronoiVertex2Diffs =
              (vertex2IdxX - sampleIdxX) ** 2 +
              (vertex2IdxY - sampleIdxY) ** 2 -
              (vertex2IdxX - shiftedCandidateIdxX) ** 2 -
              (vertex2IdxY - shiftedCandidateIdxY) ** 2;

            if (distanceVoronoiVertex1Diffs < 0) {
              if (distanceVoronoiVertex2Diffs < 0) newVerticesList.push(vertex2);
              else {
                const interpolation =
                  distanceVoronoiVertex1Diffs /
                  (distanceVoronoiVertex1Diffs - distanceVoronoiVertex2Diffs);

                newVerticesList.push([
                  voronoiVertexIdxX + (vertex2IdxX - voronoiVertexIdxX) * interpolation,
                  voronoiVertexIdxY + (vertex2IdxY - voronoiVertexIdxY) * interpolation,
                  candidate,
                ]);
              }
            } else if (distanceVoronoiVertex1Diffs >= 0 && distanceVoronoiVertex2Diffs < 0) {
              const interpolation =
                distanceVoronoiVertex1Diffs /
                (distanceVoronoiVertex1Diffs - distanceVoronoiVertex2Diffs);

              newVerticesList.push([
                voronoiVertexIdxX + (vertex2IdxX - voronoiVertexIdxX) * interpolation,
                voronoiVertexIdxY + (vertex2IdxY - voronoiVertexIdxY) * interpolation,
                candidate,
              ]);

              newVerticesList.push(vertex2);
            }
          }

          polygon = newVerticesList;
        }
      }

      voronoi[sample] = [polygon, sample];
    }

    return voronoi;
  };

  /**
   * Delaunay triangles builder with out of bounds vertices
   * https://en.wikipedia.org/wiki/Delaunay_triangulation
   *
   * @param {*} idxXArray
   * @param {*} idxYArray
   * @param {*} width
   * @param {*} height
   * @returns
   */

  const _buildDelaunayTrianglesWrapAroundOutOfBounds = (
    idxXArray,
    idxYArray,
    width,
    height
  ) => {
    const samples = idxXArray.length;
    const delaunay = [];

    const halfWidth = width * 0.5;
    const halfHeight = height * 0.5;

    for (let sample = 0; sample < samples - 2; sample++) {
      // A
      const sampleIdxX = idxXArray[sample];
      const sampleIdxY = idxYArray[sample];

      for (let candidate1 = sample + 1; candidate1 < samples - 1; candidate1++) {
        // B
        let candidate1IdxX = idxXArray[candidate1];
        let candidate1IdxY = idxYArray[candidate1];

        let distanceCandidate1SampleX = candidate1IdxX - sampleIdxX;
        let distanceCandidate1SampleY = candidate1IdxY - sampleIdxY;

        if (distanceCandidate1SampleX > halfWidth) candidate1IdxX -= width;
        else if (distanceCandidate1SampleX < -halfWidth) candidate1IdxX += width;

        if (distanceCandidate1SampleY > halfHeight) candidate1IdxY -= height;
        else if (distanceCandidate1SampleY < -halfHeight) candidate1IdxY += height;

        // Recompute distances with toroidal candidates indexes
        distanceCandidate1SampleX = candidate1IdxX - sampleIdxX;
        distanceCandidate1SampleY = candidate1IdxY - sampleIdxY;

        for (let candidate2 = candidate1 + 1; candidate2 < samples; candidate2++) {
          // C
          let candidate2IdxX = idxXArray[candidate2];
          let candidate2IdxY = idxYArray[candidate2];

          let distanceCandidate2SampleX = candidate2IdxX - sampleIdxX;
          let distanceCandidate2SampleY = candidate2IdxY - sampleIdxY;

          if (distanceCandidate2SampleX > halfWidth) candidate2IdxX -= width;
          else if (distanceCandidate2SampleX < -halfWidth) candidate2IdxX += width;

          if (distanceCandidate2SampleY > halfHeight) candidate2IdxY -= height;
          else if (distanceCandidate2SampleY < -halfHeight) candidate2IdxY += height;

          distanceCandidate2SampleX = candidate2IdxX - sampleIdxX;
          distanceCandidate2SampleY = candidate2IdxY - sampleIdxY;

          const RHSAB =
            distanceCandidate1SampleX * (sampleIdxX + candidate1IdxX) +
            distanceCandidate1SampleY * (sampleIdxY + candidate1IdxY);

          const RHSAC =
            distanceCandidate2SampleX * (sampleIdxX + candidate2IdxX) +
            distanceCandidate2SampleY * (sampleIdxY + candidate2IdxY);

          const G =
            2 *
            (distanceCandidate1SampleX * (candidate2IdxY - candidate1IdxY) -
              distanceCandidate1SampleY * (candidate2IdxX - candidate1IdxX));

          const circumcenterX =
            (distanceCandidate2SampleY * RHSAB - distanceCandidate1SampleY * RHSAC) / G;
          const circumcenterY =
            (distanceCandidate1SampleX * RHSAC - distanceCandidate2SampleX * RHSAB) / G;

          const circleRadius =
            (circumcenterX - sampleIdxX) ** 2 + (circumcenterY - sampleIdxY) ** 2;

          let empty = true;
          for (let otherSample = 0; otherSample < samples; otherSample++) {
            if (
              otherSample === sample ||
              otherSample === candidate1 ||
              otherSample === candidate2
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
              [candidate1IdxX, candidate1IdxY],
              [candidate2IdxX, candidate2IdxY],
            ]);
          }
        }
      }
    }

    return delaunay;
  };

  /**
   * Without toroidal
   *
   * @param {*} idxXArray
   * @param {*} idxYArray
   * @returns
   */

  const _buildDelaunayTriangles = (idxXArray, idxYArray) => {
    const samples = idxXArray.length;
    const delaunay = [];

    for (let sample = 0; sample < samples - 2; sample++) {
      const sampleIdxX = idxXArray[sample];
      const sampleIdxY = idxYArray[sample];

      for (let candidate1 = sample + 1; candidate1 < samples - 1; candidate1++) {
        const candidate1IdxX = idxXArray[candidate1];
        const candidate1IdxY = idxYArray[candidate1];

        const distanceCandidate1SampleX = candidate1IdxX - sampleIdxX;
        const distanceCandidate1SampleY = candidate1IdxY - sampleIdxY;

        for (let candidate2 = candidate1 + 1; candidate2 < samples; candidate2++) {
          const candidate2IdxX = idxXArray[candidate2];
          const candidate2IdxY = idxYArray[candidate2];

          const distanceCandidate2SampleX = candidate2IdxX - sampleIdxX;
          const distanceCandidate2SampleY = candidate2IdxY - sampleIdxY;

          const RHSAB =
            distanceCandidate1SampleX * (sampleIdxX + candidate1IdxX) +
            distanceCandidate1SampleY * (sampleIdxY + candidate1IdxY);

          const RHSAC =
            distanceCandidate2SampleX * (sampleIdxX + candidate2IdxX) +
            distanceCandidate2SampleY * (sampleIdxY + candidate2IdxY);

          const G =
            2 *
            (distanceCandidate1SampleX * (candidate2IdxY - candidate1IdxY) -
              distanceCandidate1SampleY * (candidate2IdxX - candidate1IdxX));

          const circumcenterX =
            (distanceCandidate2SampleY * RHSAB - distanceCandidate1SampleY * RHSAC) / G;
          const circumcenterY =
            (distanceCandidate1SampleX * RHSAC - distanceCandidate2SampleX * RHSAB) / G;

          const circleRadius =
            (circumcenterX - sampleIdxX) ** 2 + (circumcenterY - sampleIdxY) ** 2;

          let empty = true;
          for (let otherSample = 0; otherSample < samples; otherSample++) {
            if (
              otherSample === sample ||
              otherSample === candidate1 ||
              otherSample === candidate2
            ) {
              continue;
            }

            let distanceX = idxXArray[otherSample] - circumcenterX;
            let distanceY = idxYArray[otherSample] - circumcenterY;

            if (distanceX < 0) distanceX = -distanceX;
            if (distanceY < 0) distanceY = -distanceY;

            if (distanceX * distanceX + distanceY * distanceY < circleRadius) {
              empty = false;
              break;
            }
          }

          if (empty) {
            delaunay.push([
              [sampleIdxX, sampleIdxY],
              [candidate1IdxX, candidate1IdxY],
              [candidate2IdxX, candidate2IdxY],
            ]);
          }
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

    computeEnergyWrapAround: _computeEnergyWrapAround,

    buildVoronoiDiagramWrapAroundOutOfBounds: _buildVoronoiDiagramWrapAroundOutOfBounds,

    buildDelaunayTrianglesWrapAroundOutOfBounds: _buildDelaunayTrianglesWrapAroundOutOfBounds,
    buildDelaunayTriangles: _buildDelaunayTriangles,
  };
})();
