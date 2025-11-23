# _**blue-noise.js**_
### Free JS implementation of Void and Cluster method by Robert Ulichney and other methods

I went around the internet to find a Void and Cluster JS implementation but there seems to be not many\
Ethan Shulman did implement Void and Cluster but he didn't put a clear license or legal notice so i can't use his\
Kinda devastated so i implement Void and Cluster myself with my optimization skills

──────────

# _How to use_
Linking the required scripts in HTML(either float16, float32 or float64), the utils is mandatory

```
<script src="<path to script>/blue-noise-utils.js"></script>
<script src="<path to script>/blue-noise-float32.js"></script>
```

To generate a blue noise texture(32 Bits Float), simply run

```
blueNoiseFloat32.extendedVoidAndCluster(
    width,
    height,
    sigma,
    candidateMethodSigma,
    null, // custom kernel
    density
)
```

It will return a 2D flattened array, it's values ranging from 0 to (width * height)

──────────

Comparing mine, Atrix256 and Ethan Shulman Void and Cluster output\
The results is from [5905481bf29252a04ab397ca017b680d6fd59cd6](https://github.com/901D3/blue-noise.js/commit/5905481bf29252a04ab397ca017b680d6fd59cd6)
Generating time may vary

### Mine
Float 64\
Algorithm: Extended Void and Cluster\
Sigma radius multiplier: 15\
Initial sigma scale: 0.4\
Sigma: 1.9\
Density: 0.95\
40531.19999999972ms\
<img width="256" height="256" alt="image" src="https://raw.githubusercontent.com/901D3/blue-noise.js/refs/heads/main/out/image_208.png" />

### Atrix256's
Sigma: 1.9?\
Density: 0.1\
400.2s\
<img width="512" height="256" alt="image" src="https://blog.demofox.org/wp-content/uploads/2019/06/bluevc_1m.png" />

### Ethan Shulman's
Sigma: 2
Density: 0.1
168.78s\
<img width="256" height="256" alt="image" src="https://github.com/user-attachments/assets/1c126adc-ec9c-4216-8092-9d6b37725989" />

My implement completely beats Atrix256 and Ethan Shulman implementation in generate time while the quality is similar to Atrix256's

Demo for you guys!\
[901d3.github.io/blue-noise.js/demo/float32](https://901d3.github.io/blue-noise.js/demo/float32)\
[901d3.github.io/blue-noise.js/demo/float64](https://901d3.github.io/blue-noise.js/demo/float64)

Check out the source code!\
[github.com/901D3/blue-noise.js](https://github.com/901D3/blue-noise.js)

## References
[cv.ulichney.com/papers/1993-void-cluster.pdf](http://cv.ulichney.com/papers/1993-void-cluster.pdf)\
[blog.demofox.org/2019/06/25/generating-blue-noise-textures-with-void-and-cluster](https://blog.demofox.org/2019/06/25/generating-blue-noise-textures-with-void-and-cluster)\
[momentsingraphics.de/BlueNoise.html](https://momentsingraphics.de/BlueNoise.html)\
[xaloez.com/o/bluenoise](https://xaloez.com/o/bluenoise)
