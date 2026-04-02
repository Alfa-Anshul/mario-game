import React, { useEffect, useState } from 'react'

export default function Leaderboard({ user, onBack }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/leaderboard?limit=10')
      .then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const medals = ['🥇','🥈','🥉']
  const rowColors = ['#f7d51d','#c0c0c0','#cd7f32']

  return (
    <div style={{
      width:'100vw', height:'100vh',
      background:'linear-gradient(180deg, #1a0533 0%, #0d1b4b 100%)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      fontFamily:"'Press Start 2P', monospace", padding:'20px'
    }}>
      <div style={{ fontSize:'18px', color:'#f7d51d', textShadow:'3px 3px #e52521', marginBottom:'8px' }}>🏆 LEADERBOARD</div>
      <div style={{ fontSize:'8px', color:'#aaa', marginBottom:'32px' }}>TOP MARIO PLAYERS</div>

      <div style={{ width:'100%', maxWidth:'600px' }}>
        {loading ? <div style={{textAlign:'center',color:'#888',fontSize:'10px'}}>LOADING...</div> :
          data.length === 0 ? <div style={{textAlign:'center',color:'#888',fontSize:'9px'}}>NO SCORES YET. BE THE FIRST!</div> :
          data.map((row, i) => (
            <div key={i} style={{
              display:'flex', alignItems:'center', padding:'14px 20px',
              marginBottom:'8px', borderRadius:'4px',
              background: row.username === user?.username ? 'rgba(229,37,33,0.2)' : 'rgba(255,255,255,0.05)',
              border: `2px solid ${i < 3 ? rowColors[i] : row.username === user?.username ? '#e52521' : '#333'}`,
              transition:'all 0.2s'
            }}>
              <span style={{ fontSize:'16px', marginRight:'16px', minWidth:'30px' }}>{medals[i] || `#${i+1}`}</span>
              <span style={{ flex:1, fontSize:'9px', color: i<3 ? rowColors[i] : '#fff' }}>{row.username.toUpperCase()}</span>
              <span style={{ fontSize:'9px', color:'#f7d51d', marginRight:'16px' }}>{row.best_score.toLocaleString()} PTS</span>
              <span style={{ fontSize:'7px', color:'#888' }}>LVL {row.best_level}</span>
            </div>
          ))
        }
      </div>

      <button onClick={onBack} style={{
        marginTop:'32px', padding:'12px 32px',
        background:'linear-gradient(135deg,#e52521,#c0392b)',
        border:'none', borderRadius:'4px', color:'#fff',
        fontFamily:"'Press Start 2P', monospace", fontSize:'9px',
        cursor:'pointer', boxShadow:'0 4px 0 #8b0000'
      }}>⇦ BACK</button>
    </div>
  )
}
