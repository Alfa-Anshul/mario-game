import React, { useState, useEffect } from 'react'
import AuthPage from './components/AuthPage'
import GameMenu from './components/GameMenu'
import Game from './components/Game'
import Leaderboard from './components/Leaderboard'

export default function App() {
  const [user, setUser] = useState(null)
  const [screen, setScreen] = useState('auth') // auth | menu | game | leaderboard
  const [gameLevel, setGameLevel] = useState(1)

  useEffect(() => {
    const token = localStorage.getItem('mario_token')
    const username = localStorage.getItem('mario_username')
    if (token && username) {
      setUser({ token, username })
      setScreen('menu')
    }
  }, [])

  const handleLogin = (userData) => {
    localStorage.setItem('mario_token', userData.access_token)
    localStorage.setItem('mario_username', userData.username)
    setUser(userData)
    setScreen('menu')
  }

  const handleLogout = () => {
    localStorage.removeItem('mario_token')
    localStorage.removeItem('mario_username')
    setUser(null)
    setScreen('auth')
  }

  const handleStartGame = (level = 1) => {
    setGameLevel(level)
    setScreen('game')
  }

  const handleGameOver = async (scoreData) => {
    if (user) {
      try {
        await fetch('/api/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.access_token || localStorage.getItem('mario_token')}` },
          body: JSON.stringify(scoreData)
        })
      } catch(e) { console.error(e) }
    }
    setScreen('menu')
  }

  if (screen === 'auth') return <AuthPage onLogin={handleLogin} />
  if (screen === 'game') return <Game user={user} level={gameLevel} onGameOver={handleGameOver} onMenu={() => setScreen('menu')} />
  if (screen === 'leaderboard') return <Leaderboard user={user} onBack={() => setScreen('menu')} />
  return <GameMenu user={user} onStartGame={handleStartGame} onLogout={handleLogout} onLeaderboard={() => setScreen('leaderboard')} />
}
