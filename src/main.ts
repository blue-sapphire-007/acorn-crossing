import { GameApp } from './engine/GameApp.ts';
import { BootScene } from './scenes/BootScene.ts';
import { PrologueScene } from './scenes/PrologueScene.ts';
import { ClearingScene } from './scenes/ClearingScene.ts';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Missing #game-canvas element');
  }

  const app = new GameApp(canvas);
  app.registerScene(new BootScene());
  app.registerScene(new PrologueScene());
  app.registerScene(new ClearingScene());

  app.startScene('BootScene');
  app.start();
});
