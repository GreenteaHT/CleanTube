import { useEffect, useRef, useState } from 'react';
import Segmented from '@/components/Segmented';
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
        <p className="total">
          <span className="num mono">{active.length}</span>
          <span className="unit">명 차단 중</span>
        </p>
        <div className="tools">
          <input
            type="search"
            className="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="작성자 검색"
            aria-label="차단한 작성자 검색"
          />
          <button
            type="button"
            className="add-toggle"
            aria-expanded={adding}
            aria-controls="block-list-add"
            onClick={() => setAdding(!adding)}
          >
            <svg className="icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M6 1.5v9M1.5 6h9" />
            </svg>
            직접 추가
          </button>
        </div>
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
        temporary={false}
        orders={PERMANENT_ORDERS}
        entries={found.filter((e) => e.until === undefined)}
        {...group}
      />
      <Group
        title="임시 차단"
        temporary
        orders={TEMPORARY_ORDERS}
        entries={found.filter((e) => e.until !== undefined)}
        {...group}
      />
    </section>
  );
}

interface GroupProps {
  title: string;
  /** 임시 차단 묶음이면 풀리는 때 칸이 붙고 호박색으로 칠한다. */
  temporary: boolean;
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
function Group({ title, temporary, orders, entries, query, openKey, onToggle, onRemove }: GroupProps) {
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
    <section className={temporary ? 'group temporary' : 'group'}>
      <div className="group-head" ref={headRef}>
        <h2>
          <span className="kind-mark" />
          {title} <span className="count mono">{entries.length}</span>
        </h2>
        {/* 하나뿐이면 정렬할 게 없다 */}
        {entries.length > 1 && (
          <Segmented
            label={`${title} 정렬`}
            className="tabs"
            sliding={false}
            options={orders.map((o) => ({ value: o, label: SORT_LABELS[o] }))}
            value={order}
            onChange={(next) => {
              setOrder(next);
              // 순서가 바뀌면 보던 쪽은 뜻이 없다
              setPage({ query, index: 0 });
            }}
          />
        )}
      </div>

      {entries.length === 0 ? (
        <p className="empty">{query ? '찾는 작성자 없음' : '아직 없음'}</p>
      ) : (
        <>
          {/* 칸 이름은 눈으로 보는 표의 머리글이다. 스크린 리더는 줄마다 단추 이름으로 누구인지 듣는다 */}
          <div className="columns" aria-hidden="true">
            <span>작성자</span>
            {temporary && <span>풀리는 때</span>}
            <span>채널 ID</span>
          </div>
          <ul>
            {visible.map((entry) => {
              const key = entryKey(entry);
              const name = displayName(entry);
              const open = openKey === key;
              // 이 기록이 생기기 전에 만든 항목은 펼쳐 볼 게 없다
              const hasDetails = entry.at !== undefined || entry.source !== undefined;
              return (
                <li key={key} className={open ? 'open' : undefined}>
                  <div className="summary">
                    <span className="name mono">{name}</span>
                    {entry.until !== undefined && <span className="until mono">{formatTime(entry.until)}</span>}
                    {/* 핸들이 이름 자리에 나갔으면 채널 ID를 같이 보여 어느 쪽으로 매칭되는지 알게 한다 */}
                    <span className="channel mono">{entry.handle ? entry.channelId : undefined}</span>
                    <span className="actions">
                      {hasDetails && (
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-label={`${name} 차단한 경위 ${open ? '접기' : '보기'}`}
                          onClick={() => onToggle(open ? null : key)}
                        >
                          <svg className="icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                            <path d={open ? 'M2.5 7.5L6 4l3.5 3.5' : 'M2.5 4.5L6 8l3.5-3.5'} />
                          </svg>
                        </button>
                      )}
                      <button type="button" onClick={() => onRemove(entry)} aria-label={`${name} 차단 해제`}>
                        <svg className="icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                          <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
                        </svg>
                      </button>
                    </span>
                  </div>
                  {open && <Details entry={entry} />}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {pageCount > 1 && (
        <nav className="pager mono" aria-label={`${title} 쪽 넘기기`}>
          <button type="button" disabled={current === 0} onClick={() => turnTo(current - 1)}>
            ← 이전
          </button>
          <span>
            {current + 1}/{pageCount}
          </span>
          <button
            type="button"
            disabled={current === pageCount - 1}
            onClick={() => turnTo(current + 1)}
          >
            다음 →
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
      {/* 경위는 동기화하지 않아서 다른 PC에서 차단한 항목에도 없다 */}
      {!source && <dd className="wide muted">어느 댓글에서 차단했는지 이 PC에 기록 없음</dd>}
    </dl>
  );
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
