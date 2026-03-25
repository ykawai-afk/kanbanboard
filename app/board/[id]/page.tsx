import BoardView from '@/components/BoardView'

export default function BoardPage({ params }: { params: { id: string } }) {
  return <BoardView boardId={params.id} />
}
