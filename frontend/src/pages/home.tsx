import { createLazyRoute } from '@tanstack/react-router'

export const Route = createLazyRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
          Zera
        </h1>
        <p className="text-center text-gray-600">
          欢迎使用 Zera 系统
        </p>
      </div>
    </div>
  )
}
