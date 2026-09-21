import { useParams, useNavigate } from 'react-router-dom';
import ChitDetailPanel from '../components/ChitDetailPanel';

// Thin route wrapper: all the actual chit-detail logic (participants,
// payments, shuffle, ledger, etc.) lives in <ChitDetailPanel/> so it can be
// reused here AND inline inside the Chits list accordion (ChitsPage.tsx)
// without duplicating any code, data-fetching, or business logic.
export default function ChitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  if (!id) return null;
  return (
    <ChitDetailPanel
      chitId={id}
      onDeleted={() => navigate('/chits')}
      onRequestClose={() => navigate('/chits')}
    />
  );
}
