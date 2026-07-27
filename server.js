import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const distPath = path.join(__dirname, 'dist')

app.use(express.static(distPath))

// SPA fallback: semua route dikembalikan ke index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`)
})
