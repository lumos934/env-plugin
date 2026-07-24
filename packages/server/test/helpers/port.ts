import { createServer } from 'net'

/**
 * 获取一个可用的随机端口
 */
export function getRandomPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, () => {
      const address = server.address()
      if (address && typeof address !== 'string') {
        const port = address.port
        server.close(() => resolve(port))
      } else {
        reject(new Error('Failed to get random port'))
      }
    })
    server.on('error', reject)
  })
}
