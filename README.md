# _**void-and-cluster.js**_
JS implementation of void and cluster method by Robert Ulichney\

I went around the internet to find a Void and Cluster js implementation but there seems to be none or less\
Ethan Shulman did implement Void and Cluster but he default to "All Rights Reserved" so i can't use his implement\
Kinda devastated so i implement Void and Cluster myself with my optimization skills\

Comparing mine, Demofox and Ethan Shulman Void and Cluster output\
Note that the generate time may vary\

256x256, sigma = 2, radius = 16, 61.929s\
<img width="256" height="256" alt="image" src="https://github.com/user-attachments/assets/0ef19375-272e-48ef-8548-fbabf1d51387" />

255x256? 400.2s\
<img width="255" height="256" alt="image" src="https://github.com/user-attachments/assets/a34febf6-3932-435b-b97c-4e691a0741a3" />

256x256, sigma = 2, density = 0.1, 168.78s\
<img width="256" height="256" alt="image" src="https://github.com/user-attachments/assets/1c126adc-ec9c-4216-8092-9d6b37725989" />

My output looks kinda similar to bayer, that grid and robotic feeling, i will improve it in the future

Demo for you guys!
[github.com/901D3/void-and-cluster.js/demo](https://901d3.github.io/void-and-cluster.js/demo/)

Check out the source code!
[github.com/901D3/void-and-cluster.js](https://github.com/901D3/void-and-cluster.js)
