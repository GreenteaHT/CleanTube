import BlockList from '@/components/BlockList';
import Logo from '@/components/Logo';
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

  return (
    <>
      <header className="page-bar">
        <Logo />
        <span className="wordmark mono">CleanTube</span>
        <span className="muted" aria-hidden="true">
          /
        </span>
        <h1>차단 목록</h1>
      </header>

      {!blocked ? (
        <main className="page muted">불러오는 중…</main>
      ) : (
        <main className="page">
          {syncWarning && (
            <p className="notice">
              {syncWarning.kind === 'over'
                ? `동기화 공간 부족. 오래전에 차단한 ${syncWarning.unsynced}명은 다른 PC와 동기화 안 됨. 이 PC에서는 그대로 가림`
                : `동기화 공간 ${syncWarning.percent}% 사용 중. 다 차면 오래전에 차단한 작성자부터 동기화에서 빠짐`}
            </p>
          )}
          <BlockList entries={blocked} onAdd={add} onRemove={remove} />
          <p className="muted">
            유튜브 댓글에 마우스를 올리면 나오는 버튼으로도 차단 가능. 임시 차단은 거기서만 가능
          </p>
        </main>
      )}
    </>
  );
}
