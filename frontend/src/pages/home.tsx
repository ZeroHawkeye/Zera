import { createLazyRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { GreetService } from '@/gen/greet/v1/greet_pb'
import { config } from '@/config'

export const Route = createLazyRoute('/')({
  component: HomePage,
})

const transport = createConnectTransport({
  baseUrl: config.apiBaseUrl,
  useBinaryFormat: config.useBinaryFormat,
})

const client = createClient(GreetService, transport)

function HomePage() {
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
          ConnectRPC Hello World
        </h1>
        <div className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors placeholder:text-gray-400"
          />
          <button
            onClick={handleGreet}
            disabled={loading}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Loading...' : 'Greet'}
          </button>
          {greeting && (
            <p className="mt-4 p-4 bg-gray-50 rounded-lg text-center text-gray-700">{greeting}</p>
          )}
        </div>
      </div>
    </div>
  )
}
