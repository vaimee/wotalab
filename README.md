Supporting students's projects on WoT @ [Development Platforms for Automation](https://www.unibo.it/en/study/course-units-transferable-skills-moocs/course-unit-catalogue/course-unit/2025/508380)

# References
[W3C main WoT entry](https://www.w3.org/WoT/cg/)

[W3C WoT Community Group](https://www.w3.org/community/wot/)

[WoT tutorial](https://w3c.github.io/wot-cg/tutorials/whatiswot/)

[GitHub](https://github.com/w3c/wot-cg)

[Discord](https://discord.com/invite/RJNYJsEgnb)

# Practical lessons code
All the code seen during practical lessons will be stored in this repository under /practical-lessons.  
Each wot example is contained in its own sub folder, and can be run as follows:  
1. Move to the example subfolder (in this case Counter example):
`cd ./practical-lessons/2025/Counter`
2. Install dependencies (nodejs):
`npm i`
3. Run
```
npm run start:build
# Alternatively separated:
npm run build
npm run start
```
4. Run with initial test: 
`npm run start:build -- test`
