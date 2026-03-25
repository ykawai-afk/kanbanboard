'use client'

import { useState } from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { ColumnWithCards } from '@/lib/types'
import CardItem from './CardItem'

type Props = {
  column: ColumnWithCards
  onAddCard: (columnId: string, title: string) => void
  onDeleteCard: (cardId: string) => void
  onDeleteColumn: (columnId: string) => void
}

export default function ColumnComponent({ column, onAddCard, onDeleteCard, onDeleteColumn }: Props) {
  const [newCardTitle, setNewCardTitle] = useState('')
  const [adding, setAdding] = useState(false)

  const { setNodeRef } = useDroppable({ id: column.id, data: { type: 'column', columnId: column.id } })

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCardTitle.trim()) return
    onAddCard(column.id, newCardTitle.trim())
    setNewCardTitle('')
    setAdding(false)
  }

  return (
    <div className="bg-gray-200 rounded-lg p-3 w-64 flex-shrink-0 flex flex-col max-h-full">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-sm text-gray-700">{column.title}</h3>
        <button
          onClick={() => onDeleteColumn(column.id)}
          className="text-gray-400 hover:text-red-400 text-xs"
        >
          ✕
        </button>
      </div>

      {/* カード一覧 */}
      <div ref={setNodeRef} className="flex flex-col gap-2 flex-1 overflow-y-auto min-h-[4px]">
        <SortableContext
          items={column.cards.map(c => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map(card => (
            <CardItem key={card.id} card={card} onDelete={onDeleteCard} />
          ))}
        </SortableContext>
      </div>

      {/* カード追加 */}
      {adding ? (
        <form onSubmit={handleAddCard} className="mt-2">
          <input
            autoFocus
            type="text"
            placeholder="カード名を入力..."
            value={newCardTitle}
            onChange={e => setNewCardTitle(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1 mb-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <div className="flex gap-1">
            <button type="submit" className="text-xs bg-blue-500 text-white rounded px-2 py-1 hover:bg-blue-600">
              追加
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
            >
              キャンセル
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-300 rounded px-2 py-1 text-left"
        >
          + カードを追加
        </button>
      )}
    </div>
  )
}
