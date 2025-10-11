# _**blue-noise.js**_
JS implementation of Void and Cluster method by Robert Ulichney

I went around the internet to find a Void and Cluster js implementation but there seems to be none or less\
Ethan Shulman did implement Void and Cluster but he default to "All Rights Reserved" so i can't use his implement\
Kinda devastated so i implement Void and Cluster myself with my optimization skills

----------

# _How to use_

To generate a blue noise texture, simply run

```
blueNoiseFloat<either 16, 32 or 64>.voidAndCluster(
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
    initArray)
```

It will return a typed array(1D), with values ranging from 0 to (<width> * <height>)

All arguments description:

```
{int} width:
Output array "width"

{int} height:
Output array "height"

{number} phase1SigmaStart:
Phase 1 sigma gradient start value

{number} phase1SigmaEnd:
Phase 1 sigma gradient end value

{number} phase2SigmaStart:
Phase 2 sigma gradient start value

{number} phase2SigmaEnd:
Phase 2 sigma gradient end value

{number} phase3SigmaStart:
Phase 3 sigma gradient start value

{number} phase3SigmaEnd:
Phase 3 sigma gradient end value

{number[]} phase1Kernel:
Phase 1 blur kernel

{number[]} phase2Kernel:
Phase 2 blur kernel

{number[]} phase3Kernel:
Phase 3 blur kernel

{normalized0to1} candidateFillingRatio:
The ratio between phase 2 and phase 3

{array} initArray:
Initial array, it act like user inputted seed, must have the same length as (<width> * <height>), array dimension(2D 3D or 4D) doesn't matter
If no array if supplied it will default to randomized Poisson Disk Sampling

```

----------

Comparing mine, Demofox and Ethan Shulman Void and Cluster output\
My result is from [cb347ace96914194b7f2671804e16408f930a4cc](https://github.com/901D3/blue-noise.js/commit/cb347ace96914194b7f2671804e16408f930a4cc)\. I may change the algorithm in the future

Mine\
256x256, all phases sigma = 1, all phases kernel radius = 8, PDS radius x and y = 5, PDS K value = 30\
<img width="256" height="256" alt="image" src="https://github.com/901D3/blue-noise.js/blob/main/out/256x256,%20all%20phases%20sigma%20=%201,%20all%20phases%20kernel%20radius%20cap%20=%208,%20PDS%20radius%20x%20and%20y%20=%205,%20PDS%20K%20value%20=%2030.png?raw=true" />

256x256, all phases sigma = 2, all phases kernel radius = 18, PDS radius x and y= 5, PDS K value = 30, 56.87109999999963s\
<img width="256" height="256" alt="image" src="https://github.com/901D3/blue-noise.js/blob/main/out/256x256,%20all%20phases%20sigma%20=%202,%20all%20phases%20kernel%20radius%20cap%20=%2018,%20PDS%20radius%20x%20and%20y=%205,%20PDS%20K%20value%20=%2030,%2056.87109999999963s.png?raw=true" />

256x256, phase 1 phase 2 sigma = 2,5, phase 3 sigma = 1.5, phase 1 phase 2 kernel radius = 16, phase 3 kernel radius = 4, all PDS radius = 5, PDS K value = 30, 58.86489999999944s\
<img width="256" height="256" alt="image" src="https://github.com/901D3/blue-noise.js/blob/main/out/256x256,%20phase%201%20phase%202%20sigma%20=%202.5,%20phase%203%20sigma%20=%201.5,%20phase%201%20phase%202%20kernel%20radius%20=%2016,%20phase%203%20kernel%20radius%20=%204,%20all%20PDS%20radius%20=%205,%20PDS%20K%20value%20=%2030,%2058.86489999999944s.png?raw=true" />

From Demofox\
256x256, 400.2s\
<img width="512" height="256" alt="image" src="https://blog.demofox.org/wp-content/uploads/2019/06/bluevc_1m.png" />

Ethan Shulman\
256x256, sigma = 2, density = 0.1, 168.78s\
<img width="256" height="256" alt="image" src="https://github.com/user-attachments/assets/1c126adc-ec9c-4216-8092-9d6b37725989" />

My implement completely beats Demofox and Ethan Shulman implementation in generate time

Demo for you guys!\
[github.com/901D3/blue-noise.js/demo](https://901d3.github.io/blue-noise.js/demo)

Check out the source code!\
[github.com/901D3/blue-noise.js](https://github.com/901D3/blue-noise.js)

## References

[blog.demofox.org/2019/06/25/generating-blue-noise-textures-with-void-and-cluster](https://blog.demofox.org/2019/06/25/generating-blue-noise-textures-with-void-and-cluster)

[xaloez.com/o/bluenoise](https://xaloez.com/o/bluenoise)
