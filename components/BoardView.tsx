'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { createClient } from '@/lib/supabase'
import { Card, ColumnWithCards } from '@/lib/types'
import ColumnComponent from './ColumnComponent'
import CardItem from './CardItem'

export default function BoardView({ boardId }: { boardId: string }) {
  const [boardTitle, setBoardTitle] = useState('')
  const [columns, setColumns] = useState<ColumnWithCards[]>([])
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const [addingColumn, setAddingColumn] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const isSyncing = useRef(false)

  const fetchBoard = useCallback(async () => {
    const { data: board } = await supabase
      .from('boards')
      .select('title')
      .eq('id', boardId)
      .single()
    if (board) setBoardTitle(board.title)

    const { data: cols } = await supabase
      .from('columns')
      .select('*, cards(*)')
      .eq('board_id', boardId)
      .order('position')

    if (cols) {
      setColumns(
        cols.map(col => ({
          ...col,
          cards: (col.cards as Card[]).sort((a, b) => a.position - b.position),
        }))
      )
    }
  }, [boardId])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      await fetchBoard()
    }
    init()

    // リアルタイム購読
    const channel = supabase
      .channel(`board-${boardId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'columns' }, () => {
        if (!isSyncing.current) fetchBoard()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, () => {
        if (!isSyncing.current) fetchBoard()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [boardId, fetchBoard])

  // カラム追加
  const addColumn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newColumnTitle.trim()) return
    const maxPos = columns.reduce((max, c) => Math.max(max, c.position), -1)
    await supabase.from('columns').insert({
      board_id: boardId,
      title: newColumnTitle.trim(),
      position: maxPos + 1,
    })
    setNewColumnTitle('')
    setAddingColumn(false)
  }

  // カラム削除
  const deleteColumn = async (columnId: string) => {
    if (!confirm('このカラムとカードをすべて削除しますか？')) return
    isSyncing.current = true
    await supabase.from('columns').delete().eq('id', columnId)
    setColumns(prev => prev.filter(c => c.id !== columnId))
    isSyncing.current = false
  }

  // カード追加
  const addCard = async (columnId: string, title: string) => {
    const col = columns.find(c => c.id === columnId)
    if (!col) return
    const maxPos = col.cards.reduce((max, c) => Math.max(max, c.position), -1)
    isSyncing.current = true
    const { data } = await supabase
      .from('cards')
      .insert({ column_id: columnId, title, position: maxPos + 1 })
      .select()
      .single()
    if (data) {
      setColumns(prev =>
        prev.map(c => c.id === columnId ? { ...c, cards: [...c.cards, data] } : c)
      )
    }
    isSyncing.current = false
  }

  // カード削除
  const deleteCard = async (cardId: string) => {
    isSyncing.current = true
    await supabase.from('cards').delete().eq('id', cardId)
    setColumns(prev =>
      prev.map(c => ({ ...c, cards: c.cards.filter(card => card.id !== cardId) }))
    )
    isSyncing.current = false
  }

  // DnD: ドラッグ開始
  const onDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'card') {
      setActiveCard(event.active.data.current.card)
    }
  }

  // DnD: ドラッグ中（別カラムへのホバー）
  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeCol = columns.find(c => c.cards.some(card => card.id === activeId))
    if (!activeCol) return

    // カラム自体にホバー
    const overCol = columns.find(c => c.id === overId)
    if (overCol && overCol.id !== activeCol.id) {
      setColumns(prev => {
        const activeCard = activeCol.cards.find(c => c.id === activeId)!
        return prev.map(col => {
          if (col.id === activeCol.id) return { ...col, cards: col.cards.filter(c => c.id !== activeId) }
          if (col.id === overCol.id) return { ...col, cards: [...col.cards, { ...activeCard, column_id: col.id }] }
          return col
        })
      })
      return
    }

    // 別カラムのカードにホバー
    const overCardCol = columns.find(c => c.cards.some(card => card.id === overId))
    if (overCardCol && overCardCol.id !== activeCol.id) {
      setColumns(prev => {
        const activeCard = activeCol.cards.find(c => c.id === activeId)!
        const overIndex = overCardCol.cards.findIndex(c => c.id === overId)
        return prev.map(col => {
          if (col.id === activeCol.id) return { ...col, cards: col.cards.filter(c => c.id !== activeId) }
          if (col.id === overCardCol.id) {
            const newCards = [...col.cards]
            newCards.splice(overIndex, 0, { ...activeCard, column_id: col.id })
            return { ...col, cards: newCards }
          }
          return col
        })
      })
    }
  }

  // DnD: ドラッグ終了（DB保存）
  const onDragEnd = async (event: DragEndEvent) => {
    setActiveCard(null)
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeCol = columns.find(c => c.cards.some(card => card.id === activeId))
    if (!activeCol) return

    // 同一カラム内の並び替え
    const isSameColumn = activeCol.cards.some(c => c.id === overId)
    if (isSameColumn && activeId !== overId) {
      const oldIndex = activeCol.cards.findIndex(c => c.id === activeId)
      const newIndex = activeCol.cards.findIndex(c => c.id === overId)
      const reordered = arrayMove(activeCol.cards, oldIndex, newIndex)

      isSyncing.current = true
      setColumns(prev => prev.map(c => c.id === activeCol.id ? { ...c, cards: reordered } : c))
      await Promise.all(reordered.map((card, i) =>
        supabase.from('cards').update({ position: i }).eq('id', card.id)
      ))
      isSyncing.current = false
      return
    }

    // カラムをまたいだ移動
    const destCol = columns.find(c => c.cards.some(card => card.id === activeId))
    if (destCol && destCol.id !== activeCol.id) {
      // already moved in onDragOver, just persist
    }
    // 移動後の状態をDBに保存
    const movedCard = columns
      .flatMap(c => c.cards)
      .find(c => c.id === activeId)
    if (!movedCard) return

    const currentCol = columns.find(c => c.cards.some(c => c.id === activeId))
    if (!currentCol) return

    isSyncing.current = true
    await supabase.from('cards').update({
      column_id: currentCol.id,
      position: currentCol.cards.findIndex(c => c.id === activeId),
    }).eq('id', activeId)

    // 同じカラムの他のカードのpositionも更新
    await Promise.all(
      currentCol.cards.map((card, i) =>
        supabase.from('cards').update({ position: i }).eq('id', card.id)
      )
    )
    isSyncing.current = false
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  return (
    <div className="flex flex-col h-screen">
      {/* ヘッダー */}
      <header className="bg-blue-600 text-white px-6 py-3 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-blue-200 hover:text-white text-sm">
          ← ダッシュボード
        </button>
        <h1 className="text-lg font-bold">{boardTitle}</h1>
      </header>

      {/* ボード */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 p-6 overflow-x-auto flex-1 items-start">
          {columns.map(col => (
            <ColumnComponent
              key={col.id}
              column={col}
              onAddCard={addCard}
              onDeleteCard={deleteCard}
              onDeleteColumn={deleteColumn}
            />
          ))}

          {/* カラム追加 */}
          <div className="w-64 flex-shrink-0">
            {addingColumn ? (
              <form onSubmit={addColumn} className="bg-gray-200 rounded-lg p-3">
                <input
                  autoFocus
                  type="text"
                  placeholder="カラム名..."
                  value={newColumnTitle}
                  onChange={e => setNewColumnTitle(e.target.value)}
                  className="w-full text-sm border rounded px-2 py-1 mb-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <div className="flex gap-1">
                  <button type="submit" className="text-xs bg-blue-500 text-white rounded px-2 py-1 hover:bg-blue-600">
                    追加
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingColumn(false)}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setAddingColumn(true)}
                className="w-full text-sm text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-lg px-3 py-2 text-left"
              >
                + カラムを追加
              </button>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeCard && (
            <div className="bg-white rounded shadow px-3 py-2 text-sm rotate-2 opacity-90">
              {activeCard.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
