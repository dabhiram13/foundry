import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export interface SceneController {
  dispose(releaseContext?: boolean): void;
  setVisible(value: boolean): void;
  setInteractive(value: boolean): void;
}

export function mountScene(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  onError: () => void,
): SceneController {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-5, 5, 3.2, -3.2, 0.1, 100);
  camera.position.set(7, 9, 11);
  camera.lookAt(0, 0.2, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb0b6b9, 3));
  const light = new THREE.DirectionalLight(0xffffff, 4);
  light.position.set(-4, 8, 6);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  Object.assign(light.shadow.camera, {
    left: -7,
    right: 7,
    top: 7,
    bottom: -7,
  });
  light.shadow.camera.updateProjectionMatrix();
  light.shadow.bias = -0.001;
  scene.add(light);
  const group = new THREE.Group();
  scene.add(group);
  const white = new THREE.MeshPhysicalMaterial({
    color: 0xf8f7f4,
    roughness: 0.42,
  });
  const ink = new THREE.MeshPhysicalMaterial({
    color: 0x111315,
    roughness: 0.4,
  });
  const tray = new THREE.Mesh(
    new RoundedBoxGeometry(7.8, 0.2, 3.6, 3, 0.13),
    new THREE.MeshStandardMaterial({ color: 0xd3d7d7, roughness: 0.85 }),
  );
  tray.position.y = -0.38;
  tray.receiveShadow = true;
  group.add(tray);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.ShadowMaterial({ opacity: 0.13 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  scene.add(floor);
  const textures: THREE.Texture[] = [];
  const keyGeometry = new RoundedBoxGeometry(2.05, 0.6, 1.25, 4, 0.16);
  const labelGeometry = new THREE.PlaneGeometry(1.85, 1);
  function key(label: string, x: number, z: number, dark = false) {
    const cap = new THREE.Mesh(keyGeometry, dark ? ink : white);
    cap.position.set(x, dark ? 0.65 : 0, z);
    cap.castShadow = true;
    cap.receiveShadow = true;
    group.add(cap);
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 256;
    const context = labelCanvas.getContext('2d');
    if (!context) throw new Error('Label canvas unavailable');
    context.fillStyle = dark ? '#fafafa' : '#22272a';
    context.font = `600 ${dark ? 57 : 46}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, 256, 128);
    const texture = new THREE.CanvasTexture(labelCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    const face = new THREE.Mesh(
      labelGeometry,
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      }),
    );
    face.rotation.x = -Math.PI / 2;
    face.position.set(x, dark ? 0.955 : 0.305, z);
    group.add(face);
  }
  ['Research', 'Plan', 'Design', 'Build', 'Review', 'Handoff'].forEach(
    (label, index) =>
      key(label, ((index % 3) - 1) * 2.35, index < 3 ? -0.95 : 0.95),
  );
  key('foundry', 0, 0, true);
  let visible = true;
  let interactive = true;
  let disposed = false;
  let frame = 0;
  function requestRender() {
    if (disposed || frame || !visible || document.hidden) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      try {
        renderer.render(scene, camera);
      } catch {
        onError();
      }
    });
  }
  function resize() {
    const width = host.clientWidth;
    const height = Math.max(1, canvas.clientHeight);
    const aspect = width / height;
    const span = Math.max(3.2, 4.65 / aspect);
    Object.assign(camera, {
      left: -span * aspect,
      right: span * aspect,
      top: span,
      bottom: -span,
    });
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    requestRender();
  }
  function move(event: PointerEvent) {
    if (!interactive || !visible || document.hidden) return;
    const rect = host.getBoundingClientRect();
    group.rotation.y = ((event.clientX - rect.left) / rect.width - 0.5) * 0.18;
    group.rotation.x = ((event.clientY - rect.top) / rect.height - 0.5) * 0.08;
    requestRender();
  }
  function reset() {
    group.rotation.set(0, 0, 0);
    requestRender();
  }
  function visibility() {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else requestRender();
  }
  function lost(event: Event) {
    event.preventDefault();
    onError();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  host.addEventListener('pointermove', move);
  host.addEventListener('pointerleave', reset);
  document.addEventListener('visibilitychange', visibility);
  canvas.addEventListener('webglcontextlost', lost);
  resize();
  return {
    setVisible(value) {
      visible = value;
      if (!value) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else requestRender();
    },
    setInteractive(value) {
      interactive = value;
      if (!value) reset();
    },
    dispose(releaseContext = false) {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', reset);
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('webglcontextlost', lost);
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          geometries.add(object.geometry);
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            materials.add(material);
        }
      });
      geometries.forEach((value) => value.dispose());
      materials.forEach((value) => value.dispose());
      textures.forEach((value) => value.dispose());
      renderer.dispose();
      if (releaseContext) renderer.forceContextLoss();
    },
  };
}
