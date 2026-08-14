import { onMounted, onUnmounted, ref } from 'vue'

/** WebSocket 消息体 */
export interface WsMessage {
  action: string
  data: unknown
}

interface UseWebSocketOptions {
  url: string
  onOpen?: () => void
  onMessage?: (message: WsMessage) => void
}

/**
 * WebSocket composable：封装连接、断开重连与生命周期管理。
 *
 * 组件挂载时自动连接，卸载时断开并清理重连定时器。
 * 消息解析后通过 onMessage 抛给调用方，由调用方处理业务分发。
 */
export function useWebSocket(options: UseWebSocketOptions) {
  const isConnected = ref(false)
  let socket: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let disposed = false

  function connect() {
    if (disposed) return
    socket = new WebSocket(options.url)

    socket.addEventListener('open', () => {
      isConnected.value = true
      options.onOpen?.()
    })

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data) as WsMessage
      options.onMessage?.(message)
    })

    socket.addEventListener('close', () => {
      isConnected.value = false
      scheduleReconnect()
    })

    socket.addEventListener('error', () => {
      scheduleReconnect()
    })
  }

  function scheduleReconnect() {
    // 防止 close 与 error 同时触发时产生多个重连定时器
    if (disposed || reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, 2000)
  }

  function disconnect() {
    disposed = true
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    socket?.close()
  }

  onMounted(connect)
  onUnmounted(disconnect)

  return { isConnected, disconnect }
}
