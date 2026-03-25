'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card } from '@/lib/types'

type Props = {
  card: Card
  onDelete: (id: string) => void
}

export default function CardItem({ card, onDelete }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: { type: 'card', card } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded shadow px-3 py-2 flex justify-between items-start group cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <span className="text-sm break-words flex-1">{card.title}</span>
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={() => onDelete(card.id)}
        className="text-gray-300 hover:text-red-400 ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs flex-shrink-0"
      >
        ✕
      </button>
    </div>
  )
}
