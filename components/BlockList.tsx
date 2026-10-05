import { useState } from 'react';
import { entryKey, isExpired, parseEntry, type BlockEntry } from '@/utils/matcher';
import './BlockList.css';

interface Props {
  entries: BlockEntry[];
  onAdd: (entry: BlockEntry) => void;
  onRemove: (entry: BlockEntry) => void;
}

/**
 * 차단 목록 보기와 편집. 손으로 넣는 항목은 영구 차단이다.
 * 임시 차단은 누구를 얼마 동안인지 댓글을 보면서 정하는 것이라 유튜브 화면의 메뉴에서만 만든다.
 */
export default function BlockList({ entries, onAdd, onRemove }: Props) {
  const [draft, setDraft] = useState('');
  // 만료된 임시 차단은 다음에 목록을 쓸 때 지워진다. 그 전에도 목록에는 보이지 않게.
  const now = Date.now();
  const active = entries.filter((e) => !isExpired(e, now));
  const parsed = parseEntry(draft);

  const add = () => {
    if (!parsed) return;
    onAdd(parsed);
    setDraft('');
  };

  return (
    <section className="block-list">
      <h2>
        차단한 작성자 <span className="count">{active.length}</span>
      </h2>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="@핸들 또는 채널 ID (정확히 일치)"
        />
        <button type="submit" disabled={!parsed}>
          추가
        </button>
      </form>

      {active.length === 0 ? (
        <p className="empty">아직 없어요.</p>
      ) : (
        <ul>
          {active.map((entry) => (
            <li key={entryKey(entry)}>
              <div className="who">
                <span className="name">{entry.handle ?? entry.channelId}</span>
                <span className="detail">{describe(entry)}</span>
              </div>
              <button
                type="button"
                onClick={() => onRemove(entry)}
                aria-label={`${entry.handle ?? entry.channelId} 차단 해제`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function describe(entry: BlockEntry): string {
  const kind = entry.until === undefined ? '영구' : `${formatUntil(entry.until)}까지`;
  // 핸들이 이름 자리에 나갔으면 채널 ID를 덧붙여 어느 쪽으로 매칭되는지 보이게 한다
  return entry.handle && entry.channelId ? `${kind} · ${entry.channelId}` : kind;
}

function formatUntil(until: number): string {
  return new Date(until).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
