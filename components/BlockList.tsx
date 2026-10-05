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
  // 펼쳐 둔 항목. 목록이 길어지지 않게 한 번에 하나만 펼친다.
  const [openKey, setOpenKey] = useState<string | null>(null);
  // 만료된 임시 차단은 다음에 목록을 쓸 때 지워진다. 그 전에도 목록에는 보이지 않게.
  const now = Date.now();
  const active = entries.filter((e) => !isExpired(e, now));
  const parsed = parseEntry(draft);

  const add = () => {
    if (!parsed) return;
    onAdd({ ...parsed, at: Date.now() });
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
          {active.map((entry) => {
            const key = entryKey(entry);
            const name = entry.handle ?? entry.channelId;
            const open = openKey === key;
            // 이 기록이 생기기 전에 만든 항목은 펼쳐 볼 게 없다
            const hasDetails = entry.at !== undefined || entry.source !== undefined;
            return (
              <li key={key}>
                <div className="summary">
                  <div className="who">
                    <span className="name">{name}</span>
                    <span className="detail">{describe(entry)}</span>
                  </div>
                  {hasDetails && (
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-label={`${name} 차단한 경위 ${open ? '접기' : '보기'}`}
                      onClick={() => setOpenKey(open ? null : key)}
                    >
                      {open ? '▴' : '▾'}
                    </button>
                  )}
                  <button type="button" onClick={() => onRemove(entry)} aria-label={`${name} 차단 해제`}>
                    ×
                  </button>
                </div>
                {open && <Details entry={entry} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** 언제, 어느 영상의 어떤 댓글을 보고 차단했는지. */
function Details({ entry }: { entry: BlockEntry }) {
  const { at, source } = entry;
  const link = youtubeUrl(source?.url);
  return (
    <dl className="details">
      {at !== undefined && (
        <>
          <dt>차단한 때</dt>
          <dd>{formatTime(at, true)}</dd>
        </>
      )}
      {source?.videoTitle && (
        <>
          <dt>영상</dt>
          <dd>{source.videoTitle}</dd>
        </>
      )}
      {source?.text && (
        <>
          <dt>댓글</dt>
          <dd className="quote">{source.text}</dd>
        </>
      )}
      {link && (
        <dd className="wide">
          <a href={link} target="_blank" rel="noreferrer">
            이 댓글로 이동
          </a>
        </dd>
      )}
      {!source && <dd className="wide muted">어느 댓글에서 차단했는지는 기록이 없어요.</dd>}
    </dl>
  );
}

function describe(entry: BlockEntry): string {
  const kind = entry.until === undefined ? '영구' : `${formatTime(entry.until)}까지`;
  // 핸들이 이름 자리에 나갔으면 채널 ID를 덧붙여 어느 쪽으로 매칭되는지 보이게 한다
  return entry.handle && entry.channelId ? `${kind} · ${entry.channelId}` : kind;
}

function formatTime(time: number, withYear = false): string {
  return new Date(time).toLocaleString('ko-KR', {
    year: withYear ? 'numeric' : undefined,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 저장된 주소가 유튜브의 https 주소일 때만 링크로 만든다. 저장소 값은 그대로 믿지 않는다. */
function youtubeUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const { protocol, hostname, href } = new URL(url);
    const isYoutube = hostname === 'youtube.com' || hostname.endsWith('.youtube.com');
    return protocol === 'https:' && isYoutube ? href : null;
  } catch {
    return null;
  }
}
