import { useEffect, useRef, useState } from 'react';
import { entryKey, isExpired, parseEntry, type BlockEntry } from '@/utils/matcher';
import './BlockList.css';

interface Props {
  entries: BlockEntry[];
  onAdd: (entry: BlockEntry) => void;
  onRemove: (entry: BlockEntry) => void;
}

type SortOrder = 'recent' | 'oldest' | 'name' | 'until';

const SORT_LABELS: Record<SortOrder, string> = {
  recent: '최근에 차단한 순',
  oldest: '오래된 순',
  name: '이름순',
  until: '곧 풀리는 순',
};

// 풀리는 때는 임시 차단에만 있다
const PERMANENT_ORDERS: SortOrder[] = ['recent', 'oldest', 'name'];
const TEMPORARY_ORDERS: SortOrder[] = [...PERMANENT_ORDERS, 'until'];

// 한 쪽에 보여 줄 항목 수. 임시값이다. 목록이 실제로 길어지면 다시 본다.
const PAGE_SIZE = 20;

/**
 * 차단 목록 보기와 편집. 영구 차단과 임시 차단을 따로 묶어 보여 준다. 손으로 넣는 항목은 영구 차단이다.
 * 임시 차단은 누구를 얼마 동안인지 댓글을 보면서 정하는 것이라 유튜브 화면의 메뉴에서만 만든다.
 */
export default function BlockList({ entries, onAdd, onRemove }: Props) {
  const [draft, setDraft] = useState('');
  // 펼쳐 둔 항목. 목록이 길어지지 않게 두 묶음을 통틀어 한 번에 하나만 펼친다.
  const [openKey, setOpenKey] = useState<string | null>(null);
  // 만료된 임시 차단은 다음에 목록을 쓸 때 지워진다. 그 전에도 목록에는 보이지 않게.
  const now = Date.now();
  const active = entries.filter((e) => !isExpired(e, now));
  const parsed = parseEntry(draft);
  // 목록이 쪽으로 나뉘어 있어서 브라우저의 찾기로는 다른 쪽의 항목을 못 찾는다. 그래서 검색을 따로 둔다.
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const found = query ? active.filter((e) => matchesQuery(e, query)) : active;
  const group = { query, openKey, onToggle: setOpenKey, onRemove };
  // 손으로 넣는 입력칸은 접어 두고 제목 옆 + 버튼으로 펼친다
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 펼쳐지는 중에 포커스가 가면 잘린 영역이 입력칸을 보이려고 스스로 스크롤한다. 그걸 막는다
    if (adding) inputRef.current?.focus({ preventScroll: true });
  }, [adding]);

  const add = () => {
    if (!parsed) return;
    onAdd({ ...parsed, at: Date.now() });
    setDraft('');
  };

  return (
    <section className="block-list">
      <div className="list-head">
        <h2>
          차단한 작성자 <span className="count">{active.length}</span>
        </h2>
        <button
          type="button"
          className="add-toggle"
          aria-expanded={adding}
          aria-controls="block-list-add"
          aria-label="작성자 직접 추가"
          title="작성자 직접 추가"
          onClick={() => setAdding(!adding)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>
        <input
          type="search"
          className="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="작성자 검색"
          aria-label="차단한 작성자 검색"
        />
      </div>

      {/* 접혀 있을 때는 탭으로도 들어가지 못하게 inert */}
      <div id="block-list-add" className={adding ? 'add open' : 'add'} inert={!adding}>
        <div className="add-clip">
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="@핸들 또는 채널 ID (정확히 일치)"
            />
            <button type="submit" disabled={!parsed}>
              추가
            </button>
          </form>
        </div>
      </div>

      <Group
        title="영구 차단"
        orders={PERMANENT_ORDERS}
        entries={found.filter((e) => e.until === undefined)}
        {...group}
      />
      <Group
        title="임시 차단"
        orders={TEMPORARY_ORDERS}
        entries={found.filter((e) => e.until !== undefined)}
        {...group}
      />
    </section>
  );
}

interface GroupProps {
  title: string;
  orders: SortOrder[];
  /** 이 묶음에서 보여 줄 항목. 검색 중이면 걸린 것만 온다. */
  entries: BlockEntry[];
  /** 검색어. 소문자로 바꾸고 앞뒤 공백을 뗀 것. 검색 중이 아니면 빈 문자열. */
  query: string;
  openKey: string | null;
  onToggle: (key: string | null) => void;
  onRemove: (entry: BlockEntry) => void;
}

/** 영구 차단이나 임시 차단 한 묶음. 정렬과 쪽은 묶음마다 따로이고 저장하지 않는다. */
function Group({ title, orders, entries, query, openKey, onToggle, onRemove }: GroupProps) {
  const [order, setOrder] = useState<SortOrder>('recent');
  // 보던 쪽은 그때의 검색어와 같이 기억한다. 검색어가 바뀌면 결과가 달라지므로 첫 쪽부터 다시 본다.
  const [page, setPage] = useState({ query, index: 0 });
  const headRef = useRef<HTMLDivElement>(null);

  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  // 항목을 빼서 쪽이 줄었으면 마지막 쪽을 보여 준다
  const current = Math.min(page.query === query ? page.index : 0, pageCount - 1);
  const visible = sortEntries(entries, order).slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const turnTo = (next: number) => {
    setPage({ query, index: next });
    // 쪽 버튼은 목록 아래에 있다. 넘긴 쪽을 위에서부터 읽게, 제목이 화면 위로 나가 있으면 들인다
    headRef.current?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <section className="group">
      <div className="group-head" ref={headRef}>
        <h3>
          {title} <span className="count">{entries.length}</span>
        </h3>
        {/* 하나뿐이면 정렬할 게 없다 */}
        {entries.length > 1 && (
          <select
            value={order}
            aria-label={`${title} 정렬`}
            onChange={(e) => {
              setOrder(e.target.value as SortOrder);
              // 순서가 바뀌면 보던 쪽은 뜻이 없다
              setPage({ query, index: 0 });
            }}
          >
            {orders.map((o) => (
              <option key={o} value={o}>
                {SORT_LABELS[o]}
              </option>
            ))}
          </select>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="empty">{query ? '찾는 작성자가 없어요.' : '아직 없어요.'}</p>
      ) : (
        <ul>
          {visible.map((entry) => {
            const key = entryKey(entry);
            const name = displayName(entry);
            const detail = describe(entry);
            const open = openKey === key;
            // 이 기록이 생기기 전에 만든 항목은 펼쳐 볼 게 없다
            const hasDetails = entry.at !== undefined || entry.source !== undefined;
            return (
              <li key={key}>
                <div className="summary">
                  <div className="who">
                    <span className="name">{name}</span>
                    {detail && <span className="detail">{detail}</span>}
                  </div>
                  {hasDetails && (
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-label={`${name} 차단한 경위 ${open ? '접기' : '보기'}`}
                      onClick={() => onToggle(open ? null : key)}
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

      {pageCount > 1 && (
        <nav className="pager" aria-label={`${title} 쪽 넘기기`}>
          <button type="button" disabled={current === 0} onClick={() => turnTo(current - 1)}>
            이전
          </button>
          <span>
            {current + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={current === pageCount - 1}
            onClick={() => turnTo(current + 1)}
          >
            다음
          </button>
        </nav>
      )}
    </section>
  );
}

/** 저장된 순서는 넣은 순서다. 차단한 때가 같거나 없는 항목끼리는 그 순서를 따른다. */
function sortEntries(entries: BlockEntry[], order: SortOrder): BlockEntry[] {
  const sorted = [...entries];
  const byTime = (a: BlockEntry, b: BlockEntry) => (a.at ?? 0) - (b.at ?? 0);
  switch (order) {
    case 'oldest':
      return sorted.sort(byTime);
    case 'recent':
      return sorted.sort(byTime).reverse();
    case 'name':
      // 핸들은 적은 대로 저장돼 있어서 대소문자가 섞여 있다. 매칭처럼 대소문자를 가리지 않는다.
      return sorted.sort((a, b) =>
        displayName(a).localeCompare(displayName(b), 'ko', { sensitivity: 'base' }),
      );
    case 'until':
      return sorted.sort((a, b) => (a.until ?? Infinity) - (b.until ?? Infinity));
  }
}

/** 줄에 보이는 것, 곧 핸들과 채널 ID에서 찾는다. query는 소문자여야 한다. */
function matchesQuery(entry: BlockEntry, query: string): boolean {
  return [entry.handle, entry.channelId].some((value) => value?.toLowerCase().includes(query));
}

function displayName(entry: BlockEntry): string {
  return entry.handle ?? entry.channelId ?? '';
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

/** 이름 아래 한 줄. 영구인지 임시인지는 묶음 제목이 말하므로 적지 않는다. 적을 게 없으면 빈 문자열. */
function describe(entry: BlockEntry): string {
  const parts: string[] = [];
  if (entry.until !== undefined) parts.push(`${formatTime(entry.until)}까지`);
  // 핸들이 이름 자리에 나갔으면 채널 ID를 덧붙여 어느 쪽으로 매칭되는지 보이게 한다
  if (entry.handle && entry.channelId) parts.push(entry.channelId);
  return parts.join(' · ');
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
