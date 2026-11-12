import BlockList from '@/components/BlockList';
import { useBlocked } from '@/hooks/useBlocked';
import { useSyncWarning } from '@/hooks/useSyncWarning';
import './App.css';

/**
 * 차단 목록 페이지. 팝업의 "차단 목록 관리"로 탭 하나에 열린다.
 * 목록은 끝없이 늘고 항목마다 차단한 경위가 달려 있어서, 좁고 포커스를 잃으면 닫히는 팝업에 두지 않는다.
 */
export default function App() {
  const { blocked, add, remove } = useBlocked();
  const syncWarning = useSyncWarning();

  if (!blocked) return <div className="page muted">불러오는 중…</div>;

  return (
    <div className="page">
      <h1>CleanTube</h1>

      {syncWarning && (
        <p className="notice">
          {syncWarning.kind === 'over'
            ? `동기화 공간이 모자라 오래전에 차단한 ${syncWarning.unsynced}명은 다른 PC로 가지 않아요. 이 PC에서는 그대로 가려져요.`
            : `동기화 공간의 ${syncWarning.percent}%를 쓰고 있어요. 다 차면 오래전에 차단한 작성자부터 다른 PC로 가지 않아요.`}
        </p>
      )}
      <BlockList entries={blocked} onAdd={add} onRemove={remove} />
      <p className="muted">
        유튜브 댓글에 마우스를 올리면 나오는 버튼으로도 차단할 수 있어요. 임시 차단은 거기서만 돼요.
      </p>
    </div>
  );
}
