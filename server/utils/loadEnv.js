import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

export function loadServerEnv(
  rootDir = process.cwd(),
  mode = process.env.NODE_ENV || 'development'
) {
  const envFiles = ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]

  const loadedFiles = []

  envFiles.forEach(fileName => {
    const envPath = path.join(rootDir, fileName)
    if (!fs.existsSync(envPath)) {
      return
    }

    dotenv.config({
      path: envPath,
      override: true,
    })
    loadedFiles.push(fileName)
  })

  console.log(`[ENV] mode=${mode}, loaded=${loadedFiles.join(', ') || 'none'}`)
}
