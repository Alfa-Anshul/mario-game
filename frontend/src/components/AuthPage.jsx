import React, { useState } from 'react'

const styles = {
  container: {
    width: '100vw', height: '100vh',
    background: 'linear-gradient(180deg, #5c94fc 0%, #5c94fc 60%, #228b22 60%, #228b22 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Press Start 2P', monospace",
    position: 'relative', overflow: 'hidden'
  },
  clouds: { position: 'absolute', top: 0, left: 0, width: '100%', height: '60%', overflow: 'hidden' },
  box: {
    background: 'rgba(0,0,0,0.85)',
    border: '4px solid #e52521',
    borderRadius: '8px',
    padding: '40px',
    width: '420px',
    boxShadow: '0 0 40px rgba(229,37,33,0.5), inset 0 0 20px rgba(0,0,0,0.8)',
    position: 'relative', zIndex: 10
  },
  title: { textAlign: 'center', color: '#f7d51d', fontSize: '20px', marginBottom: '8px', textShadow: '3px 3px #e52521' },
  subtitle: { textAlign: 'center', color: '#fff', fontSize: '10px', marginBottom: '32px', opacity: 0.7 },
  tabs: { display: 'flex', marginBottom: '24px', borderBottom: '2px solid #333' },
  tab: (active) => ({
    flex: 1, padding: '10px', textAlign: 'center', cursor: 'pointer', fontSize: '9px',
    color: active ? '#f7d51d' : '#888',
    borderBottom: active ? '2px solid #f7d51d' : '2px solid transparent',
    marginBottom: '-2px', transition: 'all 0.2s'
  }),
  label: { display: 'block', color: '#aaa', fontSize: '8px', marginBottom: '8px', marginTop: '16px' },
  input: {
    width: '100%', padding: '12px', background: '#1a1a2e',
    border: '2px solid #333', borderRadius: '4px', color: '#fff',
    fontFamily: "'Press Start 2P', monospace", fontSize: '10px',
    outline: 'none', transition: 'border-color 0.2s'
  },
  btn: {
    width: '100%', marginTop: '24px', padding: '14px',
    background: 'linear-gradient(135deg, #e52521, #c0392b)',
    border: 'none', borderRadius: '4px', color: '#fff',
    fontFamily: "'Press Start 2P', monospace", fontSize: '10px',
    cursor: 'pointer', letterSpacing: '1px',
    boxShadow: '0 4px 0 #8b0000', transition: 'all 0.1s'
  },
  error: { color: '#ff6b6b', fontSize: '8px', marginTop: '12px', textAlign: 'center' },
  success: { color: '#5dbb63', fontSize: '8px', marginTop: '12px', textAlign: 'center' }
}

export default function AuthPage({ onLogin }) {
  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(false)

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async () => {
    setLoading(true); setMsg({ type: '', text: '' })
    try {
      if (tab === 'register') {
        const r = await fetch('/api/register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: form.username, email: form.email, password: form.password })
        })
        const d = await r.json()
        if (!r.ok) { setMsg({ type: 'error', text: d.detail || 'Error' }); return }
        setMsg({ type: 'success', text: 'Account created! Logging in...' })
        setTab('login')
      }
      // login
      const fd = new FormData()
      fd.append('username', form.username); fd.append('password', form.password)
      const r = await fetch('/api/login', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) { setMsg({ type: 'error', text: d.detail || 'Invalid credentials' }); return }
      onLogin(d)
    } catch(e) {
      setMsg({ type: 'error', text: 'Connection error' })
    } finally { setLoading(false) }
  }

  return (
    <div style={styles.container}>
      <div style={styles.clouds}>
        {[10,30,55,75].map((l,i) => (
          <div key={i} style={{ position:'absolute', top:`${15+i*12}%`, left:`${l}%`,
            width:`${80+i*20}px`, height:'40px', background:'#fff', borderRadius:'50px',
            boxShadow:'0 0 0 10px #fff', opacity:0.9 }} />
        ))}
      </div>
      <div style={styles.box}>
        <div style={styles.title}>🍄 SUPER MARIO</div>
        <div style={styles.subtitle}>WORLD ADVENTURE</div>
        <div style={styles.tabs}>
          {['login','register'].map(t => (
            <div key={t} style={styles.tab(tab===t)} onClick={() => { setTab(t); setMsg({type:'',text:''}) }}>
              {t.toUpperCase()}
            </div>
          ))}
        </div>
        <label style={styles.label}>USERNAME</label>
        <input style={styles.input} name="username" value={form.username} onChange={handle} onFocus={e=>e.target.style.borderColor='#e52521'} onBlur={e=>e.target.style.borderColor='#333'} />
        {tab === 'register' && <><label style={styles.label}>EMAIL</label><input style={styles.input} name="email" type="email" value={form.email} onChange={handle} onFocus={e=>e.target.style.borderColor='#e52521'} onBlur={e=>e.target.style.borderColor='#333'} /></>}
        <label style={styles.label}>PASSWORD</label>
        <input style={styles.input} name="password" type="password" value={form.password} onChange={handle} onFocus={e=>e.target.style.borderColor='#e52521'} onBlur={e=>e.target.style.borderColor='#333'} onKeyDown={e=>e.key==='Enter'&&submit()} />
        <button style={styles.btn} onClick={submit} disabled={loading}
          onMouseDown={e=>{e.target.style.transform='translateY(4px)';e.target.style.boxShadow='none'}}
          onMouseUp={e=>{e.target.style.transform='';e.target.style.boxShadow='0 4px 0 #8b0000'}}>
          {loading ? 'LOADING...' : tab === 'login' ? '▶ PLAY NOW' : '✚ CREATE ACCOUNT'}
        </button>
        {msg.text && <div style={msg.type==='error'?styles.error:styles.success}>{msg.text}</div>}
      </div>
    </div>
  )
}
