# _**blue-noise.js**_
JS implementation of Void and Cluster method by Robert Ulichney

I went around the internet to find a Void and Cluster js implementation but there seems to be none or less\
Ethan Shulman did implement Void and Cluster but he default to "All Rights Reserved" so i can't use his implement\
Kinda devastated so i implement Void and Cluster myself with my optimization skills

Comparing mine, Demofox and Ethan Shulman Void and Cluster output\
Note that the generate time may vary

Mine\
256x256, all phases sigma = 1, all phases kernel radius = 8, PDS radius x and y = 5, PDS K value = 30\
<img width="256" height="256" alt="image" src="https://github.com/901D3/blue-noise.js/blob/main/out/256x256,%20all%20phases%20sigma%20=%201,%20all%20phases%20kernel%20radius%20cap%20=%208,%20PDS%20radius%20x%20and%20y%20=%205,%20PDS%20K%20value%20=%2030.png?raw=true" />

256x256, all phases sigma = 2, all phases kernel radius = 18, PDS radius x and y= 5, PDS K value = 30, 56.87109999999963s\
<img width="256" height="256" alt="image" src="https://github.com/901D3/blue-noise.js/blob/main/out/256x256,%20all%20phases%20sigma%20=%202,%20all%20phases%20kernel%20radius%20cap%20=%2018,%20PDS%20radius%20x%20and%20y=%205,%20PDS%20K%20value%20=%2030,%2056.87109999999963s.png?raw=true" />

256x256, phase 1 phase 2 sigma = 2,5, phase 3 sigma = 1.5, phase 1 phase 2 kernel radius = 16, phase 3 kernel radius = 4, all PDS radius = 5, PDS K value = 30, 58.86489999999944s\
<img width="256" height="256" alt="image" src="https://github.com/901D3/blue-noise.js/blob/main/out/256x256,%20phase%201%20phase%202%20sigma%20=%202.5,%20phase%203%20sigma%20=%201.5,%20phase%201%20phase%202%20kernel%20radius%20=%2016,%20phase%203%20kernel%20radius%20=%204,%20all%20PDS%20radius%20=%205,%20PDS%20K%20value%20=%2030,%2058.86489999999944s.png?raw=true" />

From Demofox\
255x256? 400.2s\
<img width="255" height="256" alt="image" src="https://github.com/user-attachments/assets/a34febf6-3932-435b-b97c-4e691a0741a3" />

Ethan Shulman\
256x256, sigma = 2, density = 0.1, 168.78s\
<img width="256" height="256" alt="image" src="https://github.com/user-attachments/assets/1c126adc-ec9c-4216-8092-9d6b37725989" />

Demo for you guys!\
[github.com/901D3/void-and-cluster.js/demo](https://901d3.github.io/void-and-cluster.js/demo)

Check out the source code!\
[github.com/901D3/void-and-cluster.js](https://github.com/901D3/void-and-cluster.js)

----------
## References

[blog.demofox.org/2019/06/25/generating-blue-noise-textures-with-void-and-cluster](https://blog.demofox.org/2019/06/25/generating-blue-noise-textures-with-void-and-cluster)

[xaloez.com/o/bluenoise](https://xaloez.com/o/bluenoise)
