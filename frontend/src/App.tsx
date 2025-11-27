import { useState } from 'react'
import { createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { GreetService } from './gen/greet/v1/greet_pb'
import { config } from './config'

const transport = createConnectTransport({
  baseUrl: config.apiBaseUrl,
  useBinaryFormat: config.useBinaryFormat,
})

const client = createClient(GreetService, transport)

function App() {
  const [name, setName] = useState('')
  const [greeting, setGreeting] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGreet = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      const response = await client.greet({ name })
      setGreeting(response.greeting)
    } catch (error) {
      console.error('Error:', error)
      setGreeting('Error connecting to server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h1>ConnectRPC Hello World</h1>
      <div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          style={{ padding: '8px', marginRight: '8px' }}
        />
        <button onClick={handleGreet} disabled={loading}>
          {loading ? 'Loading...' : 'Greet'}
        </button>
        {greeting && <p style={{ marginTop: '16px' }}>{greeting}</p>}
      </div>
    </>
  )
}

export default App
