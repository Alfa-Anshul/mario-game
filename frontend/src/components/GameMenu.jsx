import React, { useState, useEffect } from 'react'

export default function GameMenu({ user, onStartGame, onLogout, onLeaderboard }) {
  const [selected, setSelected] = useState(0)
  const [scores, setScores] = useState([])

  useEffect(() => {
    fetch('/api/my-scores', { headers: { Authorization: `Bearer ${localStorage.getItem('mario_token')}` } })
      .then(r => r.json()).then(setScores).catch(() => {})
  }, [])

  const menuItems = [
    { label: '▶ LEVEL 1', action: () => onStartGame(1), color: '#5dbb63' },
    { label: '▶ LEVEL 2', action: () => onStartGame(2), color: '#4ecdc4' },
    { label: '▶ LEVEL 3', action: () => onStartGame(3), color: '#f7d51d' },
    { label: '🏆 LEADERBOARD', action: onLeaderboard, color: '#e52521' },
    { label: '⇦ LOGOUT', action: onLogout, color: '#888' },
  ]

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowUp') setSelected(s => Math.max(0, s-1))
      if (e.key === 'ArrowDown') setSelected(s => Math.min(menuItems.length-1, s+1))
      if (e.key === 'Enter') menuItems[selected].action()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selected])

  return (
    <div style={{
      width:'100vw', height:'100vh',
      background:'linear-gradient(180deg, #1a0533 0%, #0d1b4b 40%, #1a4a1a 100%)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      fontFamily:"'Press Start 2P', monospace", position:'relative', overflow:'hidden'
    }}>
      {/* Stars */}
      {Array.from({length:50}).map((_,i) => (
        <div key={i} style={{
          position:'absolute', width:`${Math.random()*3+1}px`, height:`${Math.random()*3+1}px`,
          background:'#fff', borderRadius:'50%', opacity: Math.random()*0.8+0.2,
          top:`${Math.random()*60}%`, left:`${Math.random()*100}%`,
          animation:`twinkle ${Math.random()*3+1}s infinite alternate`
        }} />
      ))}
      <style>{`@keyframes twinkle{from{opacity:0.2}to{opacity:1}} @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}} @keyframes glow{from{text-shadow:3px 3px #e52521,0 0 20px #f7d51d}to{text-shadow:3px 3px #e52521,0 0 40px #f7d51d,0 0 60px #e52521}}`}</style>

      {/* Title */}
      <div style={{ fontSize:'28px', color:'#f7d51d', animation:'glow 1.5s infinite alternate', marginBottom:'8px', textShadow:'3px 3px #e52521' }}>SUPER MARIO</div>
      <div style={{ fontSize:'14px', color:'#fff', marginBottom:'4px' }}>WORLD</div>
      <div style={{ fontSize:'8px', color:'#aaa', marginBottom:'40px' }}>★ ADVENTURE ★</div>

      {/* Mario sprite */}
      <div style={{ fontSize:'48px', animation:'float 2s infinite', marginBottom:'24px' }}>🍄</div>

      {/* Welcome */}
      <div style={{ fontSize:'9px', color:'#f7d51d', marginBottom:'8px' }}>WELCOME, {user?.username?.toUpperCase()}!</div>
      {scores[0] && <div style={{ fontSize:'7px', color:'#aaa', marginBottom:'32px' }}>BEST: {Math.max(...scores.map(s=>s.score))} PTS</div>}

      {/* Menu */}
      <div style={{ display:'flex', flexDirection:'column', gap:'12px', width:'280px' }}>
        {menuItems.map((item, i) => (
          <div key={i}
            onClick={item.action}
            onMouseEnter={() => setSelected(i)}
            style={{
              padding:'14px 20px', border:`2px solid ${selected===i ? item.color : '#333'}`,
              borderRadius:'4px', cursor:'pointer', textAlign:'center',
              fontSize:'9px', color: selected===i ? item.color : '#888',
              background: selected===i ? 'rgba(255,255,255,0.05)' : 'transparent',
              transition:'all 0.15s', transform: selected===i ? 'scale(1.05)' : 'scale(1)'
            }}>
            {selected===i ? '» ' : '  '}{item.label}
          </div>
        ))}
      </div>
      <div style={{ position:'absolute', bottom:'20px', fontSize:'7px', color:'#444' }}>USE ↑↓ ARROWS + ENTER OR CLICK</div>
    </div>
  )
}
