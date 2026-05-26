/**
 * TURBO LANE - EXTREME ARCADE RACER (MULTIPLAYER SUPPORT)
 * Engine: HTML5 Canvas 2D
 * Audio: Synthesized Web Audio API
 */

// --- CONFIGURATION CONSTANTS ---
const BASE_ROAD_SPEED = 12;         // Initial scrolling speed
const MAX_ROAD_SPEED = 32;          // Cap on progressive difficulty
const ENEMY_BASE_SPEED = 5.5;       // Enemy traffic baseline velocity
const ACCELERATION_INTERVAL = 5000;    // Game speeds up every 5s
const ACCELERATION_RATE = 0.08;      // Speed multiplier rate
const SPAWN_INTERVAL_INITIAL = 1700;   // Traffic spawns every 1.7s
const SPAWN_INTERVAL_MIN = 750;        // Spawning rate limit cap
const COLLISION_INSET_X = 6;        // Horizontal bounding-box buffer
const COLLISION_INSET_Y = 10;       // Vertical bounding-box buffer

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

        this.stopEngine(); // Safety clearance

        try {
            // Engine Synthesizer: deep double-oscillator hum
            this.engineOsc = this.ctx.createOscillator();
            this.engineOsc.type = 'sawtooth';
            this.engineOsc.frequency.setValueAtTime(42, this.ctx.currentTime); // Deep hum

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(130, this.ctx.currentTime); // Deep muffler

            this.engineGain = this.ctx.createGain();
            this.engineGain.gain.setValueAtTime(0.09, this.ctx.currentTime); // Low baseline volume

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
        
        // Pitch ramps up and filter frequency widens as cars drive faster
        const targetPitch = 42 + (speedRatio * 58); // 42Hz -> 100Hz
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
            osc.frequency.setValueAtTime(170, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(340, this.ctx.currentTime + 0.15);

            gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.18);
        } catch (e) {}
    }

    playBounceSound() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        try {
            // Bumper deflection bounce sound: rubbery spring sweep
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(140, this.ctx.currentTime);
            // Drop rapidly then sweep upwards
            osc.frequency.linearRampToValueAtTime(70, this.ctx.currentTime + 0.04);
            osc.frequency.exponentialRampToValueAtTime(250, this.ctx.currentTime + 0.16);

            gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
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
            osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
            osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.08); // A5

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
            // Exploding white noise blast
            const bufferSize = this.ctx.sampleRate * 1.5;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noiseNode = this.ctx.createBufferSource();
            noiseNode.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(240, this.ctx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 1.2);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.4);

            noiseNode.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            noiseNode.start();
            noiseNode.stop(this.ctx.currentTime + 1.5);
            
            // Sub bass impact drop
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

// --- EXHAUST FLAME & FRICTION SPARK PARTICLE CLASS ---
class Particle {
    constructor(x, y, scale = 1, type = 'flame', colorHex = null) {
        this.x = x;
        this.y = y;
        this.type = type; // 'flame' | 'spark' | 'smoke'
        
        if (type === 'flame') {
            this.vx = (Math.random() - 0.5) * 1.5;
            this.vy = Math.random() * 3 + 2.5; 
            this.maxLife = Math.random() * 15 + 15;
            this.size = (Math.random() * 4 + 4) * scale;
            
            if (colorHex) {
                // Parse colorHex to RGB object
                this.color = this.hexToRgb(colorHex);
            } else {
                const rand = Math.random();
                if (rand < 0.2) this.color = { r: 0, g: 255, b: 240 }; // Cyan core
                else if (rand < 0.6) this.color = { r: 255, g: 234, b: 0 }; // Yellow
                else this.color = { r: 255, g: 0, b: 127 }; // Pink
            }
        } else if (type === 'spark') {
            // Collision sparks shoot outwards in all directions
            this.vx = (Math.random() - 0.5) * 8;
            this.vy = (Math.random() - 0.5) * 8;
            this.maxLife = Math.random() * 20 + 15;
            this.size = Math.random() * 3 + 2;
            this.color = Math.random() < 0.5 ? { r: 255, g: 234, b: 0 } : { r: 255, g: 90, b: 0 }; // Yellow/Orange
        } else {
            // Grey crash smoke
            this.vx = (Math.random() - 0.5) * 2;
            this.vy = -Math.random() * 2 - 1;
            this.maxLife = Math.random() * 30 + 20;
            this.size = Math.random() * 6 + 6;
            this.color = { r: 100, g: 100, b: 105 };
        }
        
        this.life = this.maxLife;
    }

    hexToRgb(hex) {
        // Simple hex converter
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        
        // Decay speed slightly for sparks
        if (this.type === 'spark') {
            this.vx *= 0.95;
            this.vy *= 0.95;
        }
        
        this.life--;
    }

    draw(ctx) {
        const ratio = this.life / this.maxLife;
        ctx.save();
        
        if (this.type === 'flame' || this.type === 'spark') {
            ctx.globalCompositeOperation = 'lighter'; // Glow additive mix
            ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${ratio})`;
        } else {
            ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${ratio * 0.4})`;
        }
        
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
        
        // High-DPI support
        this.dpr = window.devicePixelRatio || 1;
        this.baseWidth = 480;
        this.baseHeight = 720;
        this.setupCanvasDimensions();

        // Game state
        this.state = 'START'; // 'START' | 'PLAYING' | 'GAMEOVER'
        this.gameMode = '1P'; // '1P' | '2P'
        this.score = 0;
        
        // Dynamic Lane Count setup (overwritten in startGame)
        this.laneCount = 3;
        this.laneWidth = this.baseWidth / this.laneCount;
        this.laneCenters = [];

        // Dual Player object mappings
        this.players = [];

        // Ambient road offsets
        this.roadOffset = 0;
        this.speed = BASE_ROAD_SPEED;
        this.spawnInterval = SPAWN_INTERVAL_INITIAL;
        this.level = 1;
        this.lastDifficultyIncrease = 0;

        // Traffic entities
        this.enemies = [];
        this.particles = [];
        this.lastSpawnTime = 0;

        // Bounding keyboard state
        this.keys = {};

        // Camera screenshake
        this.shakeTimer = 0;
        this.shakeAmount = 0;

        this.bindEvents();
        this.loadHighScores();
        requestAnimationFrame((t) => this.loop(t));
    }

    setupCanvasDimensions() {
        this.canvas.width = this.baseWidth * this.dpr;
        this.canvas.height = this.baseHeight * this.dpr;
        this.ctx.scale(this.dpr, this.dpr);
    }

    loadHighScores() {
        this.highScoreSingle = parseInt(localStorage.getItem('turbo_lane_highscore')) || 0;
        this.highScoreCoop = parseInt(localStorage.getItem('turbo_lane_coop_highscore')) || 0;
        this.updateHighScoreHUD();
    }

    bindEvents() {
        // Keyboard steer triggers (snappy target lane switching)
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = true;
            
            if (this.state !== 'PLAYING') return;

            // --- PLAYER 1 CONTROLS: A / D ---
            if (this.players[0] && this.players[0].active) {
                if (key === 'a') {
                    this.steerPlayer(0, -1);
                } else if (key === 'd') {
                    this.steerPlayer(0, 1);
                }
            }

            // --- PLAYER 2 CONTROLS: ArrowLeft / ArrowRight ---
            if (this.players[1] && this.players[1].active) {
                if (e.key === 'ArrowLeft') {
                    this.steerPlayer(1, -1);
                } else if (e.key === 'ArrowRight') {
                    this.steerPlayer(1, 1);
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = false;
        });

        // Mode selectors
        document.getElementById('start1Player').addEventListener('click', () => {
            sounds.resume();
            this.startGame('1P');
        });

        document.getElementById('start2Player').addEventListener('click', () => {
            sounds.resume();
            this.startGame('2P');
        });

        document.getElementById('restartButton').addEventListener('click', () => {
            sounds.resume();
            this.startGame(this.gameMode);
        });

        document.getElementById('soundToggle').addEventListener('click', () => {
            sounds.toggle();
        });

        // Touch Input Steering for Mobile
        const handleTouchSteer = (direction) => {
            if (this.state !== 'PLAYING') return;
            if (this.gameMode === '1P') {
                this.steerPlayer(0, direction);
            } else {
                // In 2P Mobile, tapping left cycles P1, tapping right cycles P2
                if (direction === -1 && this.players[0] && this.players[0].active) {
                    // Cycle P1 lane left-to-right wrapping
                    const nextP1 = (this.players[0].lane + 1) % this.laneCount;
                    this.players[0].prevLane = this.players[0].lane;
                    this.players[0].lane = nextP1;
                    sounds.playSteerSound();
                } else if (direction === 1 && this.players[1] && this.players[1].active) {
                    // Cycle P2 lane right-to-left wrapping
                    const nextP2 = (this.players[1].lane - 1 + this.laneCount) % this.laneCount;
                    this.players[1].prevLane = this.players[1].lane;
                    this.players[1].lane = nextP2;
                    sounds.playSteerSound();
                }
            }
        };

        document.getElementById('tapLeft').addEventListener('pointerdown', (e) => {
            e.preventDefault();
            handleTouchSteer(-1);
        });

        document.getElementById('tapRight').addEventListener('pointerdown', (e) => {
            e.preventDefault();
            handleTouchSteer(1);
        });

        window.addEventListener('resize', () => {
            this.setupCanvasDimensions();
        });
    }

    steerPlayer(playerIndex, direction) {
        const player = this.players[playerIndex];
        if (!player || !player.active) return;

        let nextLane = player.lane + direction;
        if (nextLane >= 0 && nextLane < this.laneCount) {
            player.prevLane = player.lane; // Remember lane to bounce back if conflict occurs
            player.lane = nextLane;
            sounds.playSteerSound();
        }
    }

    startGame(mode) {
        this.state = 'PLAYING';
        this.gameMode = mode;
        this.score = 0;
        this.speed = BASE_ROAD_SPEED;
        this.spawnInterval = SPAWN_INTERVAL_INITIAL;
        this.level = 1;
        this.lastDifficultyIncrease = performance.now();
        this.enemies = [];
        this.particles = [];
        this.lastSpawnTime = performance.now();
        
        // 1P vs 2P Configurations
        if (mode === '1P') {
            this.laneCount = 3;
            this.laneWidth = this.baseWidth / this.laneCount;
            this.laneCenters = [this.laneWidth * 0.5, this.laneWidth * 1.5, this.laneWidth * 2.5];

            this.players = [{
                id: 1,
                lane: 1, // Start middle
                prevLane: 1,
                x: this.laneCenters[1],
                y: this.baseHeight - 140,
                width: 58,
                height: 104,
                steerSpeed: 0.22,
                color: '#00ff87', // Neon green
                active: true,
                designId: 0
            }];

            // Flip HUD label indicators
            document.getElementById('p1HudLabel').innerText = 'SCORE';
            document.getElementById('p2HudLabel').innerText = 'BEST';
            document.getElementById('hudP1Score').className = 'hud-value font-arcade text-cyan'; // Cyan single score
            
            // Set initial scores
            document.getElementById('hudP1Score').innerText = '00000';
            this.updateHighScoreHUD();

        } else { // 2 Player co-op
            this.laneCount = 4;
            this.laneWidth = this.baseWidth / this.laneCount;
            this.laneCenters = [
                this.laneWidth * 0.5,
                this.laneWidth * 1.5,
                this.laneWidth * 2.5,
                this.laneWidth * 3.5
            ];

            this.players = [
                {
                    id: 1,
                    lane: 1, // Starts Left-Center
                    prevLane: 1,
                    x: this.laneCenters[1],
                    y: this.baseHeight - 140,
                    width: 58,
                    height: 104,
                    steerSpeed: 0.22,
                    color: '#00ff87', // Lime green
                    active: true,
                    designId: 0
                },
                {
                    id: 2,
                    lane: 2, // Starts Right-Center
                    prevLane: 2,
                    x: this.laneCenters[2],
                    y: this.baseHeight - 140,
                    width: 58,
                    height: 104,
                    steerSpeed: 0.22,
                    color: '#00f0ff', // Cyber cyan
                    active: true,
                    designId: 1
                }
            ];

            // Setup multiplayer HUD
            document.getElementById('p1HudLabel').innerText = 'P1 SCORE';
            document.getElementById('p2HudLabel').innerText = 'P2 SCORE';
            document.getElementById('hudP1Score').className = 'hud-value font-arcade text-green';
            document.getElementById('hudP2Score').className = 'hud-value font-arcade text-cyan';
            
            document.getElementById('hudP1Score').innerText = '00000';
            document.getElementById('hudP2Score').innerText = '00000';
        }

        // Hide overlay templates
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('gameOverScreen').classList.add('hidden');
        document.getElementById('gameHud').classList.remove('hidden');

        this.updateSpeedHUD();
        sounds.startEngine();
    }

    gameOver() {
        this.state = 'GAMEOVER';
        sounds.stopEngine();
        
        // Massive screenshake impact
        this.shakeTimer = 35;
        this.shakeAmount = 18;

        const highscoreBanner = document.getElementById('newHighScoreRow');
        highscoreBanner.classList.add('hidden'); // Default hide

        if (this.gameMode === '1P') {
            // Single Player Scores
            document.getElementById('singlePlayerResults').classList.remove('hidden');
            document.getElementById('multiPlayerResults').classList.add('hidden');

            document.getElementById('finalScore').innerText = this.score;
            document.getElementById('bestScore').innerText = this.highScoreSingle;

            if (this.score > this.highScoreSingle) {
                this.highScoreSingle = this.score;
                localStorage.setItem('turbo_lane_highscore', this.highScoreSingle);
                document.getElementById('bestScore').innerText = this.highScoreSingle;
                highscoreBanner.classList.remove('hidden');
            }
        } else {
            // Multiplayer Co-op Results
            document.getElementById('singlePlayerResults').classList.add('hidden');
            document.getElementById('multiPlayerResults').classList.remove('hidden');

            const p1 = this.players[0];
            const p2 = this.players[1];

            // Render scores
            document.getElementById('p1FinalScore').innerText = p1.score;
            document.getElementById('p2FinalScore').innerText = p2.score;
            document.getElementById('coopBestScore').innerText = this.highScoreCoop;

            // Crown a match winner based on who gathered more points
            const banner = document.getElementById('winnerBanner');
            if (p1.score > p2.score) {
                banner.innerText = '🏆 PLAYER 1 WINS!';
                banner.className = 'winner-banner text-green-label';
            } else if (p2.score > p1.score) {
                banner.innerText = '🏆 PLAYER 2 WINS!';
                banner.className = 'winner-banner text-cyan-label';
            } else {
                banner.innerText = '🤝 CO-OP DRAW!';
                banner.className = 'winner-banner';
            }

            // Co-op highscore logs are stored as combined score sums
            const combinedScore = p1.score + p2.score;
            if (combinedScore > this.highScoreCoop) {
                this.highScoreCoop = combinedScore;
                localStorage.setItem('turbo_lane_coop_highscore', this.highScoreCoop);
                document.getElementById('coopBestScore').innerText = this.highScoreCoop;
                highscoreBanner.classList.remove('hidden');
            }
        }

        document.getElementById('gameOverScreen').classList.remove('hidden');
        document.getElementById('gameHud').classList.add('hidden');
    }

    updateSpeedHUD() {
        const speedVal = Math.round(this.speed * 10);
        document.getElementById('hudSpeed').innerHTML = `${speedVal}<span class="unit">KM/H</span>`;
    }

    updateHighScoreHUD() {
        if (this.gameMode === '1P') {
            const padScore = String(this.highScoreSingle).padStart(5, '0');
            document.getElementById('hudP2Score').innerText = padScore;
        }
    }

    // --- MAIN LOOP ---
    loop(timestamp) {
        const dt = timestamp - this.lastFrameTime;
        this.lastFrameTime = timestamp;

        this.update(dt, timestamp);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    // --- PHYSICS & SCENARIO LOGIC ---
    update(dt, timestamp) {
        // Handle screenshake decay
        if (this.shakeTimer > 0) {
            this.shakeTimer--;
            this.shakeAmount *= 0.92;
        }

        if (this.state !== 'PLAYING') {
            // Background road grid slow scrolling
            this.roadOffset = (this.roadOffset + 2) % 80;
            this.particles.forEach(p => p.update());
            this.particles = this.particles.filter(p => p.life > 0);
            return;
        }

        // 1. Difficulty Scaling Curves (every 5 seconds)
        if (timestamp - this.lastDifficultyIncrease > ACCELERATION_INTERVAL) {
            this.level++;
            this.speed = Math.min(MAX_ROAD_SPEED, BASE_ROAD_SPEED + (this.level - 1) * ACCELERATION_RATE * BASE_ROAD_SPEED);
            this.spawnInterval = Math.max(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_INITIAL - (this.level - 1) * 80);
            
            this.lastDifficultyIncrease = timestamp;
            this.updateSpeedHUD();
        }

        // Modulate engine pitch
        const speedRatio = (this.speed - BASE_ROAD_SPEED) / (MAX_ROAD_SPEED - BASE_ROAD_SPEED);
        sounds.updateEnginePitch(speedRatio);

        // 2. Road scrolling velocity
        this.roadOffset = (this.roadOffset + this.speed) % 80;

        // 3. Player Steering Physics and Bumper conflicts
        if (this.gameMode === '2P' && this.players[0].active && this.players[1].active) {
            // Conflict check: attempting to occupy the exact same lane
            if (this.players[0].lane === this.players[1].lane) {
                // Deflect players back to their respective previous lanes
                const p1Prev = this.players[0].prevLane;
                const p2Prev = this.players[1].prevLane;

                this.players[0].lane = p1Prev;
                this.players[1].lane = p2Prev;

                sounds.playBounceSound();

                // Spark shockwave particles at the boundary between cars
                const collisionMidPointX = (this.players[0].x + this.players[1].x) / 2;
                const collisionMidPointY = (this.players[0].y + this.players[1].y) / 2;

                for (let s = 0; s < 12; s++) {
                    this.particles.push(new Particle(collisionMidPointX, collisionMidPointY, 1, 'spark'));
                }
            }
        }

        // Steer interpolation mapping
        this.players.forEach(player => {
            const targetX = this.laneCenters[player.lane];
            player.x += (targetX - player.x) * player.steerSpeed;
            
            // Smoke puff particles emitting from crashed players in multiplayer co-op
            if (!player.active) {
                if (Math.random() < 0.18) {
                    this.particles.push(new Particle(player.x, player.y - 10, 1.2, 'smoke'));
                }
                return;
            }

            // Normal exhaust flame bursts for active vehicles
            if (Math.random() < 0.8) {
                const leftExhaustX = player.x - 18;
                const rightExhaustX = player.x + 18;
                const exhaustY = player.y + player.height / 2;
                
                const intensity = 0.8 + speedRatio * 0.4;
                this.particles.push(new Particle(leftExhaustX, exhaustY, intensity, 'flame', player.color));
                this.particles.push(new Particle(rightExhaustX, exhaustY, intensity, 'flame', player.color));
            }
        });

        // Update particle stacks
        this.particles.forEach(p => p.update());
        this.particles = this.particles.filter(p => p.life > 0);

        // 4. Traffic spawner
        if (timestamp - this.lastSpawnTime > this.spawnInterval) {
            this.spawnTraffic();
            this.lastSpawnTime = timestamp;
        }

        // 5. Update traffic and pass-scores
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            
            // Move traffic down the road relative to speed
            enemy.y += (this.speed - enemy.speed);

            // Traffic Passed Score Checks
            if (!enemy.passed) {
                // If enemy passes beyond the player's bumper, award active player points
                let awardedPoints = false;
                this.players.forEach(p => {
                    if (p.active && enemy.y > (p.y + p.height / 2)) {
                        p.score += 10;
                        awardedPoints = true;
                    }
                });

                if (awardedPoints) {
                    enemy.passed = true;
                    sounds.playPassSound();

                    // Instantly refresh HUD score panels
                    if (this.gameMode === '1P') {
                        this.score = this.players[0].score;
                        const scoreStr = String(this.score).padStart(5, '0');
                        document.getElementById('hudP1Score').innerText = scoreStr;
                    } else {
                        const p1ScoreStr = String(this.players[0].score).padStart(5, '0');
                        const p2ScoreStr = String(this.players[1].score).padStart(5, '0');
                        document.getElementById('hudP1Score').innerText = p1ScoreStr;
                        document.getElementById('hudP2Score').innerText = p2ScoreStr;
                    }
                }
            }

            // Remove out-of-screen traffic
            if (enemy.y > this.baseHeight + 100) {
                this.enemies.splice(i, 1);
                continue;
            }

            // Collision check against active players
            this.players.forEach(player => {
                if (!player.active) return;
                
                if (this.checkCollision(player, enemy)) {
                    // Deactivate player
                    player.active = false;
                    sounds.playCrashSound();
                    
                    // Small screen-shake shudder
                    this.shakeTimer = 20;
                    this.shakeAmount = 10;

                    // Blow spark particles on collision
                    for (let s = 0; s < 25; s++) {
                        this.particles.push(new Particle(player.x, player.y, 1.2, 'spark'));
                    }

                    // Check survival status
                    const aliveCount = this.players.filter(p => p.active).length;
                    if (aliveCount === 0) {
                        this.gameOver();
                    }
                }
            });
        }
    }

    spawnTraffic() {
        // Staggered Spawner: Guarantees that at least 1 lane is safe
        const availableLanes = [];
        for (let i = 0; i < this.laneCount; i++) {
            availableLanes.push(i);
        }

        // Double spawns appear in higher levels
        const maxSpawns = (this.gameMode === '2P') ? this.laneCount - 2 : this.laneCount - 1; // Always leave a reaction lane
        const numSpawns = (Math.random() < 0.25 + (this.level * 0.05)) ? 2 : 1;
        const actualSpawns = Math.min(numSpawns, maxSpawns);

        // Shuffle lane options
        for (let i = availableLanes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableLanes[i], availableLanes[j]] = [availableLanes[j], availableLanes[i]];
        }

        for (let k = 0; k < actualSpawns; k++) {
            const spawnLane = availableLanes[k];
            const laneX = this.laneCenters[spawnLane];
            
            const enemyColors = ['#ff007f', '#00f0ff', '#ffea00', '#a020f0', '#ff6200'];
            const color = enemyColors[Math.floor(Math.random() * enemyColors.length)];
            const yOffset = -100 - (k * 140); // Stagger offset slightly
            const enemySpeed = ENEMY_BASE_SPEED + (Math.random() - 0.5) * 1.5;

            this.enemies.push({
                x: laneX,
                y: yOffset,
                width: 58,
                height: 104,
                color: color,
                speed: enemySpeed,
                passed: false,
                designId: Math.floor(Math.random() * 2)
            });
        }
    }

    checkCollision(rect1, rect2) {
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
        // Camera screenshakes
        if (this.shakeTimer > 0) {
            const dx = (Math.random() - 0.5) * this.shakeAmount;
            const dy = (Math.random() - 0.5) * this.shakeAmount;
            this.ctx.translate(dx, dy);
        }

        // 1. Grid backdrop
        this.drawBackground();
        
        // 2. Scrolling road
        this.drawRoad();
        
        // 3. Flame particles below cars
        this.particles.forEach(p => p.draw(this.ctx));

        // 4. Draw Players (draw gray if eliminated)
        this.players.forEach(player => {
            this.drawPlayerCar(player);
        });

        // 5. Draw oncoming traffic obstacles
        this.enemies.forEach(enemy => this.drawEnemyCar(enemy));

        this.ctx.restore();
    }

    drawBackground() {
        this.ctx.fillStyle = '#0a0515';
        this.ctx.fillRect(0, 0, this.baseWidth, this.baseHeight);

        // Perspective side glowing grid strips
        this.ctx.strokeStyle = 'rgba(255, 0, 127, 0.04)';
        this.ctx.lineWidth = 1;
        const gridSpacing = 40;
        
        for (let x = -80; x < this.baseWidth + 80; x += gridSpacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x * 1.2 - 40, this.baseHeight);
            this.ctx.stroke();
        }
    }

    drawRoad() {
        this.ctx.fillStyle = '#0f0a1c';
        this.ctx.fillRect(0, 0, this.baseWidth, this.baseHeight);

        // Highway shoulders glowing border (Hot Pink)
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = 'rgba(255, 0, 127, 0.5)';
        this.ctx.strokeStyle = '#ff007f';
        this.ctx.lineWidth = 4;
        
        this.ctx.beginPath();
        this.ctx.moveTo(15, 0);
        this.ctx.lineTo(15, this.baseHeight);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(this.baseWidth - 15, 0);
        this.ctx.lineTo(this.baseWidth - 15, this.baseHeight);
        this.ctx.stroke();

        this.ctx.shadowBlur = 0; // Clear blur

        // Draw scrolling lanes dashed yellow lines
        this.ctx.strokeStyle = 'rgba(255, 234, 0, 0.55)';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([40, 40]);

        this.ctx.save();
        this.ctx.lineDashOffset = -this.roadOffset;

        // Draw dashed separator strips dynamically
        for (let i = 1; i < this.laneCount; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.laneWidth * i, -80);
            this.ctx.lineTo(this.laneWidth * i, this.baseHeight + 80);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    drawPlayerCar(car) {
        this.ctx.save();
        this.ctx.translate(car.x, car.y);

        // Dynamically tilt chassis based on distance to lane targets
        const targetX = this.laneCenters[car.lane];
        const steerDiff = targetX - car.x;
        const tiltAngle = steerDiff * 0.00065;
        this.ctx.rotate(tiltAngle);

        // Shadow Glow (Lime Green or Cyber Cyan underglow depending on active status)
        if (car.active) {
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = car.color;
        }

        // Paint color (eliminated players render in metallic dark gray)
        const primaryColor = car.active ? car.color : '#403d4a';
        const shadowDetailColor = car.active ? (car.designId === 0 ? '#00ad5a' : '#009cc2') : '#282630';

        // 1. Chassis Path
        this.ctx.fillStyle = primaryColor;
        this.ctx.beginPath();
        
        if (car.designId === 0) {
            // sports car nose & styling
            this.ctx.moveTo(-22, -48);
            this.ctx.bezierCurveTo(-22, -54, 22, -54, 22, -48);
            this.ctx.quadraticCurveTo(24, 0, 26, 42);
            this.ctx.bezierCurveTo(20, 52, -20, 52, -26, 42);
            this.ctx.quadraticCurveTo(-24, 0, -22, -48);
        } else {
            // hyper sports car square hood outlines
            this.ctx.moveTo(-24, -46);
            this.ctx.quadraticCurveTo(0, -56, 24, -46);
            this.ctx.lineTo(26, 10);
            this.ctx.lineTo(24, 44);
            this.ctx.quadraticCurveTo(0, 50, -24, 44);
            this.ctx.lineTo(-26, 10);
        }
        
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.shadowBlur = 0; // Turn off glow for body components

        // 2. Matte carbon fixtures
        this.ctx.fillStyle = '#1a1626';
        
        // Side mirrors
        this.ctx.fillRect(-27, -24, 5, 8);
        this.ctx.fillRect(22, -24, 5, 8);
        
        // Spoiler configurations
        if (car.designId === 0) {
            this.ctx.fillRect(-28, 38, 8, 8);
            this.ctx.fillRect(20, 38, 8, 8);
            this.ctx.fillRect(-28, 44, 56, 4);
        } else {
            // Double aggressive rear wings
            this.ctx.fillRect(-29, 36, 10, 8);
            this.ctx.fillRect(19, 36, 10, 8);
            this.ctx.fillRect(-29, 42, 58, 5);
        }

        // 3. Black Rubber Wheels
        this.ctx.fillStyle = '#110e19';
        this.ctx.fillRect(-25, -38, 6, 16); // Front Left
        this.ctx.fillRect(19, -38, 6, 16);  // Front Right
        this.ctx.fillRect(-28, 18, 6, 20);  // Back Left
        this.ctx.fillRect(22, 18, 6, 20);   // Back Right

        // Alloys
        this.ctx.fillStyle = '#8d83a3';
        this.ctx.fillRect(-24, -32, 2, 4);
        this.ctx.fillRect(22, -32, 2, 4);
        this.ctx.fillRect(-27, 26, 2, 4);
        this.ctx.fillRect(25, 26, 2, 4);

        // 4. Windows windshield (Tinted Glass)
        this.ctx.fillStyle = car.active ? '#1c1f30' : '#141417';
        this.ctx.beginPath();
        this.ctx.moveTo(-15, -26);
        this.ctx.lineTo(15, -26);
        this.ctx.quadraticCurveTo(18, 16, 16, 24);
        this.ctx.lineTo(-16, 24);
        this.ctx.quadraticCurveTo(-18, 16, -15, -26);
        this.ctx.closePath();
        this.ctx.fill();

        // Gloss glare details (only if active)
        if (car.active) {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
            this.ctx.lineWidth = 2.5;
            this.ctx.beginPath();
            this.ctx.moveTo(-10, -22);
            this.ctx.lineTo(4, 20);
            this.ctx.moveTo(-6, -22);
            this.ctx.lineTo(-1, 10);
            this.ctx.stroke();
        }

        // 5. Matte contour details
        this.ctx.strokeStyle = shadowDetailColor;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(-14, -34);
        this.ctx.quadraticCurveTo(0, -42, 14, -34);
        this.ctx.stroke();

        // 6. Glowing Headlights Beams (Layered alpha triangle, disabled if crashed)
        if (car.active) {
            const lightGrad = this.ctx.createLinearGradient(0, -52, 0, -220);
            lightGrad.addColorStop(0, 'rgba(255, 255, 230, 0.4)');
            lightGrad.addColorStop(1, 'rgba(255, 255, 230, 0)');
            
            this.ctx.fillStyle = lightGrad;
            
            // Left headlight beam
            this.ctx.beginPath();
            this.ctx.moveTo(-16, -52);
            this.ctx.lineTo(-45, -220);
            this.ctx.lineTo(10, -220);
            this.ctx.closePath();
            this.ctx.fill();

            // Right headlight beam
            this.ctx.beginPath();
            this.ctx.moveTo(16, -52);
            this.ctx.lineTo(-10, -220);
            this.ctx.lineTo(45, -220);
            this.ctx.closePath();
            this.ctx.fill();

            // Headlamp bulbs
            this.ctx.fillStyle = '#ffea00';
            this.ctx.fillRect(-18, -52, 5, 2);
            this.ctx.fillRect(13, -52, 5, 2);

            // Red taillights
            this.ctx.fillStyle = '#ff003c';
            this.ctx.fillRect(-18, 48, 6, 2);
            this.ctx.fillRect(12, 48, 6, 2);
        } else {
            // Dark gray soot markings on crashed vehicles
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.beginPath();
            this.ctx.arc(0, -10, 18, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    drawEnemyCar(enemy) {
        this.ctx.save();
        this.ctx.translate(enemy.x, enemy.y);
        
        // Underglow matching body paint color
        this.ctx.shadowBlur = 12;
        this.ctx.shadowColor = enemy.color;

        // 1. Chassis
        this.ctx.fillStyle = enemy.color;
        
        if (enemy.designId === 0) {
            // sports profile
            this.ctx.beginPath();
            this.ctx.moveTo(-20, -48);
            this.ctx.bezierCurveTo(-20, -52, 20, -52, 20, -48);
            this.ctx.quadraticCurveTo(22, 0, 24, 42);
            this.ctx.bezierCurveTo(18, 50, -18, 50, -24, 42);
            this.ctx.quadraticCurveTo(-22, 0, -20, -48);
            this.ctx.closePath();
            this.ctx.fill();
        } else {
            // Muscle wide profiles
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
        
        this.ctx.shadowBlur = 0; // Disable shadow

        // 2. Spoiler fixture
        this.ctx.fillStyle = '#1c152b';
        this.ctx.fillRect(-25, 34, 50, 4);

        // 3. Black Rubber Wheels
        this.ctx.fillStyle = '#0f0d14';
        this.ctx.fillRect(-24, -36, 5, 14); // Front Left
        this.ctx.fillRect(19, -36, 5, 14);  // Front Right
        this.ctx.fillRect(-26, 16, 5, 18);  // Back Left
        this.ctx.fillRect(21, 16, 5, 18);   // Back Right

        // 4. Glass cabin
        this.ctx.fillStyle = '#1b1b22';
        this.ctx.beginPath();
        this.ctx.moveTo(-14, -22);
        this.ctx.lineTo(14, -22);
        this.ctx.quadraticCurveTo(16, 12, 14, 20);
        this.ctx.lineTo(-14, 20);
        this.ctx.quadraticCurveTo(-16, 12, -14, -22);
        this.ctx.closePath();
        this.ctx.fill();

        // Reflections
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(-8, -18);
        this.ctx.lineTo(4, 15);
        this.ctx.stroke();

        // 5. Bulbs & Tail lights
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(-17, -50, 4, 2);
        this.ctx.fillRect(13, -50, 4, 2);

        this.ctx.fillStyle = '#ff003c';
        this.ctx.fillRect(-16, 40, 5, 2);
        this.ctx.fillRect(11, 40, 5, 2);

        this.ctx.restore();
    }
}

// --- INITIALIZE GAME INSTANCE ON DOM LOAD ---
let game = null;
window.addEventListener('load', () => {
    game = new TurboLaneGame();
});
