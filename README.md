<div align="center">
  <a href="https://github.com/brandonkthomas/Portfolio">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="wwwroot/assets/svg/bt-logo-boxed-darkm.svg">
      <source media="(prefers-color-scheme: light)" srcset="wwwroot/assets/svg/bt-logo-boxed-lightm.svg">
      <img src="wwwroot/assets/svg/bt-logo-boxed.svg" alt="Logo" width="80" height="80">
    </picture>
  </a>

  <h3 align="center">Portfolio</h3>

  <p align="center">
    Responsive portfolio site w/ interactive identity card, project showcase, photo gallery & contact links.
    <br />
    <a href="https://brandonthomas.net">View Demo</a>
    <br />
    <br />
    <a href="https://dotnet.microsoft.com/en-us/apps/aspnet"><img alt=".NET Core" src="https://img.shields.io/badge/.NET%20Core-512BD4?logo=dotnet&logoColor=white"></a>
    <a href="https://threejs.org"><img alt="Three.js" src="https://img.shields.io/badge/Three.js-000000?logo=three.js&logoColor=white"></a>
    <a href="https://www.w3.org/html/"><img alt="HTML" src="https://shields.io/badge/HTML-f06529?logo=html5&logoColor=white&labelColor=f06529"></a>
    <a href="https://www.typescriptlang.org"><img alt="TypeScript" src="https://shields.io/badge/TypeScript-3178C6?logo=TypeScript&logoColor=FFF"></a>
    <a href="https://www.w3.org/Style/CSS/Overview.en.html"><img alt="CSS" src="https://shields.io/badge/CSS-009CFF?logo=css&logoColor=white&labelColor=009CFF"></a>
  </p>
</div>

## About the Project
<a href="https://brandonthomas.net">
  <img width="3080" height="2270" alt="Portfolio site preview" src="https://github.com/user-attachments/assets/9181d459-4f75-47e8-a2f9-59a5617895b9" />
</a>

This project began as a simple Three.js card experiment and has since evolved into a more comprehensive personal portfolio. 

I intend to continuously add new features and improve framework code.

### Feature Highlights
- **Starfield**: Procedural starfield + nebula backdrop that changes direction, density, and FPS caps based on SPA state
- **Card**: Three.js identity card with drag/tilt physics, flip functionality, tap/click CTA scheduling, and interactivity w/ starfield background
- **Photo Gallery**: Lazy-load gallery that pre-measures all assets, renders skeleton columns, and opens a custom image viewer lightbox
- **Projects Showcase**: Manifest-driven projects bento grid with gradient generation, dynamic micro-components, OS-aware download CTAs, and double-tap guards
- **Glass Material**: Glass-surface UI module powering navbar and footer
- **SPA State Manager**: Custom cross-view coordinator that lazy-loads modules, animates transitions, and keeps history in sync
- **Performance Monitor**: Built-in perf/debug overlay with loop/segment tracking and long-frame "stutter" warnings
- **Asset Management & Manifests**: ASP.NET Core middleware serving hashet assets + enforcing cache policy and dynamic JSON manifests for photos/projects across dev/prod
