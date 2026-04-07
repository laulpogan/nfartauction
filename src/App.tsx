import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Lobby } from './components/lobby/Lobby'
import { GamePage } from './pages/GamePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/game/:code" element={<GamePage />} />
      </Routes>
    </BrowserRouter>
  )
}
