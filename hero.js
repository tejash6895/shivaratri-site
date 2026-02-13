(function () {
  function initShivaHero() {
    const section = document.getElementById('hero');
    const canvas = document.getElementById('heroCanvas');
    const fallback = document.getElementById('heroFallback');
    const beginBtn = document.getElementById('beginBtn');

    if (!section || !canvas || !fallback) return;
    if (section.dataset.heroInitialized === 'true') return;
    section.dataset.heroInitialized = 'true';

    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const state = {
      reducedMotion: reduceMotionQuery.matches,
      motionFactor: reduceMotionQuery.matches ? 0 : 0.72,
      pointerX: 0,
      pointerY: 0,
      parallaxX: 0,
      parallaxY: 0,
      startImpulse: 0,
      inView: true,
      fallbackMode: false,
    };

    function showFallback(reason) {
      if (state.fallbackMode) return;
      state.fallbackMode = true;
      canvas.style.display = 'none';
      section.classList.add('hero-fallback-active');
      fallback.hidden = false;
      console.warn('[hero] fallback mode:', reason);
    }

    function supportsWebGL() {
      try {
        const test = document.createElement('canvas');
        return Boolean(
          window.WebGLRenderingContext &&
          (test.getContext('webgl') || test.getContext('experimental-webgl'))
        );
      } catch {
        return false;
      }
    }

    if (!window.THREE || !supportsWebGL()) {
      showFallback('WebGL unavailable or Three.js not loaded');
      return;
    }

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.03;

    const scene = new THREE.Scene();
    const cameraRig = new THREE.Group();
    const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 32);
    camera.position.set(0, 0.03, 3.85);
    cameraRig.add(camera);
    scene.add(cameraRig);

    let composer = null;
    let bloomPass = null;
    if (THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass) {
      composer = new THREE.EffectComposer(renderer);
      composer.addPass(new THREE.RenderPass(scene, camera));
      bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.28,
        0.74,
        0.86
      );
      composer.addPass(bloomPass);
    }

    const shivaGroup = new THREE.Group();
    shivaGroup.position.y = window.innerWidth < 768 ? 0.2 : 0.05;
    scene.add(shivaGroup);

    const shivaGeometry = new THREE.PlaneGeometry(2.34, 3.42, 1, 1);
    const shivaMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTex: { value: null },
        uPulse: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        uniform float uPulse;
        void main() {
          vUv = uv;
          vec3 p = position;
          float s = 1.0 + (0.012 * uPulse);
          p.xy *= s;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uTex;
        void main() {
          vec4 tex = texture2D(uTex, vUv);
          float sideMask = smoothstep(0.0, 0.26, vUv.x) * smoothstep(0.0, 0.26, 1.0 - vUv.x);
          float topMask = smoothstep(-0.05, 0.24, 1.0 - vUv.y);
          float bottomMask = smoothstep(0.03, 0.44, vUv.y);
          vec2 centered = (vUv - 0.5) * vec2(1.22, 1.62);
          float radialMask = 1.0 - smoothstep(0.38, 0.90, length(centered));
          float luma = dot(tex.rgb, vec3(0.2126, 0.7152, 0.0722));
          float maxC = max(max(tex.r, tex.g), tex.b);
          // Key out near-black source pixels so the figure emerges from darkness.
          float darkKey = smoothstep(0.015, 0.14, maxC + tex.r * 0.15);
          float shadowKeep = smoothstep(0.02, 0.20, luma) * 0.55;
          float imageMask = clamp(max(darkKey, shadowKeep), 0.0, 1.0);
          float warmLift = smoothstep(0.08, 0.62, luma) * 0.18;
          vec3 color = tex.rgb + vec3(0.12, 0.08, 0.03) * warmLift;
          color = mix(color, color * 0.97 + vec3(0.02, 0.014, 0.005), 0.25);
          float alpha = clamp(sideMask * topMask * bottomMask * radialMask * imageMask, 0.0, 1.0);
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });

    const shivaMesh = new THREE.Mesh(shivaGeometry, shivaMaterial);
    shivaGroup.add(shivaMesh);

    const loader = new THREE.TextureLoader();
    loader.load(
      'assets/shiva.png',
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        texture.needsUpdate = true;
        shivaMaterial.uniforms.uTex.value = texture;
      },
      undefined,
      () => {
        showFallback('Texture missing at assets/shiva.png');
      }
    );

    const auraCount = state.reducedMotion ? 900 : 2600;
    const auraGeometry = new THREE.BufferGeometry();
    const auraPositions = new Float32Array(auraCount * 3);
    const auraSizes = new Float32Array(auraCount);
    const auraSeeds = new Float32Array(auraCount);
    const auraSpeeds = new Float32Array(auraCount);
    const auraWarm = new Float32Array(auraCount);

    for (let i = 0; i < auraCount; i++) {
      const i3 = i * 3;
      const zone = Math.random();
      let x = 0;
      let y = 0;
      let z = 0;

      if (zone < 0.5) {
        const theta = Math.random() * Math.PI * 2;
        const radius = Math.pow(Math.random(), 1.9) * 0.55;
        x = Math.cos(theta) * radius * 0.85;
        y = 0.74 + (Math.random() - 0.5) * 0.5;
        z = (Math.random() - 0.5) * 0.58;
      } else if (zone < 0.82) {
        const side = Math.random() < 0.5 ? -1 : 1;
        x = side * (0.28 + Math.random() * 0.56) + (Math.random() - 0.5) * 0.18;
        y = 0.2 + (Math.random() - 0.5) * 0.75;
        z = (Math.random() - 0.5) * 0.86;
      } else {
        const t = Math.random();
        const phase = t * 9.2 + Math.random() * 3.0;
        x = Math.sin(phase) * (0.16 + t * 0.34) + (Math.random() - 0.5) * 0.32;
        y = -0.16 - t * 1.85 + (Math.random() - 0.5) * 0.2;
        z = (Math.random() - 0.5) * 1.15;
      }

      auraPositions[i3] = x;
      auraPositions[i3 + 1] = y;
      auraPositions[i3 + 2] = z;
      auraSizes[i] = 1.3 + Math.random() * 2.2;
      auraSeeds[i] = Math.random() * Math.PI * 2;
      auraSpeeds[i] = 0.16 + Math.random() * 0.28;
      auraWarm[i] = Math.random();
    }

    auraGeometry.setAttribute('position', new THREE.BufferAttribute(auraPositions, 3));
    auraGeometry.setAttribute('aSize', new THREE.BufferAttribute(auraSizes, 1));
    auraGeometry.setAttribute('aSeed', new THREE.BufferAttribute(auraSeeds, 1));
    auraGeometry.setAttribute('aSpeed', new THREE.BufferAttribute(auraSpeeds, 1));
    auraGeometry.setAttribute('aWarm', new THREE.BufferAttribute(auraWarm, 1));

    const auraMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uMotion: { value: state.motionFactor },
        uDpr: { value: Math.min(window.devicePixelRatio || 1, 1.5) },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aSeed;
        attribute float aSpeed;
        attribute float aWarm;
        uniform float uTime;
        uniform float uMotion;
        uniform float uDpr;
        varying float vWarm;
        varying float vTwinkle;
        void main() {
          vec3 p = position;
          float driftX = sin(uTime * (0.08 + aSpeed * 0.10) + aSeed) * 0.018 * uMotion;
          float driftY = cos(uTime * (0.07 + aSpeed * 0.09) + aSeed) * 0.015 * uMotion;
          p.x += driftX;
          p.y += driftY;

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float pulse = 1.0 + sin(uTime * 0.22 + aSeed) * 0.10 * uMotion;
          gl_PointSize = aSize * pulse * uDpr * (4.0 / -mv.z);
          gl_Position = projectionMatrix * mv;

          vWarm = aWarm;
          vTwinkle = 0.7 + 0.3 * sin(uTime * 0.35 + aSeed * 1.2);
        }
      `,
      fragmentShader: `
        varying float vWarm;
        varying float vTwinkle;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          float core = smoothstep(0.48, 0.0, d);
          float glow = smoothstep(0.5, 0.2, d);

          vec3 c1 = vec3(0.80, 0.56, 0.20);
          vec3 c2 = vec3(0.98, 0.84, 0.50);
          vec3 color = mix(c1, c2, vWarm);

          float alpha = core * glow * vTwinkle;
          if (alpha < 0.015) discard;
          gl_FragColor = vec4(color, alpha * 0.56);
        }
      `,
    });

    const auraPoints = new THREE.Points(auraGeometry, auraMaterial);
    shivaGroup.add(auraPoints);

    const strandUniforms = {
      uTime: { value: 0 },
      uMotion: { value: state.motionFactor },
    };

    const strandMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: strandUniforms,
      vertexShader: `
        uniform float uTime;
        uniform float uMotion;
        attribute float aLineT;
        varying float vLineT;
        void main() {
          vLineT = aLineT;
          vec3 p = position;
          float wave = sin((aLineT * 15.0) + uTime * 0.30 + p.x * 2.0) * 0.014 * uMotion;
          p.x += wave;
          p.y += sin(uTime * 0.14 + aLineT * 10.0) * 0.006 * uMotion;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying float vLineT;
        void main() {
          float flow = 0.58 + 0.42 * sin((vLineT * 18.0) - uTime * 0.68);
          vec3 cA = vec3(0.67, 0.44, 0.16);
          vec3 cB = vec3(0.98, 0.80, 0.39);
          vec3 color = mix(cA, cB, flow);
          float alpha = 0.05 + 0.10 * flow;
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });

    const strandsGroup = new THREE.Group();
    shivaGroup.add(strandsGroup);

    const strandCount = 10;
    const strandSegments = 64;
    for (let s = 0; s < strandCount; s++) {
      const positions = new Float32Array(strandSegments * 3);
      const lineT = new Float32Array(strandSegments);
      const sideBias = (Math.random() - 0.5) * 1.2;
      const phase = Math.random() * Math.PI * 2;
      const startY = 0.85 + Math.random() * 0.35;

      for (let i = 0; i < strandSegments; i++) {
        const t = i / (strandSegments - 1);
        const i3 = i * 3;
        const spiral = Math.sin(t * 8.0 + phase) * (0.12 + t * 0.34);

        positions[i3] = sideBias * (0.22 + t * 0.78) + spiral + (Math.random() - 0.5) * 0.02;
        positions[i3 + 1] = startY - t * 2.65 + Math.sin(t * 6.2 + phase) * 0.06;
        positions[i3 + 2] = -0.14 + Math.cos(t * 5.2 + phase) * 0.08;
        lineT[i] = t;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('aLineT', new THREE.BufferAttribute(lineT, 1));

      const line = new THREE.Line(geo, strandMaterial);
      line.rotation.z = (Math.random() - 0.5) * 0.42;
      line.position.x = (Math.random() - 0.5) * 0.52;
      line.position.y = -0.05 + (Math.random() - 0.5) * 0.22;
      line.position.z = 0.05;
      strandsGroup.add(line);
    }

    function applyReducedMotion(reduce) {
      // Reduced motion mode disables parallax-like drift and breathing pulse.
      state.reducedMotion = reduce;
      state.motionFactor = reduce ? 0 : 0.72;
      auraMaterial.uniforms.uMotion.value = state.motionFactor;
      strandUniforms.uMotion.value = state.motionFactor;
      strandsGroup.visible = !reduce;
      if (bloomPass) bloomPass.strength = reduce ? 0.2 : 0.28;
    }

    if (typeof reduceMotionQuery.addEventListener === 'function') {
      reduceMotionQuery.addEventListener('change', (e) => applyReducedMotion(e.matches));
    } else if (typeof reduceMotionQuery.addListener === 'function') {
      reduceMotionQuery.addListener((e) => applyReducedMotion(e.matches));
    }

    if (beginBtn) {
      beginBtn.addEventListener('click', () => {
        state.startImpulse = state.reducedMotion ? 0 : 0.65;
      });
    }

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    window.addEventListener('pointermove', (ev) => {
      if (state.reducedMotion) return;
      const nx = (ev.clientX / window.innerWidth) * 2 - 1;
      const ny = (ev.clientY / window.innerHeight) * 2 - 1;
      state.pointerX = clamp(nx, -1, 1);
      state.pointerY = clamp(ny, -1, 1);
    }, { passive: true });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        const entry = entries[0];
        state.inView = !!(entry && entry.isIntersecting);
      }, { threshold: 0.08 });
      observer.observe(section);
    }

    function resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      auraMaterial.uniforms.uDpr.value = dpr;
      shivaGroup.position.y = w < 768 ? 0.2 : 0.05;

      if (composer) {
        composer.setSize(w, h);
        composer.setPixelRatio(dpr);
        if (bloomPass) bloomPass.setSize(w, h);
      }
    }

    window.addEventListener('resize', resize);
    resize();
    applyReducedMotion(state.reducedMotion);

    const clock = new THREE.Clock();
    function render() {
      if (state.fallbackMode) return;
      requestAnimationFrame(render);

      if (document.hidden || !state.inView) return;

      const t = clock.getElapsedTime();

      if (!state.reducedMotion) {
        state.parallaxX += (state.pointerX * 0.06 - state.parallaxX) * 0.03;
        state.parallaxY += (state.pointerY * 0.05 - state.parallaxY) * 0.03;
      } else {
        state.parallaxX += (0 - state.parallaxX) * 0.08;
        state.parallaxY += (0 - state.parallaxY) * 0.08;
      }

      cameraRig.position.x = state.parallaxX;
      cameraRig.position.y = state.parallaxY;
      camera.lookAt(0, 0.06, 0);

      const breath = 0.5 + 0.5 * Math.sin(t * 0.72);
      state.startImpulse += (0 - state.startImpulse) * 0.035;
      const ritualPulse = 1 + state.startImpulse * 0.45;
      shivaMaterial.uniforms.uPulse.value = breath * state.motionFactor * ritualPulse;

      const motionTime = state.reducedMotion ? t * 0.08 : t;
      auraMaterial.uniforms.uTime.value = motionTime;
      strandUniforms.uTime.value = motionTime;

      const breathingScale = 1 + (state.reducedMotion ? 0 : 0.004) * Math.sin(t * 0.72);
      shivaGroup.scale.setScalar(breathingScale);
      strandsGroup.rotation.z = Math.sin(t * 0.06) * 0.026 * state.motionFactor;

      if (composer) {
        if (bloomPass) bloomPass.strength = (state.reducedMotion ? 0.2 : 0.28) + state.startImpulse * 0.06;
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    }

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShivaHero, { once: true });
  } else {
    initShivaHero();
  }

  window.ShivaHero = { init: initShivaHero };
})();
