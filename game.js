/**
 * TURBO LANE - HIGH POLISH 3-LANE CAR RACING GAME
 * Engine: HTML5 Canvas 2D
 * Audio: Synthesized Web Audio API
 */

// --- CONFIGURATION CONSTANTS ---
const LANE_COUNT = 3;
const BASE_ROAD_SPEED = 12;      // Initial scrolling speed
const MAX_ROAD_SPEED = 32;       // Cap on progressive difficulty
const ENEMY_BASE_SPEED = 5;      // Enemy car driving speed (slower than player)
const ACCELERATION_INTERVAL = 5000; // Speed increases every 5s
const ACCELERATION_RATE = 0.08;   // Speed increase multiplier (8% per tier)
const SPAWN_INTERVAL_INITIAL = 1700; // Spawn traffic every 1.7s
const SPAWN_INTERVAL_MIN = 800;      // Cap on spawning rate
const COLLISION_INSET_X = 6;     // Pixel inset for bumper collision
const COLLISION_INSET_Y = 10;    // Pixel inset for fender collision

// --- SOUND CONTROLLER (WEB AUDIO API SYNTHESIZER) ---
class SoundController {
    constructor() {
        this.ctx = null;
        this.enabled = localStorage.getItem('turbo_lane_sound') !== 'false';
        this.engineOsc = null;
        this.engineGain = null;
        this.updateSoundButtonUI();
    }

    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
    }

    resume() {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem('turbo_lane_sound', this.enabled);
        this.updateSoundButtonUI();
        
        if (this.enabled) {
            this.resume();
            if (game && game.state === 'PLAYING') {
                this.startEngine();
            }
        } else {
            this.stopEngine();
        }
    }

    updateSoundButtonUI() {
        const btn = document.getElementById('soundToggle');
        if (btn) {
            if (this.enabled) {
                btn.innerHTML = '🔊 Sound On';
                btn.classList.remove('muted');
            } else {
                btn.innerHTML = '🔇 Muted';
                btn.classList.add('muted');
            }
        }
    }

    startEngine() {
        if (!this.enabled) return;
        this.resume();
        if (!this.ctx) return;

        this.stopEngine(); // Safety check

        try {
            // Engine synthesizer: deep double-oscillator hum
            this.engineOsc = this.ctx.createOscillator();
            this.engineOsc.type = 'sawtooth';
            this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime); // Low baseline pitch

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(140, this.ctx.currentTime); // Deep muffle

            this.engineGain = this.ctx.createGain();
            this.engineGain.gain.setValueAtTime(0.08, this.ctx.currentTime); // Low background volume

            this.engineOsc.connect(filter);
            filter.connect(this.engineGain);
            this.engineGain.connect(this.ctx.destination);

            this.engineOsc.start();
        } catch (e) {
            console.warn("Failed to synthesize engine sound: ", e);
        }
    }

    updateEnginePitch(speedRatio) {
        if (!this.enabled || !this.engineOsc || !this.ctx) return;
        
        // Pitch ramps up and opens filter as car drives faster
        const targetPitch = 45 + (speedRatio * 55); // 45Hz -> 100Hz
        this.engineOsc.frequency.setTargetAtTime(targetPitch, this.ctx.currentTime, 0.1);
    }

    stopEngine() {
        if (this.engineOsc) {
            try {
                this.engineOsc.stop();
                this.engineOsc.disconnect();
            } catch (e) {}
            this.engineOsc = null;
        }
        this.engineGain = null;
    }

    playSteerSound() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        try {
            // Steering whoosh: quick pitch swept triangle
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(160, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.15);

            gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.18);
        } catch (e) {}
    }

    playPassSound() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        try {
            // Retro synth pass ring: soft chime
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5 note
            osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.08); // A5 note

            gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.25);
        } catch (e) {}
    }

    playCrashSound() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        try {
            const bufferSize = this.ctx.sampleRate * 1.5; // 1.5 seconds noise
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            
            // Generate raw white noise
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noiseNode = this.ctx.createBufferSource();
            noiseNode.buffer = buffer;

            // Low pass filter for heavy explosion explosion bass
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(250, this.ctx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 1.2);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.4);

            noiseNode.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            noiseNode.start();
            noiseNode.stop(this.ctx.currentTime + 1.5);
            
            // Add a sub-bass sine drop for impact weight
            const sub = this.ctx.createOscillator();
            const subGain = this.ctx.createGain();
            sub.type = 'sine';
            sub.frequency.setValueAtTime(100, this.ctx.currentTime);
            sub.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.6);
            
            subGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
            subGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.6);
            
            sub.connect(subGain);
            subGain.connect(this.ctx.destination);
            sub.start();
            sub.stop(this.ctx.currentTime + 0.65);
        } catch (e) {}
    }
}

const sounds = new SoundController();

// --- EXHAUST FLAME PARTICLE CLASS ---
class Particle {
    constructor(x, y, scale = 1) {
        this.x = x;
        this.y = y;
        // Float upwards slightly relative to player tailpipe
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = Math.random() * 3 + 2; // Moving upwards relative to car (down canvas)
        this.maxLife = Math.random() * 15 + 15;
        this.life = this.maxLife;
        this.size = (Math.random() * 4 + 4) * scale;
        // Fire colors: Yellow/Cyan/Orange core fading to hot pink
        const rand = Math.random();
        if (rand < 0.2) {
            this.color = { r: 0, g: 255, b: 240 }; // Neon cyan core
        } else if (rand < 0.6) {
            this.color = { r: 255, g: 234, b: 0 }; // Neon yellow
        } else {
            this.color = { r: 255, g: 0, b: 127 }; // Neon pink
        }
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }

    draw(ctx) {
        const ratio = this.life / this.maxLife;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter'; // Additive blending for extra glowing fire
        ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${ratio})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * ratio, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// --- CORE GAME ENGINE CLASS ---
class TurboLaneGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Setup scaling factor for HD retina displays
        this.dpr = window.devicePixelRatio || 1;
        this.baseWidth = 480;
        this.baseHeight = 720;
        this.setupCanvasDimensions();

        // Steering coordinates config
        this.laneWidth = this.baseWidth / LANE_COUNT;
        this.laneCenters = [
            this.laneWidth * 0.5,
            this.laneWidth * 1.5,
            this.laneWidth * 2.5
        ];

        // State & HUD
        this.state = 'START'; // 'START' | 'PLAYING' | 'GAMEOVER'
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('turbo_lane_highscore')) || 0;
        
        // Scrolling animation
        this.roadOffset = 0;
        
        // Difficulty values
        this.speed = BASE_ROAD_SPEED;
        this.spawnInterval = SPAWN_INTERVAL_INITIAL;
        this.level = 1;
        this.lastDifficultyIncrease = 0;

        // Player instance settings
        this.player = {
            lane: 1, // Start in center lane
            x: this.laneCenters[1],
            y: this.baseHeight - 140,
            width: 58,
            height: 104,
            steerSpeed: 0.22 // Snappy Lerp constant
        };

        // Entities
        this.enemies = [];
        this.particles = [];
        
        // Spawning timer
        this.lastSpawnTime = 0;
        
        // Key bindings state
        this.keys = {};
        
        // Camera Screen Shake for crash impact
        this.shakeTimer = 0;
        this.shakeAmount = 0;

        // Event hooks
        this.bindEvents();
        this.updateHighScoreHUD();

        // Start animation frame loop
        this.lastFrameTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    setupCanvasDimensions() {
        this.canvas.width = this.baseWidth * this.dpr;
        this.canvas.height = this.baseHeight * this.dpr;
        this.ctx.scale(this.dpr, this.dpr);
    }

    bindEvents() {
        // Keyboard Steering Listeners
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (this.state !== 'PLAYING') return;

            if ((key === 'arrowleft' || key === 'a') && !this.keys[key]) {
                this.steerPlayer(-1);
            } else if ((key === 'arrowright' || key === 'd') && !this.keys[key]) {
                this.steerPlayer(1);
            }
            this.keys[key] = true;
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = false;
        });

        // HTML Overlay Button Listeners
        document.getElementById('startButton').addEventListener('click', () => {
            sounds.resume();
            this.startGame();
        });

        document.getElementById('restartButton').addEventListener('click', () => {
            sounds.resume();
            this.startGame();
        });

        document.getElementById('soundToggle').addEventListener('click', () => {
            sounds.toggle();
        });

        // Touch/Mouse accessibility steer regions
        document.getElementById('tapLeft').addEventListener('pointerdown', (e) => {
            e.preventDefault();
            if (this.state === 'PLAYING') this.steerPlayer(-1);
        });

        document.getElementById('tapRight').addEventListener('pointerdown', (e) => {
            e.preventDefault();
            if (this.state === 'PLAYING') this.steerPlayer(1);
        });

        // Recalculate scaling if browser window scales
        window.addEventListener('resize', () => {
            this.setupCanvasDimensions();
        });
    }

    steerPlayer(direction) {
        let nextLane = this.player.lane + direction;
        if (nextLane >= 0 && nextLane < LANE_COUNT) {
            this.player.lane = nextLane;
            sounds.playSteerSound();
        }
    }

    startGame() {
        this.state = 'PLAYING';
        this.score = 0;
        this.speed = BASE_ROAD_SPEED;
        this.spawnInterval = SPAWN_INTERVAL_INITIAL;
        this.level = 1;
        this.lastDifficultyIncrease = performance.now();
        this.enemies = [];
        this.particles = [];
        this.lastSpawnTime = performance.now();
        this.player.lane = 1;
        this.player.x = this.laneCenters[1];
        
        // Reset overlay classes
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('gameOverScreen').classList.add('hidden');
        document.getElementById('gameHud').classList.remove('hidden');

        document.getElementById('hudScore').innerText = '00000';
        this.updateSpeedHUD();
        this.updateHighScoreHUD();

        sounds.startEngine();
    }

    gameOver() {
        this.state = 'GAMEOVER';
        sounds.stopEngine();
        sounds.playCrashSound();
        
        // Trigger high-impact screenshake
        this.shakeTimer = 35;
        this.shakeAmount = 18;

        // Persistent high scores
        let isNewHigh = false;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('turbo_lane_highscore', this.highScore);
            isNewHigh = true;
        }

        // Show game over metrics in overlay
        document.getElementById('finalScore').innerText = this.score;
        document.getElementById('bestScore').innerText = this.highScore;
        
        const highscoreBanner = document.getElementById('newHighScoreRow');
        if (isNewHigh) {
            highscoreBanner.classList.remove('hidden');
        } else {
            highscoreBanner.classList.add('hidden');
        }

        document.getElementById('gameOverScreen').classList.remove('hidden');
        document.getElementById('gameHud').classList.add('hidden');
    }

    updateSpeedHUD() {
        const speedValue = Math.round(this.speed * 10); // Scale factor for arcade realism
        document.getElementById('hudSpeed').innerHTML = `${speedValue}<span class="unit">KM/H</span>`;
    }

    updateHighScoreHUD() {
        const padScore = String(this.highScore).padStart(5, '0');
        document.getElementById('hudHighScore').innerText = padScore;
    }

    // --- GAME LOOP ---
    loop(timestamp) {
        const dt = timestamp - this.lastFrameTime;
        this.lastFrameTime = timestamp;

        this.update(dt, timestamp);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    // --- LOGIC CALCULATIONS ---
    update(dt, timestamp) {
        // Camera shake decay
        if (this.shakeTimer > 0) {
            this.shakeTimer--;
            this.shakeAmount *= 0.92;
        }

        if (this.state !== 'PLAYING') {
            // Maintain ambient background animations even in menu (scrolling grid)
            this.roadOffset = (this.roadOffset + 2) % 60;
            
            // Just update particle effects during menus
            this.particles.forEach(p => p.update());
            this.particles = this.particles.filter(p => p.life > 0);
            return;
        }

        // 1. Progressive Difficulty Check (every 5 seconds)
        if (timestamp - this.lastDifficultyIncrease > ACCELERATION_INTERVAL) {
            this.level++;
            // Accelerate slightly up to maximum speed limit
            this.speed = Math.min(MAX_ROAD_SPEED, BASE_ROAD_SPEED + (this.level - 1) * ACCELERATION_RATE * BASE_ROAD_SPEED);
            // Spawn traffic faster proportional to level
            this.spawnInterval = Math.max(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_INITIAL - (this.level - 1) * 80);
            
            this.lastDifficultyIncrease = timestamp;
            this.updateSpeedHUD();
        }

        // Modulate engine roar sound pitch relative to speed
        const speedRatio = (this.speed - BASE_ROAD_SPEED) / (MAX_ROAD_SPEED - BASE_ROAD_SPEED);
        sounds.updateEnginePitch(speedRatio);

        // 2. Road Scrolling Motion
        this.roadOffset = (this.roadOffset + this.speed) % 80;

        // 3. Smooth Player Steering (Snap Lerp interpolation)
        const targetX = this.laneCenters[this.player.lane];
        this.player.x += (targetX - this.player.x) * this.player.steerSpeed;

        // 4. Emitter exhaust flames (particles emit from left/right exhaust tips)
        if (Math.random() < 0.8) {
            const leftExhaustX = this.player.x - 18;
            const rightExhaustX = this.player.x + 18;
            const exhaustY = this.player.y + this.player.height / 2;
            
            // Scale fire intensity based on speed
            const sizeMultiplier = 0.8 + speedRatio * 0.4;
            this.particles.push(new Particle(leftExhaustX, exhaustY, sizeMultiplier));
            this.particles.push(new Particle(rightExhaustX, exhaustY, sizeMultiplier));
        }

        // Update Flame particles
        this.particles.forEach(p => p.update());
        this.particles = this.particles.filter(p => p.life > 0);

        // 5. Traffic Spawning Engine
        if (timestamp - this.lastSpawnTime > this.spawnInterval) {
            this.spawnTraffic();
            this.lastSpawnTime = timestamp;
        }

        // 6. Update Traffic Movement & Passing Math
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            
            // Enemy speeds down relative to player car speed
            enemy.y += (this.speed - enemy.speed);

            // Passing Points Detection
            if (!enemy.passed && enemy.y > (this.player.y + this.player.height/2)) {
                enemy.passed = true;
                this.score += 10;
                sounds.playPassSound();
                
                // Update HUD immediately
                const scoreStr = String(this.score).padStart(5, '0');
                document.getElementById('hudScore').innerText = scoreStr;
            }

            // Remove out-of-screen traffic
            if (enemy.y > this.baseHeight + 100) {
                this.enemies.splice(i, 1);
                continue;
            }

            // 7. Precise Box Collision Detection (Inset hitboxes)
            if (this.checkCollision(this.player, enemy)) {
                this.gameOver();
                break;
            }
        }
    }

    spawnTraffic() {
        // Smart Spawner: Avoid trap layouts (e.g. blockades in all 3 lanes simultaneously)
        // Select random lanes, but guarantee at least one lane is safe to traverse
        const availableLanes = [0, 1, 2];
        const numSpawns = (Math.random() < 0.25 + (this.level * 0.05)) ? 2 : 1; // Double spawns increase as level rises

        // Shuffle lanes array
        for (let i = availableLanes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableLanes[i], availableLanes[j]] = [availableLanes[j], availableLanes[i]];
        }

        // If spawning 2 cars, spawn them at slightly different y offsets so player has reaction buffer
        for (let k = 0; k < Math.min(numSpawns, LANE_COUNT - 1); k++) {
            const spawnLane = availableLanes[k];
            const laneX = this.laneCenters[spawnLane];
            
            // Random styling parameters
            const enemyColors = [
                '#ff007f', // Neon Hot Pink
                '#00f0ff', // Cyber Blue
                '#ffea00', // Laser Yellow
                '#a020f0', // Acid Purple
                '#ff6200'  // Solar Orange
            ];
            const color = enemyColors[Math.floor(Math.random() * enemyColors.length)];
            const yOffset = -100 - (k * 120); // Stagger double-spawns dynamically
            
            // Base cruising speed of enemy traffic
            const enemySpeed = ENEMY_BASE_SPEED + (Math.random() - 0.5) * 1.5;

            this.enemies.push({
                x: laneX,
                y: yOffset,
                width: 58,
                height: 104,
                color: color,
                speed: enemySpeed,
                passed: false,
                designId: Math.floor(Math.random() * 2) // Alternating visual designs
            });
        }
    }

    checkCollision(rect1, rect2) {
        // Calculate precise collision boundaries with custom aesthetic buffer insets
        const box1 = {
            left: rect1.x - rect1.width/2 + COLLISION_INSET_X,
            right: rect1.x + rect1.width/2 - COLLISION_INSET_X,
            top: rect1.y - rect1.height/2 + COLLISION_INSET_Y,
            bottom: rect1.y + rect1.height/2 - COLLISION_INSET_Y
        };

        const box2 = {
            left: rect2.x - rect2.width/2 + COLLISION_INSET_X,
            right: rect2.x + rect2.width/2 - COLLISION_INSET_X,
            top: rect2.y - rect2.height/2 + COLLISION_INSET_Y,
            bottom: rect2.y + rect2.height/2 - COLLISION_INSET_Y
        };

        return (
            box1.left < box2.right &&
            box1.right > box2.left &&
            box1.top < box2.bottom &&
            box1.bottom > box2.top
        );
    }

    // --- CANVAS DRAW RENDERING MODULES ---
    draw() {
        this.ctx.clearRect(0, 0, this.baseWidth, this.baseHeight);
        
        this.ctx.save();
        // Dynamic screenshake translations
        if (this.shakeTimer > 0) {
            const dx = (Math.random() - 0.5) * this.shakeAmount;
            const dy = (Math.random() - 0.5) * this.shakeAmount;
            this.ctx.translate(dx, dy);
        }

        // Render Layers
        this.drawBackground();
        this.drawRoad();
        
        // Render exhaust flames below cars
        this.particles.forEach(p => p.draw(this.ctx));

        // Draw Player Car
        this.drawPlayerCar();

        // Draw Traffic Cars
        this.enemies.forEach(enemy => this.drawEnemyCar(enemy));

        this.ctx.restore();
    }

    drawBackground() {
        // Dark grid space backdrop fill
        this.ctx.fillStyle = '#0a0515';
        this.ctx.fillRect(0, 0, this.baseWidth, this.baseHeight);

        // Perspective side-grid aesthetics (faded cyber glow)
        this.ctx.strokeStyle = 'rgba(255, 0, 127, 0.04)';
        this.ctx.lineWidth = 1;
        const gridSpacing = 40;
        
        // Vertical grids extending outwards
        for (let x = -80; x < this.baseWidth + 80; x += gridSpacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x * 1.2 - 40, this.baseHeight);
            this.ctx.stroke();
        }
    }

    drawRoad() {
        const roadX = 0;
        const roadW = this.baseWidth;

        // Main asphalt fill
        this.ctx.fillStyle = '#0f0a1c';
        this.ctx.fillRect(roadX, 0, roadW, this.baseHeight);

        // Outer borders of highway lanes (glowing hot pink shoulders)
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = 'rgba(255, 0, 127, 0.5)';
        this.ctx.strokeStyle = '#ff007f';
        this.ctx.lineWidth = 4;
        
        this.ctx.beginPath();
        this.ctx.moveTo(15, 0);
        this.ctx.lineTo(15, this.baseHeight);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(roadW - 15, 0);
        this.ctx.lineTo(roadW - 15, this.baseHeight);
        this.ctx.stroke();

        this.ctx.shadowBlur = 0; // Reset shadow glow

        // Draw scrolling lane divider stripes (yellow dashed markers)
        this.ctx.strokeStyle = 'rgba(255, 234, 0, 0.6)';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([40, 40]); // Dash length 40, spacing 40

        // Lane marker 1 (between Left & Center)
        this.ctx.save();
        this.ctx.lineDashOffset = -this.roadOffset;
        this.ctx.beginPath();
        this.ctx.moveTo(this.laneWidth, -80);
        this.ctx.lineTo(this.laneWidth, this.baseHeight + 80);
        this.ctx.stroke();

        // Lane marker 2 (between Center & Right)
        this.ctx.beginPath();
        this.ctx.moveTo(this.laneWidth * 2, -80);
        this.ctx.lineTo(this.laneWidth * 2, this.baseHeight + 80);
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawPlayerCar() {
        const car = this.player;
        this.ctx.save();
        this.ctx.translate(car.x, car.y);

        // Subtly rotate slightly based on steer velocity for dynamic tilt feel!
        const targetX = this.laneCenters[car.lane];
        const steerDifference = targetX - car.x;
        const tiltAngle = steerDifference * 0.0006;
        this.ctx.rotate(tiltAngle);

        // Shadow Glow (glowing green underglow)
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = 'rgba(0, 255, 135, 0.4)';
        
        // 1. Core Chassis (Player Green)
        this.ctx.fillStyle = '#00ff87';
        
        // Rounded sports chassis path
        this.ctx.beginPath();
        this.ctx.moveTo(-22, -48);
        this.ctx.bezierCurveTo(-22, -54, 22, -54, 22, -48); // Nose
        this.ctx.quadraticCurveTo(24, 0, 26, 42);          // Right side
        this.ctx.bezierCurveTo(20, 52, -20, 52, -26, 42);  // Rear bumper
        this.ctx.quadraticCurveTo(-24, 0, -22, -48);        // Left side
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.shadowBlur = 0; // Disable underglow for details

        // 2. Matte carbon spoilers & side mirrors
        this.ctx.fillStyle = '#1a1626';
        
        // Side mirrors
        this.ctx.fillRect(-27, -24, 5, 8);
        this.ctx.fillRect(22, -24, 5, 8);
        
        // Rear spoiler wings
        this.ctx.fillRect(-28, 38, 8, 8);
        this.ctx.fillRect(20, 38, 8, 8);
        this.ctx.fillRect(-28, 44, 56, 4); // Spoiler wing link

        // 3. Black Rubber Wheels
        this.ctx.fillStyle = '#110e19';
        this.ctx.fillRect(-25, -38, 6, 16); // Front Left
        this.ctx.fillRect(19, -38, 6, 16);  // Front Right
        this.ctx.fillRect(-28, 18, 6, 20);  // Back Left
        this.ctx.fillRect(22, 18, 6, 20);   // Back Right

        // Wheel caps (alloy details)
        this.ctx.fillStyle = '#8d83a3';
        this.ctx.fillRect(-24, -32, 2, 4);
        this.ctx.fillRect(22, -32, 2, 4);
        this.ctx.fillRect(-27, 26, 2, 4);
        this.ctx.fillRect(25, 26, 2, 4);

        // 4. Windows Cabin (Detailed Glass)
        this.ctx.fillStyle = '#1c1f30';
        this.ctx.beginPath();
        this.ctx.moveTo(-15, -26);
        this.ctx.lineTo(15, -26);
        this.ctx.quadraticCurveTo(18, 16, 16, 24);
        this.ctx.lineTo(-16, 24);
        this.ctx.quadraticCurveTo(-18, 16, -15, -26);
        this.ctx.closePath();
        this.ctx.fill();

        // High gloss glass highlights (reflection streaks)
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();
        this.ctx.moveTo(-10, -22);
        this.ctx.lineTo(4, 20);
        this.ctx.moveTo(-6, -22);
        this.ctx.lineTo(-1, 10);
        this.ctx.stroke();

        // 5. Front Windshield hood outline detail
        this.ctx.strokeStyle = '#00ad5a';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(-14, -34);
        this.ctx.quadraticCurveTo(0, -42, 14, -34);
        this.ctx.stroke();

        // 6. Glowing Headlights Beams (Layered alpha triangle)
        const lightGrad = this.ctx.createLinearGradient(0, -52, 0, -220);
        lightGrad.addColorStop(0, 'rgba(255, 255, 230, 0.4)');
        lightGrad.addColorStop(1, 'rgba(255, 255, 230, 0)');
        
        this.ctx.fillStyle = lightGrad;
        
        // Left Beam
        this.ctx.beginPath();
        this.ctx.moveTo(-16, -52);
        this.ctx.lineTo(-45, -220);
        this.ctx.lineTo(10, -220);
        this.ctx.closePath();
        this.ctx.fill();

        // Right Beam
        this.ctx.beginPath();
        this.ctx.moveTo(16, -52);
        this.ctx.lineTo(-10, -220);
        this.ctx.lineTo(45, -220);
        this.ctx.closePath();
        this.ctx.fill();

        // Front Headlight lamps
        this.ctx.fillStyle = '#ffea00';
        this.ctx.fillRect(-18, -52, 5, 2);
        this.ctx.fillRect(13, -52, 5, 2);

        // 7. Red Tail-Lights
        this.ctx.fillStyle = '#ff003c';
        this.ctx.fillRect(-18, 48, 6, 2);
        this.ctx.fillRect(12, 48, 6, 2);

        this.ctx.restore();
    }

    drawEnemyCar(enemy) {
        this.ctx.save();
        this.ctx.translate(enemy.x, enemy.y);
        
        // Shadows Underglow matching body paint color
        this.ctx.shadowBlur = 12;
        this.ctx.shadowColor = enemy.color;

        // 1. Core Chassis
        this.ctx.fillStyle = enemy.color;
        
        if (enemy.designId === 0) {
            // Sleek sports body design
            this.ctx.beginPath();
            this.ctx.moveTo(-20, -48);
            this.ctx.bezierCurveTo(-20, -52, 20, -52, 20, -48);
            this.ctx.quadraticCurveTo(22, 0, 24, 42);
            this.ctx.bezierCurveTo(18, 50, -18, 50, -24, 42);
            this.ctx.quadraticCurveTo(-22, 0, -20, -48);
            this.ctx.closePath();
            this.ctx.fill();
        } else {
            // Aggressive wide-body muscle style
            this.ctx.beginPath();
            this.ctx.moveTo(-23, -46);
            this.ctx.lineTo(23, -46);
            this.ctx.lineTo(21, -12);
            this.ctx.lineTo(25, 28);
            this.ctx.lineTo(-25, 28);
            this.ctx.lineTo(-21, -12);
            this.ctx.closePath();
            this.ctx.fill();
        }
        
        this.ctx.shadowBlur = 0; // Disable drop shadow

        // 2. Carbon spoiler/exhaust trim
        this.ctx.fillStyle = '#1c152b';
        this.ctx.fillRect(-25, 34, 50, 4);

        // 3. Black Rubber Wheels
        this.ctx.fillStyle = '#0f0d14';
        this.ctx.fillRect(-24, -36, 5, 14); // Front Left
        this.ctx.fillRect(19, -36, 5, 14);  // Front Right
        this.ctx.fillRect(-26, 16, 5, 18);  // Back Left
        this.ctx.fillRect(21, 16, 5, 18);   // Back Right

        // 4. Matte windshield cabin
        this.ctx.fillStyle = '#1b1b22';
        this.ctx.beginPath();
        this.ctx.moveTo(-14, -22);
        this.ctx.lineTo(14, -22);
        this.ctx.quadraticCurveTo(16, 12, 14, 20);
        this.ctx.lineTo(-14, 20);
        this.ctx.quadraticCurveTo(-16, 12, -14, -22);
        this.ctx.closePath();
        this.ctx.fill();

        // Window Highlights
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(-8, -18);
        this.ctx.lineTo(4, 15);
        this.ctx.stroke();

        // 5. Headlamps (White/Yellow headlights)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(-17, -50, 4, 2);
        this.ctx.fillRect(13, -50, 4, 2);

        // 6. Tail Lights (Always glowing on traffic)
        this.ctx.fillStyle = '#ff003c';
        this.ctx.fillRect(-16, 40, 5, 2);
        this.ctx.fillRect(11, 40, 5, 2);

        this.ctx.restore();
    }
}

// --- INITIALIZE INSTANCE ON LOAD ---
let game = null;
window.addEventListener('load', () => {
    game = new TurboLaneGame();
});
