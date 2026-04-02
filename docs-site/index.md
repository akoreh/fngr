---
layout: home

hero:
  name: fngr
  tagline: Modern gesture recognition for the web
  image:
    src: /logo.webp
    alt: fngr
    width: 200
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: API Reference
      link: /api/tap
---

<style>
:root {
  --vp-home-hero-image-filter: none;
}
.VPHero .container {
  flex-direction: column-reverse !important;
  align-items: center !important;
  text-align: center;
}
.VPHero .image {
  min-height: auto !important;
}
.VPHero .image-container {
  margin: 0 auto !important;
  transform: none !important;
  width: 200px !important;
  height: 200px !important;
}
.VPHero .VPImage.image-src {
  position: relative !important;
  max-width: 200px !important;
  max-height: 200px !important;
}
.VPHero .image-bg {
  display: none;
}
.VPHero .main {
  max-width: 100% !important;
  align-items: center;
}
</style>

<div class="badges">
  <span>PointerEvent-based</span>
  <span>Zero deps</span>
  <span>Tree-shakeable</span>
  <span>TypeScript-first</span>
  <span>SSR-safe</span>
</div>

```ts
import { tap } from 'fngr/tap';

tap(element, (e) => {
  console.log('tapped!', e.pointers[0]);
});
```
