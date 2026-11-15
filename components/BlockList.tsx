import { useEffect, useRef, useState } from 'react';
import Segmented from '@/components/Segmented';
import { useI18n } from '@/hooks/useI18n';
import type { Locale } from '@/utils/i18n';
import { entryKey, isExpired, parseEntry, type BlockEntry } from '@/utils/matcher';
import './BlockList.css';

interface Props {
  entries: BlockEntry[];
  onAdd: (entry: BlockEntry) => void;
  onRemove: (entry: BlockEntry) => void;
}

type SortOrder = 'recent' | 'oldest' | 'name' | 'until';

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
  const { t } = useI18n();
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
  // 지운 것을 화면 읽기 프로그램에 알린다. 줄이 사라지는 것은 읽어 주지 않아서
  const [announcement, setAnnouncement] = useState('');
  const remove = (entry: BlockEntry) => {
    onRemove(entry);
    setAnnouncement(t.list.unblocked(displayName(entry)));
  };
  const group = { query, openKey, onToggle: setOpenKey, onRemove: remove };
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
      {/* 처음부터 있어야 바뀐 글을 읽어 준다 */}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <div className="list-head">
        <p className="total">
          <span className="num mono">{active.length}</span>
          <span className="unit">{t.common.blockedCount}</span>
        </p>
        <div className="tools">
          <input
            type="search"
            className="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.list.search}
            aria-label={t.list.searchLabel}
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
            {t.list.add}
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
              placeholder={t.list.addPlaceholder}
            />
            <button type="submit" disabled={!parsed}>
              {t.list.addButton}
            </button>
          </form>
        </div>
      </div>

      <Group
        title={t.common.permanent}
        temporary={false}
        orders={PERMANENT_ORDERS}
        entries={found.filter((e) => e.until === undefined)}
        {...group}
      />
      <Group
        title={t.common.temporary}
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
  const { t, locale } = useI18n();
  const [order, setOrder] = useState<SortOrder>('recent');
  // 보던 쪽은 그때의 검색어와 같이 기억한다. 검색어가 바뀌면 결과가 달라지므로 첫 쪽부터 다시 본다.
  const [page, setPage] = useState({ query, index: 0 });
  const headRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // 지운 줄의 키와 그 줄이 쪽에서 몇 번째였는지. 줄이 사라지면 그 자리로 포커스를 옮긴다
  const [removing, setRemoving] = useState<{ key: string; index: number } | null>(null);

  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  // 항목을 빼서 쪽이 줄었으면 마지막 쪽을 보여 준다
  const current = Math.min(page.query === query ? page.index : 0, pageCount - 1);
  const visible = sortEntries(entries, order, locale).slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const visibleKeys = visible.map(entryKey).join('\n');

  // 지운 줄에 있던 포커스는 줄과 함께 사라진다. 그 자리에 올라온 줄(마지막이었으면 앞 줄)의 지우기 버튼으로 옮겨
  // 여러 명을 이어서 지울 수 있게 한다. 남은 줄이 없으면 묶음 제목으로. 지우기는 저장소를 거쳐 돌아오므로 줄이 실제로 사라진 뒤에 옮긴다.
  useEffect(() => {
    if (!removing || visibleKeys.split('\n').includes(removing.key)) return;
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('button.unblock') ?? [];
    const next = buttons[Math.min(removing.index, buttons.length - 1)] ?? titleRef.current;
    next?.focus();
    setRemoving(null);
  }, [removing, visibleKeys]);

  const turnTo = (next: number) => {
    setPage({ query, index: next });
    // 쪽 버튼은 목록 아래에 있다. 넘긴 쪽을 위에서부터 읽게, 제목이 화면 위로 나가 있으면 들인다
    headRef.current?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <section className={temporary ? 'group temporary' : 'group'}>
      <div className="group-head" ref={headRef}>
        {/* 마지막 줄을 지웠을 때 포커스를 받는다. Tab으로는 들르지 않는다 */}
        <h2 ref={titleRef} tabIndex={-1}>
          <span className="kind-mark" />
          {title} <span className="count mono">{entries.length}</span>
        </h2>
        {/* 하나뿐이면 정렬할 게 없다 */}
        {entries.length > 1 && (
          <Segmented
            label={t.list.sortLabel(title)}
            className="tabs"
            sliding={false}
            options={orders.map((o) => ({ value: o, label: t.list.sort[o] }))}
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
        <p className="empty">{query ? t.list.noMatch : t.list.empty}</p>
      ) : (
        <>
          {/* 칸 이름은 눈으로 보는 표의 머리글이다. 스크린 리더는 줄마다 단추 이름으로 누구인지 듣는다 */}
          <div className="columns" aria-hidden="true">
            <span>{t.list.columns.author}</span>
            {temporary && <span>{t.list.columns.until}</span>}
            <span>{t.list.columns.channel}</span>
          </div>
          <ul ref={listRef}>
            {visible.map((entry, index) => {
              const key = entryKey(entry);
              const name = displayName(entry);
              const open = openKey === key;
              // 이 기록이 생기기 전에 만든 항목은 펼쳐 볼 게 없다
              const hasDetails = entry.at !== undefined || entry.source !== undefined;
              return (
                <li key={key} className={open ? 'open' : undefined}>
                  <div className="summary">
                    <span className="name mono">{name}</span>
                    {entry.until !== undefined && <span className="until mono">{formatTime(entry.until, locale)}</span>}
                    {/* 핸들이 이름 자리에 나갔으면 채널 ID를 같이 보여 어느 쪽으로 매칭되는지 알게 한다 */}
                    <span className="channel mono">{entry.handle ? entry.channelId : undefined}</span>
                    <span className="actions">
                      {hasDetails && (
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-label={open ? t.list.hideDetails(name) : t.list.showDetails(name)}
                          onClick={() => onToggle(open ? null : key)}
                        >
                          <svg className="icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                            <path d={open ? 'M2.5 7.5L6 4l3.5 3.5' : 'M2.5 4.5L6 8l3.5-3.5'} />
                          </svg>
                        </button>
                      )}
                      <button
                        type="button"
                        className="unblock"
                        onClick={() => {
                          setRemoving({ key, index });
                          onRemove(entry);
                        }}
                        aria-label={t.list.unblock(name)}
                      >
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
        <nav className="pager mono" aria-label={t.list.pagerLabel(title)}>
          <button type="button" disabled={current === 0} onClick={() => turnTo(current - 1)}>
            {t.list.prev}
          </button>
          <span>
            {current + 1}/{pageCount}
          </span>
          <button
            type="button"
            disabled={current === pageCount - 1}
            onClick={() => turnTo(current + 1)}
          >
            {t.list.next}
          </button>
        </nav>
      )}
    </section>
  );
}

/** 저장된 순서는 넣은 순서다. 차단한 때가 같거나 없는 항목끼리는 그 순서를 따른다. */
function sortEntries(entries: BlockEntry[], order: SortOrder, locale: Locale): BlockEntry[] {
  const sorted = [...entries];
  const byTime = (a: BlockEntry, b: BlockEntry) => (a.at ?? 0) - (b.at ?? 0);
  switch (order) {
    case 'oldest':
      return sorted.sort(byTime);
    case 'recent':
      return sorted.sort(byTime).reverse();
    case 'name':
      // 핸들은 적은 대로 저장돼 있어서 대소문자가 섞여 있다. 매칭처럼 대소문자를 가리지 않는다. 글자 순서는 화면 언어를 따른다.
      return sorted.sort((a, b) =>
        displayName(a).localeCompare(displayName(b), locale, { sensitivity: 'base' }),
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
  const { t, locale } = useI18n();
  const { at, source } = entry;
  const link = youtubeUrl(source?.url);
  return (
    <dl className="details">
      {at !== undefined && (
        <>
          <dt>{t.list.details.at}</dt>
          <dd>{formatTime(at, locale, true)}</dd>
        </>
      )}
      {source?.videoTitle && (
        <>
          <dt>{t.list.details.video}</dt>
          <dd>{source.videoTitle}</dd>
        </>
      )}
      {source?.text && (
        <>
          <dt>{t.list.details.comment}</dt>
          <dd className="quote">{source.text}</dd>
        </>
      )}
      {link && (
        <dd className="wide">
          <a href={link} target="_blank" rel="noreferrer">
            {t.list.details.open}
          </a>
        </dd>
      )}
      {/* 경위는 동기화하지 않아서 다른 PC에서 차단한 항목에도 없다 */}
      {!source && <dd className="wide muted">{t.list.details.noSource}</dd>}
    </dl>
  );
}

function formatTime(time: number, locale: Locale, withYear = false): string {
  return new Date(time).toLocaleString(locale, {
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
