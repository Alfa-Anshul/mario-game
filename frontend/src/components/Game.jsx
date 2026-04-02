import React, { useEffect, useRef, useState, useCallback } from 'react'

const TILE = 32
const GRAVITY = 0.5
const JUMP_FORCE = -13
const PLAYER_SPEED = 4
const CANVAS_W = 800
const CANVAS_H = 480

// Level definitions: 0=empty, 1=ground, 2=brick, 3=coin, 4=pipe, 5=qmark, 6=enemy, 7=solid
const LEVELS = [
  // Level 1: Classic World 1-1 style
  {
    bg: ['#5c94fc','#5c94fc'],
    groundColor: '#8b4513',
    grassColor: '#228b22',
    music: 'fast',
    timeLimit: 200,
    map: [
      "                                                                          ",
      "                                                                          ",
      "                                                                          ",
      "              QQ                 Q                                        ",
      "                                                                          ",
      "         BB B                   BBB          BB B                         ",
      "                    4                                  4                  ",
      "GGGGGGGGGGGGGG  GGGGGGGGG  GGGGGGGGGGGGG  GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
      "WWWWWWWWWWWWWW  WWWWWWWWW  WWWWWWWWWWWWW  WWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
    ],
    coins: [[13,3],[14,3],[32,3]],
    enemies: [[20,6],[35,6],[50,6],[65,6]],
    flag: 68
  },
  // Level 2: Underground
  {
    bg: ['#1a0a00','#0d0600'],
    groundColor: '#555',
    grassColor: '#888',
    music: 'underground',
    timeLimit: 180,
    map: [
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "W                                                                        W",
      "W  BBQ BB     QBB                    BQQB                               W",
      "W                                                                        W",
      "W     444              444                     444                       W",
      "W                                                                        W",
      "W GGGGGGG     GGGGG        GGGGGG        GGGGGGGGGG   GGGGGGGGGGGGGGG   W",
      "W WWWWWWW     WWWWW        WWWWWW        WWWWWWWWWW   WWWWWWWWWWWWWWW   W",
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
    ],
    coins: [[5,2],[6,2],[16,2],[17,2],[30,2],[31,2],[32,2],[33,2]],
    enemies: [[15,5],[30,5],[45,5],[55,5],[60,5]],
    flag: 65
  },
  // Level 3: Sky / Castle
  {
    bg: ['#ff6b35','#ffcc02'],
    groundColor: '#333',
    grassColor: '#555',
    music: 'castle',
    timeLimit: 150,
    map: [
      "                                                                          ",
      "                                                                          ",
      "  GGG          GGG                GGG          GGG            GGG         ",
      "                                                                          ",
      "        GGG                 GGG          GGG         GGG                 ",
      "                                                                          ",
      "GGGG         GGGG                  GGGGG        GGGG          GGGGGGGGGGG",
      "WWWW         WWWW                  WWWWW        WWWW          WWWWWWWWWWW",
      "                                                                          ",
    ],
    coins: [[3,2],[4,2],[5,2],[14,2],[15,2],[16,2]],
    enemies: [[10,5],[22,5],[38,5],[52,5]],
    flag: 70
  }
]

const parseMap = (levelData) => {
  const blocks = []
  const groundTiles = []
  levelData.map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === 'G') groundTiles.push({ x, y, type: 'grass' })
      else if (ch === 'W') groundTiles.push({ x, y, type: 'solid' })
      else if (ch === 'B') blocks.push({ x, y, type: 'brick' })
      else if (ch === 'Q') blocks.push({ x, y, type: 'qmark', hit: false })
      else if (ch === '4') blocks.push({ x, y, type: 'pipe' })
    }
  })
  return { blocks, groundTiles }
}

export default function Game({ user, level, onGameOver, onMenu }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const keysRef = useRef({})
  const animFrameRef = useRef(null)
  const [overlay, setOverlay] = useState(null) // null | 'dead' | 'win' | 'timeover'
  const [hud, setHud] = useState({ score: 0, coins: 0, lives: 3, time: 200, level })

  const levelData = LEVELS[Math.min(level - 1, LEVELS.length - 1)]
  const { blocks: initBlocks, groundTiles } = parseMap(levelData)

  const initState = useCallback(() => {
    const coins = levelData.coins.map((c, i) => ({ id: i, x: c[0], y: c[1], collected: false }))
    const enemies = levelData.enemies.map((e, i) => ({
      id: i, x: e[0] * TILE, y: 0, vx: -1.5, vy: 0, alive: true, dir: -1, onGround: false
    }))
    return {
      player: { x: 80, y: 200, vx: 0, vy: 0, onGround: false, facing: 1, big: false, dead: false, invincible: 0, runFrame: 0, frameTimer: 0 },
      camera: { x: 0 },
      blocks: initBlocks.map(b => ({ ...b })),
      coins,
      enemies,
      particles: [],
      score: 0,
      coinCount: 0,
      lives: 3,
      time: levelData.timeLimit,
      timeTimer: 0,
      won: false,
      flagAnim: 0
    }
  }, [level])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    stateRef.current = initState()
    let lastTime = performance.now()
    let timeAccum = 0

    const keydown = (e) => {
      keysRef.current[e.code] = true
      e.preventDefault()
    }
    const keyup = (e) => { keysRef.current[e.code] = false }
    window.addEventListener('keydown', keydown)
    window.addEventListener('keyup', keyup)

    const collidesWithSolid = (px, py, pw, ph, state) => {
      const tiles = [...groundTiles, ...state.blocks.filter(b => b.type !== 'coin')]
      for (const t of tiles) {
        const tx = t.x * TILE, ty = t.y * TILE
        if (px < tx + TILE && px + pw > tx && py < ty + TILE && py + ph > ty) return t
      }
      return null
    }

    const spawnParticles = (x, y, color, count = 5) => {
      for (let i = 0; i < count; i++) {
        stateRef.current.particles.push({
          x, y, vx: (Math.random()-0.5)*6, vy: Math.random()*-8-2,
          life: 1, color, size: Math.random()*6+2
        })
      }
    }

    const update = (dt) => {
      const s = stateRef.current
      if (s.won || overlay) return
      const p = s.player
      const keys = keysRef.current

      // Timer
      timeAccum += dt
      if (timeAccum >= 1000) { s.time = Math.max(0, s.time - 1); timeAccum -= 1000 }
      if (s.time <= 0 && !p.dead) { p.dead = true; setOverlay('timeover') }

      if (p.dead) {
        p.vy += GRAVITY
        p.y += p.vy
        if (p.y > CANVAS_H + 100) {
          s.lives--
          if (s.lives <= 0) { setOverlay('dead'); return }
          Object.assign(s, initState())
          s.lives = stateRef.current.lives
        }
        return
      }
      if (p.invincible > 0) p.invincible -= dt

      // Input
      const left = keys['ArrowLeft'] || keys['KeyA']
      const right = keys['ArrowRight'] || keys['KeyD']
      const jump = keys['ArrowUp'] || keys['KeyW'] || keys['Space']

      if (left) { p.vx = -PLAYER_SPEED; p.facing = -1 }
      else if (right) { p.vx = PLAYER_SPEED; p.facing = 1 }
      else p.vx *= 0.75

      if (jump && p.onGround) { p.vy = JUMP_FORCE; p.onGround = false }

      // Animation
      if (Math.abs(p.vx) > 0.5) {
        p.frameTimer += dt
        if (p.frameTimer > 100) { p.runFrame = (p.runFrame + 1) % 3; p.frameTimer = 0 }
      } else p.runFrame = 0

      // Physics
      p.vy += GRAVITY
      p.y += p.vy
      p.onGround = false
      const PW = 28, PH = p.big ? 56 : 32

      // Vertical collision
      const vTile = collidesWithSolid(p.x + 2, p.y, PW, PH, s)
      if (vTile) {
        if (p.vy > 0) { p.y = vTile.y * TILE - PH; p.onGround = true }
        else {
          p.y = vTile.y * TILE + TILE
          // Hit block from below
          if (vTile.type === 'qmark' && !vTile.hit) {
            vTile.hit = true
            s.score += 100
            spawnParticles(vTile.x * TILE, vTile.y * TILE, '#f7d51d')
            s.coinCount++
          } else if (vTile.type === 'brick') {
            if (p.big) {
              s.blocks = s.blocks.filter(b => b !== vTile)
              spawnParticles(vTile.x * TILE, vTile.y * TILE, '#8b4513', 8)
              s.score += 50
            }
          }
        }
        p.vy = 0
      }

      p.x += p.vx
      const hTile = collidesWithSolid(p.x + 2, p.y, PW, PH, s)
      if (hTile) { p.x -= p.vx; p.vx = 0 }
      if (p.x < 0) p.x = 0

      // Fall death
      if (p.y > CANVAS_H + 100) { p.dead = true; s.lives-- }

      // Camera
      s.camera.x = Math.max(0, p.x - CANVAS_W / 3)

      // Coins
      s.coins.forEach(c => {
        if (c.collected) return
        const cx = c.x * TILE, cy = c.y * TILE
        if (p.x + PW > cx && p.x < cx + TILE && p.y + PH > cy && p.y < cy + TILE) {
          c.collected = true; s.score += 200; s.coinCount++
          spawnParticles(cx + TILE/2, cy, '#f7d51d', 4)
        }
      })

      // Enemies
      s.enemies.forEach(e => {
        if (!e.alive) return
        e.vy += GRAVITY
        e.x += e.vx
        e.y += e.vy
        e.onGround = false
        const ET = collidesWithSolid(e.x + 2, e.y, 28, 28, s)
        if (ET) {
          if (e.vy > 0) { e.y = ET.y * TILE - 28; e.onGround = true; e.vy = 0 }
          else { e.y = ET.y * TILE + TILE; e.vy = 0 }
        }
        const EH = collidesWithSolid(e.x + 2, e.y, 28, 28, s)
        if (EH && e.vy === 0) e.vx *= -1
        // Edge reverse
        if (!collidesWithSolid(e.x, e.y + 28, 4, 4, s) && e.onGround) e.vx *= -1
        if (e.x < 0) e.vx = Math.abs(e.vx)

        // Enemy-player collision
        if (p.invincible <= 0 && p.x + PW > e.x && p.x < e.x + 28 && p.y + PH > e.y && p.y < e.y + 28) {
          if (p.vy > 0 && p.y + PH < e.y + 20) {
            // Stomp
            e.alive = false; p.vy = -8; s.score += 300
            spawnParticles(e.x + 14, e.y, '#ff4500', 6)
          } else if (p.invincible <= 0) {
            if (p.big) { p.big = false; p.invincible = 2000 }
            else { p.dead = true; p.vy = -10 }
          }
        }
      })

      // Particles
      s.particles = s.particles.filter(pt => pt.life > 0)
      s.particles.forEach(pt => {
        pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.3; pt.life -= dt / 500
      })

      // Flag / Win
      const flagX = levelData.flag * TILE
      if (p.x + PW > flagX && !s.won) {
        s.won = true
        s.score += Math.max(0, s.time * 10)
        setOverlay('win')
      }

      setHud({ score: s.score, coins: s.coinCount, lives: s.lives, time: s.time, level })
    }

    const drawRounded = (ctx, x, y, w, h, r, color) => {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, r)
      ctx.fill()
    }

    const drawPlayer = (ctx, p, camX) => {
      const px = p.x - camX, py = p.y
      const PH = p.big ? 56 : 32
      ctx.save()
      ctx.translate(px + 16, py + PH/2)
      if (p.facing === -1) ctx.scale(-1, 1)
      if (p.invincible > 0 && Math.floor(p.invincible / 100) % 2 === 0) { ctx.restore(); return }

      // Body
      ctx.fillStyle = '#e52521'
      ctx.fillRect(-12, -PH/2, 24, p.big ? 28 : 20)
      // Pants
      ctx.fillStyle = '#0000ff'
      ctx.fillRect(-14, p.big ? -PH/2+28 : -PH/2+20, 28, p.big ? 28 : 16)
      // Hat
      ctx.fillStyle = '#e52521'
      ctx.fillRect(-12, -PH/2-10, 24, 10)
      ctx.fillRect(-16, -PH/2-4, 32, 4)
      // Face
      ctx.fillStyle = '#f5c5a3'
      ctx.fillRect(-8, -PH/2+2, 18, 12)
      // Eyes
      ctx.fillStyle = '#000'
      ctx.fillRect(2, -PH/2+4, 4, 4)
      // Mustache
      ctx.fillStyle = '#5c3317'
      ctx.fillRect(-6, -PH/2+10, 20, 3)
      // Shoes
      ctx.fillStyle = '#5c3317'
      ctx.fillRect(-14, PH/2-8, 14, 8)
      ctx.fillRect(0, PH/2-8, 14, 8)
      ctx.restore()
    }

    const drawEnemy = (ctx, e, camX) => {
      if (!e.alive) return
      const ex = e.x - camX
      // Goomba-style
      ctx.fillStyle = '#8b4513'
      ctx.beginPath()
      ctx.ellipse(ex + 14, e.y + 20, 14, 14, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#f5c5a3'
      ctx.fillRect(ex + 4, e.y + 8, 20, 14)
      ctx.fillStyle = '#000'
      ctx.fillRect(ex + 6, e.y + 10, 4, 4)
      ctx.fillRect(ex + 18, e.y + 10, 4, 4)
      ctx.fillStyle = '#e52521'
      ctx.fillRect(ex + 4, e.y + 20, 20, 2)
      // Feet
      ctx.fillStyle = '#5c3317'
      ctx.fillRect(ex, e.y + 22, 10, 6)
      ctx.fillRect(ex + 18, e.y + 22, 10, 6)
    }

    const draw = () => {
      const s = stateRef.current
      const camX = s.camera.x
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

      // Sky gradient
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
      grad.addColorStop(0, levelData.bg[0])
      grad.addColorStop(1, levelData.bg[1])
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

      // Clouds / Stars
      if (level === 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        [[100,60],[250,40],[450,70],[650,50]].forEach(([cx,cy]) => {
          const rx = cx - (camX * 0.3) % CANVAS_W
          ctx.beginPath(); ctx.ellipse(rx, cy, 40, 20, 0, 0, Math.PI*2); ctx.fill()
          ctx.beginPath(); ctx.ellipse(rx-25, cy+5, 25, 15, 0, 0, Math.PI*2); ctx.fill()
          ctx.beginPath(); ctx.ellipse(rx+25, cy+5, 25, 15, 0, 0, Math.PI*2); ctx.fill()
        })
      }

      // Ground tiles
      groundTiles.forEach(t => {
        const tx = t.x * TILE - camX
        if (tx > -TILE && tx < CANVAS_W + TILE) {
          if (t.type === 'grass') {
            ctx.fillStyle = levelData.grassColor
            ctx.fillRect(tx, t.y * TILE, TILE, TILE)
            ctx.fillStyle = levelData.groundColor
            ctx.fillRect(tx, t.y * TILE + 8, TILE, TILE - 8)
          } else {
            ctx.fillStyle = levelData.groundColor
            ctx.fillRect(tx, t.y * TILE, TILE, TILE)
            ctx.fillStyle = 'rgba(0,0,0,0.2)'
            ctx.fillRect(tx + 1, t.y * TILE + 1, TILE - 2, TILE - 2)
          }
        }
      })

      // Blocks
      s.blocks.forEach(b => {
        const bx = b.x * TILE - camX
        if (bx < -TILE || bx > CANVAS_W + TILE) return
        if (b.type === 'brick') {
          ctx.fillStyle = '#e87040'
          ctx.fillRect(bx, b.y * TILE, TILE, TILE)
          ctx.fillStyle = '#c0582c'
          ctx.fillRect(bx, b.y * TILE, TILE, 2)
          ctx.fillRect(bx, b.y * TILE, 2, TILE)
          ctx.fillRect(bx + TILE - 2, b.y * TILE, 2, TILE)
          ctx.fillRect(bx, b.y * TILE + TILE - 2, TILE, 2)
        } else if (b.type === 'qmark') {
          ctx.fillStyle = b.hit ? '#888' : '#f7d51d'
          ctx.fillRect(bx, b.y * TILE, TILE, TILE)
          ctx.fillStyle = b.hit ? '#666' : '#e6c000'
          ctx.fillRect(bx, b.y * TILE, TILE, 3)
          ctx.fillRect(bx, b.y * TILE, 3, TILE)
          if (!b.hit) {
            ctx.fillStyle = '#fff'
            ctx.font = 'bold 18px serif'
            ctx.textAlign = 'center'
            ctx.fillText('?', bx + TILE/2, b.y * TILE + TILE/2 + 7)
          }
        } else if (b.type === 'pipe') {
          ctx.fillStyle = '#2d8a2d'
          ctx.fillRect(bx - 4, b.y * TILE, TILE + 8, TILE)
          ctx.fillRect(bx, b.y * TILE + TILE, TILE, TILE * 2)
          ctx.fillStyle = '#1a6b1a'
          ctx.fillRect(bx - 4, b.y * TILE, 6, TILE)
          ctx.fillRect(bx, b.y * TILE + TILE, 6, TILE * 2)
        }
      })

      // Coins
      s.coins.forEach(c => {
        if (c.collected) return
        const cx2 = c.x * TILE - camX
        const bob = Math.sin(Date.now() / 300 + c.id) * 3
        ctx.fillStyle = '#f7d51d'
        ctx.beginPath()
        ctx.ellipse(cx2 + TILE/2, c.y * TILE + TILE/2 + bob, 7, 10, 0, 0, Math.PI*2)
        ctx.fill()
        ctx.fillStyle = '#ffec5e'
        ctx.fillRect(cx2 + TILE/2 - 3, c.y * TILE + TILE/2 - 7 + bob, 6, 4)
      })

      // Flag
      const flagX = levelData.flag * TILE - camX
      ctx.fillStyle = '#666'
      ctx.fillRect(flagX, 100, 4, 200)
      ctx.fillStyle = '#e52521'
      ctx.fillRect(flagX - 20, 100, 24, 16)

      // Enemies
      s.enemies.forEach(e => drawEnemy(ctx, e, camX))

      // Player
      drawPlayer(ctx, s.player, camX)

      // Particles
      s.particles.forEach(pt => {
        ctx.globalAlpha = pt.life
        ctx.fillStyle = pt.color
        ctx.fillRect(pt.x - camX - pt.size/2, pt.y - pt.size/2, pt.size, pt.size)
        ctx.globalAlpha = 1
      })
    }

    const loop = (now) => {
      const dt = Math.min(now - lastTime, 50)
      lastTime = now
      update(dt)
      draw()
      animFrameRef.current = requestAnimationFrame(loop)
    }
    animFrameRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('keydown', keydown)
      window.removeEventListener('keyup', keyup)
    }
  }, [level])

  const handleGameOver = () => {
    const s = stateRef.current
    onGameOver({ score: s?.score || 0, level, coins: s?.coinCount || 0, time_seconds: levelData.timeLimit - (s?.time || 0) })
  }

  return (
    <div style={{ width:'100vw', height:'100vh', background:'#000', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:"'Press Start 2P', monospace" }}>
      {/* HUD */}
      <div style={{ width:CANVAS_W, display:'flex', justifyContent:'space-between', padding:'8px 16px', background:'rgba(0,0,0,0.8)', borderBottom:'2px solid #333' }}>
        <span style={{color:'#fff', fontSize:'9px'}}>👤 {user?.username?.toUpperCase()}</span>
        <span style={{color:'#f7d51d', fontSize:'9px'}}>★ {hud.score.toLocaleString()}</span>
        <span style={{color:'#f7d51d', fontSize:'9px'}}>🪙 ×{hud.coins}</span>
        <span style={{color:'#fff', fontSize:'9px'}}>❤ ×{hud.lives}</span>
        <span style={{color: hud.time < 30 ? '#e52521' : '#fff', fontSize:'9px'}}>⏱ {hud.time}</span>
        <span style={{color:'#aaa', fontSize:'9px'}}>WORLD {level}-1</span>
      </div>

      <div style={{ position:'relative' }}>
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={{ display:'block', imageRendering:'pixelated' }} />

        {overlay && (
          <div style={{
            position:'absolute', inset:0, background:'rgba(0,0,0,0.75)',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'
          }}>
            {overlay === 'win' && <>
              <div style={{fontSize:'24px', color:'#f7d51d', textShadow:'3px 3px #e52521', marginBottom:'16px'}}>🎉 LEVEL CLEAR!</div>
              <div style={{fontSize:'10px', color:'#fff', marginBottom:'8px'}}>SCORE: {hud.score.toLocaleString()}</div>
              <div style={{fontSize:'10px', color:'#f7d51d', marginBottom:'32px'}}>COINS: {hud.coins}</div>
            </>}
            {(overlay === 'dead' || overlay === 'timeover') && <>
              <div style={{fontSize:'24px', color:'#e52521', marginBottom:'16px'}}>{overlay === 'timeover' ? '⏱ TIME UP!' : '💀 GAME OVER'}</div>
              <div style={{fontSize:'10px', color:'#fff', marginBottom:'32px'}}>FINAL SCORE: {hud.score.toLocaleString()}</div>
            </>}
            <button onClick={handleGameOver} style={{ padding:'12px 28px', background:'#e52521', border:'none', borderRadius:'4px', color:'#fff', fontFamily:"'Press Start 2P', monospace", fontSize:'9px', cursor:'pointer', boxShadow:'0 4px 0 #8b0000', marginBottom:'12px' }}>SAVE & MENU</button>
            <button onClick={() => window.location.reload()} style={{ padding:'10px 24px', background:'transparent', border:'2px solid #888', borderRadius:'4px', color:'#888', fontFamily:"'Press Start 2P', monospace", fontSize:'8px', cursor:'pointer' }}>RETRY</button>
          </div>
        )}
      </div>

      {/* Mobile controls */}
      <div style={{ width:CANVAS_W, display:'flex', justifyContent:'space-between', padding:'12px 32px', background:'rgba(0,0,0,0.8)' }}>
        <div style={{ display:'flex', gap:'8px' }}>
          {[['←','ArrowLeft'],['→','ArrowRight']].map(([label, code]) => (
            <button key={code}
              onTouchStart={() => keysRef.current[code] = true}
              onTouchEnd={() => keysRef.current[code] = false}
              onMouseDown={() => keysRef.current[code] = true}
              onMouseUp={() => keysRef.current[code] = false}
              style={{ width:'52px', height:'52px', background:'rgba(255,255,255,0.15)', border:'2px solid #555', borderRadius:'8px', color:'#fff', fontSize:'18px', cursor:'pointer', fontFamily:'serif' }}>{label}</button>
          ))}
        </div>
        <button
          onTouchStart={() => keysRef.current['Space'] = true}
          onTouchEnd={() => keysRef.current['Space'] = false}
          onMouseDown={() => keysRef.current['Space'] = true}
          onMouseUp={() => keysRef.current['Space'] = false}
          style={{ width:'80px', height:'52px', background:'rgba(229,37,33,0.8)', border:'2px solid #e52521', borderRadius:'8px', color:'#fff', fontSize:'9px', cursor:'pointer', fontFamily:"'Press Start 2P', monospace" }}>JUMP</button>
        <button onClick={onMenu} style={{ padding:'8px 16px', background:'transparent', border:'2px solid #555', borderRadius:'8px', color:'#888', fontSize:'7px', cursor:'pointer', fontFamily:"'Press Start 2P', monospace" }}>MENU</button>
      </div>
    </div>
  )
}
