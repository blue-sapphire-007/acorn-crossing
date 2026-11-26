import { GameApp } from '../engine/GameApp.ts';
import type { Scene } from '../engine/GameApp.ts';

interface PrologueBeat {
  imageKey: 'prologue_storm' | 'concept_art';
  text: string;
  rainIntensity: number;
  zoomStart: number;
  zoomEnd: number;
}

interface RainDrop {
  x: number;
  y: number;
  len: number;
  speed: number;
}

export class PrologueScene implements Scene {
  public readonly key = 'PrologueScene';
  private app!: GameApp;

  private beats: PrologueBeat[] = [
    {
      imageKey: 'prologue_storm',
      text: 'You are an acorn of Valley Oak Metropolis, where your parents tame birds for flight. Inspired by legends of your adventurous grandfather, one chilly autumn morning you gather berries, hop onto Maple Leaf—your loyal chipping sparrow—and soar into the wispy morning fog...',
      rainIntensity: 0.25,
      zoomStart: 1.02,
      zoomEnd: 1.09
    },
    {
      imageKey: 'prologue_storm',
      text: 'Before you travel far, dark gale-winds howl across the canopy and cold rain pelts your raffia scarf! Buffeted off course through swirling oak leaves, you and Maple Leaf dive beneath ancient boughs for emergency shelter...',
      rainIntensity: 1.0,
      zoomStart: 1.09,
      zoomEnd: 1.16
    },
    {
      imageKey: 'concept_art',
      text: 'When the rain finally clears, golden sunlight filters into an unfamiliar woodland clearing far from home. With winter approaching and squirrels slumbering underground until spring, it is time to forage, gather leaves and sticks, and build your settlement...',
      rainIntensity: 0.0,
      zoomStart: 1.08,
      zoomEnd: 1.01
    }
  ];

  private beatIndex: number = 0;
  private beatElapsed: number = 0;
  private readonly beatDuration: number = 9.5;
  private typedChars: number = 0;
  private raindrops: RainDrop[] = [];
  private skipBtnBounds = { x: 1090, y: 24, w: 164, h: 38 };
  private nextBtnBounds = { x: 1080, y: 656, w: 160, h: 38 };

  public init(app: GameApp): void {
    this.app = app;
    for (let i = 0; i < 110; i++) {
      this.raindrops.push({
        x: Math.random() * 1400,
        y: Math.random() * 720,
        len: 16 + Math.random() * 22,
        speed: 520 + Math.random() * 280
      });
    }
  }

  public enter(): void {
    this.beatIndex = 0;
    this.beatElapsed = 0;
    this.typedChars = 0;
    this.app.audio.startStormWind(0.06);
  }

  public exit(): void {
    this.app.audio.stopStormWind();
  }

  private finishPrologue(): void {
    this.app.audio.playSparrowChirp();
    this.app.startScene('ClearingScene');
  }

  private advanceBeat(): void {
    const currentText = this.beats[this.beatIndex].text;
    if (this.typedChars < currentText.length) {
      // Complete current text reveal immediately
      this.typedChars = currentText.length;
      return;
    }
    if (this.beatIndex < this.beats.length - 1) {
      this.beatIndex++;
      this.beatElapsed = 0;
      this.typedChars = 0;
      if (this.beatIndex === 2) {
        this.app.audio.stopStormWind();
        this.app.audio.playSparrowChirp();
      }
    } else {
      this.finishPrologue();
    }
  }

  public update(_time: number, dt: number): void {
    // Spacebar skips directly to gameplay as specified in GAME_DESIGN_SPEC.md Section 5
    if (this.app.input.wasPressed('Space') || this.app.input.wasPressed('Escape')) {
      this.finishPrologue();
      return;
    }

    if (this.app.input.wasPressed('Enter') || this.app.input.wasPressed('KeyE')) {
      this.advanceBeat();
      return;
    }

    if (this.app.input.consumeClick()) {
      const px = this.app.input.pointer.x;
      const py = this.app.input.pointer.y;
      const sb = this.skipBtnBounds;
      if (px >= sb.x && px <= sb.x + sb.w && py >= sb.y && py <= sb.y + sb.h) {
        this.finishPrologue();
        return;
      }
      this.advanceBeat();
      return;
    }

    this.beatElapsed += dt;
    const beat = this.beats[this.beatIndex];
    this.typedChars = Math.min(beat.text.length, this.typedChars + dt * 44);

    if (this.beatElapsed >= this.beatDuration) {
      if (this.beatIndex < this.beats.length - 1) {
        this.beatIndex++;
        this.beatElapsed = 0;
        this.typedChars = 0;
        if (this.beatIndex === 2) {
          this.app.audio.stopStormWind();
          this.app.audio.playSparrowChirp();
        }
      }
    }

    // Animate slanting rain
    for (const r of this.raindrops) {
      r.x -= r.speed * 0.35 * dt;
      r.y += r.speed * dt;
      if (r.y > 740) {
        r.y = -30;
        r.x = Math.random() * 1480;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const w = this.app.width;
    const h = this.app.height;
    const beat = this.beats[this.beatIndex];

    ctx.fillStyle = '#140e09';
    ctx.fillRect(0, 0, w, h);

    // Animated Ken-Burns storybook illustration panel
    const img = this.app.getTexture(beat.imageKey);
    if (img) {
      const t = Math.min(1, this.beatElapsed / this.beatDuration);
      const scale = beat.zoomStart + (beat.zoomEnd - beat.zoomStart) * t;

      ctx.save();
      ctx.translate(w / 2, (h - 140) / 2 + 12);
      ctx.scale(scale, scale);

      const coverScale = Math.max(w / img.width, (h - 110) / img.height);
      const dw = img.width * coverScale;
      const dh = img.height * coverScale;
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }

    // Slanting pen-and-ink rain streaks during storm beats
    if (beat.rainIntensity > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(225, 232, 240, ${0.42 * beat.rainIntensity})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      const activeDrops = Math.floor(this.raindrops.length * beat.rainIntensity);
      for (let i = 0; i < activeDrops; i++) {
        const r = this.raindrops[i];
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x - r.len * 0.35, r.y + r.len);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Vignette ink frame
    const vig = ctx.createRadialGradient(w / 2, h / 2 - 40, 320, w / 2, h / 2, 760);
    vig.addColorStop(0, 'rgba(20, 12, 6, 0)');
    vig.addColorStop(1, 'rgba(18, 11, 5, 0.65)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // Top-right Skip button ([Space] Skip Prologue)
    const sb = this.skipBtnBounds;
    ctx.save();
    ctx.fillStyle = 'rgba(34, 23, 14, 0.88)';
    ctx.strokeStyle = '#c89d54';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(sb.x, sb.y, sb.w, sb.h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f5ead6';
    ctx.font = '600 14px "Lora", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('[Space] Skip ➔', sb.x + sb.w / 2, sb.y + 24);
    ctx.restore();

    // Chapter badge top-left
    ctx.save();
    ctx.fillStyle = 'rgba(34, 23, 14, 0.86)';
    ctx.strokeStyle = '#9c7338';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(26, 24, 235, 36, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e5be77';
    ctx.font = '700 14px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(`PROLOGUE  •  PANEL ${this.beatIndex + 1} OF ${this.beats.length}`, 42, 47);
    ctx.restore();

    // Bottom Storybook Parchment Narrative Ticker Bar
    const barY = 564;
    const barH = 140;
    ctx.save();
    ctx.fillStyle = '#f3e5c8';
    ctx.strokeStyle = '#2d1c0f';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(26, barY, w - 52, barH, 12);
    ctx.fill();
    ctx.stroke();

    // Inner ink double-line rule (hand-drawn Winter Burrow UI style)
    ctx.strokeStyle = '#8b6336';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(33, barY + 7, w - 66, barH - 14, 8);
    ctx.stroke();

    // Narrative text
    const visibleText = beat.text.slice(0, Math.floor(this.typedChars));
    ctx.fillStyle = '#2b1a0e';
    ctx.font = '500 18.5px "Lora", Georgia, serif';
    ctx.textAlign = 'left';
    this.drawWrappedText(ctx, visibleText, 54, barY + 38, w - 280, 27);

    // Continue / Begin button inside parchment bar
    const nb = this.nextBtnBounds;
    ctx.fillStyle = '#3b2615';
    ctx.strokeStyle = '#1b1008';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(nb.x, nb.y, nb.w, nb.h, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f6ebd4';
    ctx.font = '600 14px "Lora", Georgia, serif';
    ctx.textAlign = 'center';
    const label = this.beatIndex === this.beats.length - 1 ? 'Begin Chapter 1 ➔' : 'Next Page [Click]';
    ctx.fillText(label, nb.x + nb.w / 2, nb.y + 24);
    ctx.restore();
  }

  private drawWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ): void {
    const words = text.split(' ');
    let line = '';
    let currY = y;

    for (let i = 0; i < words.length; i++) {
      const test = line + words[i] + ' ';
      if (ctx.measureText(test).width > maxWidth && i > 0) {
        ctx.fillText(line, x, currY);
        line = words[i] + ' ';
        currY += lineHeight;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, currY);
  }
}
