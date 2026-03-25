'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Board } from '@/lib/types'

export default function DashboardPage() {
  const [boards, setBoards] = useState<Board[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data } = await supabase
        .from('boards')
        .select('*')
        .order('created_at', { ascending: false })
      setBoards(data ?? [])
      setLoading(false)
    }
    init()
  }, [])

  const createBoard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('boards')
      .insert({ title: newTitle.trim(), owner_id: user.id })
      .select()
      .single()
    if (data) {
      setBoards([data, ...boards])
      setNewTitle('')
    }
  }

  const deleteBoard = async (id: string) => {
    if (!confirm('このボードを削除しますか？')) return
    await supabase.from('boards').delete().eq('id', id)
    setBoards(boards.filter(b => b.id !== id))
  }

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return <div className="flex items-center justify-center h-screen">読み込み中...</div>

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">マイボード</h1>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">ログアウト</button>
      </div>

      <form onSubmit={createBoard} className="flex gap-2 mb-8">
        <input
          type="text"
          placeholder="新しいボード名..."
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          作成
        </button>
      </form>

      {boards.length === 0 ? (
        <p className="text-gray-500 text-center py-10">ボードがありません。作成してみましょう！</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {boards.map(board => (
            <div
              key={board.id}
              className="bg-white rounded-lg shadow p-4 flex justify-between items-center group"
            >
              <button
                onClick={() => router.push(`/board/${board.id}`)}
                className="font-medium text-left hover:text-blue-500 flex-1"
              >
                {board.title}
              </button>
              <button
                onClick={() => deleteBoard(board.id)}
                className="text-gray-300 hover:text-red-400 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
