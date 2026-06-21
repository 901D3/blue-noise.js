
const bnCanvas = document.getElementById("BNCanvas");
const bnCtx = bnCanvas.getContext("2d");
let result;

function findHighest(matrix) {
  let value = -Infinity;

  for (let i = matrix.length - 1; i >= 0; i--) {
    const v = matrix[i];
    if (v > value) value = v;
  }

  return value;
}

function findLowest(matrix) {
  let value = Infinity;

  for (let i = matrix.length - 1; i >= 0; i--) {
    const v = matrix[i];
    if (v < value) value = v;
  }

  return value;
}

function blueNoiseWrapper() {
  const bnWidth = Number(document.getElementById("BNWidth").value);
  const bnHeight = Number(document.getElementById("BNHeight").value);
  bnCanvas.width = bnWidth;
  bnCanvas.height = bnHeight;

  const sqSz = bnWidth * bnHeight;

  const bnAlgo = document.getElementById("BNAlgo").value;

  const sigma = Number(document.getElementById("BNSigma1").value);
  const sampleCount = Number(document.getElementById("BNSamples").value);
  const targetSamples = Number(document.getElementById("BNTargetSamples").value);
  const sigma1 = Number(document.getElementById("BNSigma1").value);
  const sigma2 = Number(document.getElementById("BNSigma2").value);
  const iterationCount = Number(document.getElementById("BNIterations").value);
  const pNorm = Number(document.getElementById("BNPNorm").value);
  const stepScale = Number(document.getElementById("BNStepScale").value);
  const radiusMul = document.getElementById("BNRadiusMul").value * sigma;

  const MBCCandidates = Number(document.getElementById("BNMBCCandidates").value);

  const t0 = performance.now();

  const sampleList = new Float64Array(sampleCount * 2);

  let kernel = null;
  let kWidth;
  let kHeight;

  const blurMap = new Float64Array(sqSz);

  if (document.getElementById("BNCustomKernel").value) {
    kernel = JSON.parse(document.getElementById("BNCustomKernel").value);
    kWidth = kernel[0].length;
    kHeight = kernel.length;
  }
  else {
    kWidth = Math.ceil(radiusMul * sigma) * 2 + 1;
    kHeight = kWidth;

    kernel = new Float64Array(kWidth ** 2);
    BNJS.BuildGaussianKernel(kernel, sigma, radiusMul);
  }

  if (bnAlgo === "VoidAndCluster") {
    const sampleMap = new Uint8Array(sqSz);
    for (let i = 0; i < sampleCount; i++) sampleMap[i] = 1;
    BNUtils.Shuffle(sampleMap);

    BNJS.VoidAndClusterCandidateWrap(
      sampleMap, blurMap, bnWidth, bnHeight,
      kernel, kWidth, kHeight);

    result = new Uint32Array(sqSz);

    BNJS.VoidAndClusterWrap(result, blurMap, sampleMap, bnWidth, bnHeight, sampleCount, kernel, kWidth, kHeight);
  }

  else if (bnAlgo === "Iliyan") {
    result = new Uint32Array(sqSz);
    for (let i = 0; i < sqSz; i++) result[i] = i;
    //BNUtils.Shuffle(result);

    const energyMap = new Float64Array(sqSz);

    BNJS.IliyanDitheredSamplingWrap(
      result, energyMap, bnWidth, bnHeight,
      kernel, kWidth, kHeight,
      sigma2, pNorm, iterationCount);
  }

  else if (bnAlgo === "VACCandidate") {
    result = new Uint32Array(sqSz);
    for (let i = 0; i < sampleCount; i++) result[i] = 1;
    BNUtils.Shuffle(result);

    BNJS.VoidAndClusterCandidateWrap(
      result, blurMap, bnWidth, bnHeight,
      kernel, kWidth, kHeight);
  }

  else if (bnAlgo === "Mitchell") {
    BNJS.MitchellBestCandidateWrap(sampleList, sampleCount, MBCCandidates, bnWidth, bnHeight);

    result = new Uint8Array(sqSz);
    for (let i = 0; i < sampleCount; i++)
      result[Math.floor(sampleList[i * 2 + 1]) * bnWidth + Math.floor(sampleList[i * 2])] = 1;
  }

  else if (bnAlgo === "Lloyd") {
    for (let i = 0; i < sampleCount; i++) {
      sampleList[i * 2] = Math.random() * bnWidth;
      sampleList[i * 2 + 1] = Math.random() * bnHeight;
    }

    BNJS.LloydRelaxationWrap(sampleList, sampleCount, bnWidth, bnHeight, bnWidth / 2, bnHeight / 2, iterationCount);

    result = new Uint8Array(sqSz);

    for (let i = 0; i < sampleCount; i++)
      result[Math.floor(sampleList[i * 2 + 1]) * bnWidth + Math.floor(sampleList[i * 2])] += 1;
  }

  else if (bnAlgo === "GaussianBlueNoise") {
    for (let i = 0; i < sampleCount; i++) {
      sampleList[i * 2] = Math.random() * bnWidth;
      sampleList[i * 2 + 1] = Math.random() * bnHeight;
    }
    BNJS.GaussianBlueNoiseWrap(sampleList, sampleCount, bnWidth, bnHeight, bnWidth / 2, bnHeight / 2, sigma1, iterationCount);

    result = new Uint8Array(sqSz);

    for (let i = 0; i < sampleCount; i++)
      result[Math.floor(sampleList[i * 2 + 1]) * bnWidth + Math.floor(sampleList[i * 2])] += 1;
  }

  else if (bnAlgo === "SamplingViaDelaunayTriangles") {
    BNJS.GaussianBlueNoiseWrap(sampleList, sampleCount, bnWidth, bnHeight, bnWidth / 2, bnHeight / 2, sigma1, iterationCount);

    const addedSamples = BNJS.BlueNoiseSamplingViaDelaunayTriangles(sampleList, targetSamples, bnWidth, bnHeight);

    result = new Uint8Array(sqSz);

    for (let i = 0; i < sampleCount; i++)
      result[Math.floor(sampleList[i * 2]) * bnWidth + Math.floor(sampleList[i * 2 + 1])] += 1;

    for (let i = targetSamples - sampleCount - 1; i >= 0; i--) {
      const currentSample = addedSamples[i];

      result[Math.floor(currentSample[0]) * bnWidth + Math.floor(currentSample[1])] += 1;
    }
  }

  else if (bnAlgo === "Voronoi") {
    for (let i = 0; i < sampleCount; i++) {
      sampleList[i * 2] = Math.random() * bnWidth;
      sampleList[i * 2 + 1] = Math.random() * bnHeight;
    }

    BNJS.GaussianBlueNoiseWrap(sampleList, sampleCount, bnWidth, bnHeight, bnWidth / 2, bnHeight / 2, sigma1, iterationCount);

    const voronoi = BNUtils.BuildVoronoiDiagramWrap(sampleList, sampleCount, bnWidth, bnHeight);

    generateTime.innerHTML = "Generating took " + (performance.now() - t0) + "ms";

    bnCtx.fillStyle = `#ff00ff`;
    bnCtx.fillRect(0, 0, bnWidth, bnHeight);

    bnCtx.strokeStyle = `gray`;

    for (let polygon = 0; polygon < sampleCount; polygon++) {
      const currentPolygon = voronoi[polygon];

      const grad = ((polygon / voronoi.length) * 255) | 0;
      bnCtx.fillStyle = `rgb(${grad},${grad},${grad})`;

      bnCtx.beginPath();
      bnCtx.moveTo(currentPolygon[0][0] | 0, currentPolygon[0][1] | 0);

      for (let j = 1; j < currentPolygon.length; j++) {
        bnCtx.lineTo(currentPolygon[j][0] | 0, currentPolygon[j][1] | 0);
      }

      bnCtx.closePath();
      bnCtx.fill();
      bnCtx.stroke();
    }

    return;
  }

  else if (bnAlgo === "Delaunay") {
    for (let i = 0; i < sampleCount; i++) {
      sampleList[i * 2] = Math.random() * bnWidth;
      sampleList[i * 2 + 1] = Math.random() * bnHeight;
    }

    BNJS.GaussianBlueNoiseWrap(sampleList, sampleCount, bnWidth, bnHeight, bnWidth / 2, bnHeight / 2, sigma1, iterationCount);

    const rawDelaunayTriangles = BNJS.BuildDelaunayTrianglesBowyerWatsonWrapOOB(sampleList, sampleCount, bnWidth, bnHeight);
    const delaunay = BNJS.DelaunayTrianglesBowyerWatsonOOBFilter(rawDelaunayTriangles, bnWidth, bnHeight);

    generateTime.innerHTML = "Generating took " + (performance.now() - t0) + "ms";

    bnCtx.fillStyle = `#ff00ff`;
    bnCtx.fillRect(0, 0, bnWidth, bnHeight);

    bnCtx.strokeStyle = `gray`;

    for (let polygon = delaunay.length - 1; polygon >= 0; polygon--) {
      const currentPolygon = delaunay[polygon];

      const grad = ((polygon / delaunay.length) * 255) | 0;
      bnCtx.fillStyle = `rgb(${grad},${grad},${grad})`;

      bnCtx.beginPath();
      bnCtx.moveTo(currentPolygon[0][0], currentPolygon[0][1]);
      bnCtx.lineTo(currentPolygon[1][0], currentPolygon[1][1]);
      bnCtx.lineTo(currentPolygon[2][0], currentPolygon[2][1]);
      bnCtx.closePath();

      bnCtx.fill();
      bnCtx.stroke();
    }

    return;
  }

  else if (bnAlgo === "DDF") {
    for (let i = 0; i < sampleCount; i++) {
      sampleList[i * 2] = Math.random() * bnWidth;
      sampleList[i * 2 + 1] = Math.random() * bnHeight;
    }

    BNJS.GaussianBlueNoiseWrap(
      sampleList, sampleCount, bnWidth, bnHeight, bnWidth / 2, bnHeight / 2,
      sigma1, iterationCount);

    result = new Float64Array(sqSz);

    BNJS.BuildDifferentialDomainBilinearWrap(
      sampleList, sampleCount, bnWidth, bnHeight, bnWidth / 2, bnHeight / 2,
      result, bnWidth, bnHeight);
  }

  else if (bnAlgo === "GeneralNoise") {
    for (let i = 0; i < sampleCount * 2; i++) {
      sampleList[i] = Math.random() * bnWidth;
      sampleList[i + 1] = Math.random() * bnHeight;
    }

    const derivativeKernelX = new Float64Array(kWidth * kHeight);
    const derivativeKernelY = new Float64Array(kWidth * kHeight);

    BNJS.BuildGaussianDerivateKernels(derivativeKernelX, derivativeKernelY, sigma, radiusMul);

    const targetFT = new Float64Array(sqSz).fill(1);
    const targetDDA = new Float64Array(sqSz).fill(1);

    const halfWidth = bnWidth >> 1;
    const halfHeight = bnHeight >> 1;

    const maxR = Math.sqrt(halfWidth * halfWidth + halfHeight * halfHeight);

    const r0 = 0.2;
    const midGain = 1;

    for (let y = 0; y < bnHeight; y++) {
      const row = y * bnWidth;

      for (let x = 0; x < bnWidth; x++) {
        const r = Math.sqrt((x - halfWidth) ** 2 + (y - halfHeight) ** 2) / maxR;

        let val = 0;

        if (r < r0) val = 0;
        else if (r < 0.25) val = midGain;
        else val = 0;

        targetFT[row + x] = val;
      }
    }

    BNJS.InvCosineTransform2D(targetFT, targetDDA, bnWidth, bnHeight, bnWidth / 2, bnHeight / 2);

    const currentDDA = new Float64Array(bnWidth * bnHeight);
    const errorDDA = new Float64Array(bnWidth * bnHeight);
    const errorDerivateX = new Float64Array(bnWidth * bnHeight);
    const errorDerivateY = new Float64Array(bnWidth * bnHeight);
    const forceX = new Float64Array(bnWidth * bnHeight);
    const forceY = new Float64Array(bnWidth * bnHeight);

    BNJS.GeneralSpectrumNoiseWrap(
      sampleList, sampleCount, bnWidth, bnHeight, bnWidth / 2, bnHeight / 2,
      currentDDA, targetDDA, errorDDA, errorDerivateX, errorDerivateY, forceX, forceY, bnWidth, bnHeight,
      derivativeKernelX, derivativeKernelY, kWidth, kHeight,
      stepScale, iterationCount);

    result = new Uint8Array(sqSz);

    for (let i = 0; i < sampleCount; i++)
      result[Math.floor(sampleList[i * 2 + 1]) * bnWidth + Math.floor(sampleList[i * 2])] += 1;
  }

  generateTime.innerHTML = "Generating took " + (performance.now() - t0) + "ms";

  const frame = bnCtx.getImageData(0, 0, bnWidth, bnHeight);
  const imageData = frame.data;
  const denom = (1 / findHighest(result)) * 255;
  const lowest = findLowest(result);

  for (let i = 0; i < sqSz; i++) imageData[i * 4 + 3] = 255;

  for (let y = 0; y < bnHeight; y++) {
    const yOffs = y * bnWidth;

    for (let x = 0; x < bnWidth; x++) {
      let i = yOffs + x;

      const v = ((result[i] - lowest) * denom + 0.5) | 0;

      i *= 4;
      imageData[i] = v;
      imageData[i + 1] = v;
      imageData[i + 2] = v;
    }
  }

  bnCtx.putImageData(frame, 0, 0);
}

function downloadRaw() {
  const blob = new Blob([result.buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "blue_noise.raw";
  a.click();
  URL.revokeObjectURL(url);
}

function ToMatrix() {
  const bnWidth = Number(document.getElementById("BNWidth").value);
  const bnHeight = Number(document.getElementById("BNHeight").value);

  const matrixResult = [];

  for (let y = 0; y < bnHeight; y++) {
    if (!matrixResult[y]) matrixResult[y] = [];

    const yOffs = y * bnWidth;

    for (let x = 0; x < bnWidth; x++) {
      matrixResult[y][x] = result[yOffs + x];
    }
  }

  document.getElementById("BNMatrixOutput").value = JSON.stringify(matrixResult);
}
