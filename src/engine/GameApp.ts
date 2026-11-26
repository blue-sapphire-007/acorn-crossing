import { SoundEffects } from './SoundEffects.ts';

export interface Scene {
  readonly key: string;
  init(app: GameApp): void;
  enter(): void;
  exit(): void;
  update(time: number, dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
}

export interface PointerState {
  x: number; // In 1280x720 logical coordinates
  y: number;
  down: boolean;
  justClicked: boolean;
}

export class InputManager {
  private keysDown: Set<string> = new Set();
  private keysJustPressed: Set<string> = new Set();
  public pointer: PointerState = { x: 0, y: 0, down: false, justClicked: false };
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.keysDown.has(e.code)) {
        this.keysJustPressed.add(e.code);
      }
      this.keysDown.add(e.code);

      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      this.keysDown.delete(e.code);
    });

    const updatePointerCoords = (clientX: number, clientY: number) => {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      this.pointer.x = ((clientX - rect.left) / rect.width) * 1280;
      this.pointer.y = ((clientY - rect.top) / rect.height) * 720;
    };

    this.canvas.addEventListener('pointermove', (e: PointerEvent) => {
      updatePointerCoords(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      updatePointerCoords(e.clientX, e.clientY);
      this.pointer.down = true;
      this.pointer.justClicked = true;
    });

    window.addEventListener('pointerup', () => {
      this.pointer.down = false;
    });
  }

  public isDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  public wasPressed(code: string): boolean {
    if (this.keysJustPressed.has(code)) {
      this.keysJustPressed.delete(code);
      return true;
    }
    return false;
  }

  public consumeClick(): boolean {
    if (this.pointer.justClicked) {
      this.pointer.justClicked = false;
      return true;
    }
    return false;
  }

  public endFrame(): void {
    this.keysJustPressed.clear();
    this.pointer.justClicked = false;
  }
}

export class GameApp {
  public readonly width: number = 1280;
  public readonly height: number = 720;
  public readonly canvas: HTMLCanvasElement;
  public readonly ctx: CanvasRenderingContext2D;
  public readonly input: InputManager;
  public readonly audio: SoundEffects;
  public readonly textures: Map<string, HTMLImageElement> = new Map();

  private scenes: Map<string, Scene> = new Map();
  private activeScene: Scene | null = null;
  private lastTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Could not initialize 2D rendering context');
    }
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    this.input = new InputManager(this.canvas);
    this.audio = new SoundEffects();

    this.fitViewport();
    window.addEventListener('resize', () => this.fitViewport());
  }

  /**
   * Auto-scales 1280x720 (16:9) crisply with letterboxing to match any browser window
   */
  private fitViewport(): void {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const scale = Math.min(winW / this.width, winH / this.height);
    const displayW = Math.floor(this.width * scale);
    const displayH = Math.floor(this.height * scale);

    this.canvas.style.width = `${displayW}px`;
    this.canvas.style.height = `${displayH}px`;
  }

  public registerScene(scene: Scene): void {
    scene.init(this);
    this.scenes.set(scene.key, scene);
  }

  public startScene(key: string): void {
    const next = this.scenes.get(key);
    if (!next) {
      throw new Error(`Scene not found: ${key}`);
    }
    if (this.activeScene) {
      this.activeScene.exit();
    }
    this.activeScene = next;
    this.activeScene.enter();
  }

  public getTexture(key: string): HTMLImageElement | undefined {
    return this.textures.get(key);
  }

  public start(): void {
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private loop(now: number): void {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (this.activeScene) {
      this.activeScene.update(now / 1000, dt);
      this.activeScene.render(this.ctx);
    }

    this.input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }
}
