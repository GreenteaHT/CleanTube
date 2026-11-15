import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import BlockList from '@/components/BlockList';
import Logo from '@/components/Logo';
import { languageOptions } from '@/components/displayModes';
import { useBlocked } from '@/hooks/useBlocked';
import { useI18n } from '@/hooks/useI18n';
import { useSettings } from '@/hooks/useSettings';
import { useSyncWarning } from '@/hooks/useSyncWarning';
import './App.css';

type Tab = 'blockList' | 'language';
const TABS: Tab[] = ['blockList', 'language'];

/** 주소의 #language로 언어 탭을 바로 연다. 그 밖에는 차단 목록. 팝업의 "차단 목록 관리"는 #없이 연다. */
function tabFromHash(): Tab {
  return location.hash === '#language' ? 'language' : 'blockList';
}

/**
 * 설정 페이지. 팝업의 "차단 목록 관리"로 탭 하나에 열린다. 차단 목록과 언어를 탭으로 나눈다.
 * 목록은 끝없이 늘고 항목마다 차단한 경위가 달려 있어서, 좁고 포커스를 잃으면 닫히는 팝업에 두지 않는다.
 */
export default function App() {
  const { t } = useI18n();
  const { blocked, add, remove } = useBlocked();
  const syncWarning = useSyncWarning();
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ blockList: null, language: null });

  useEffect(() => {
    document.title = `CleanTube · ${t.settings.title}`;
  }, [t]);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const select = (next: Tab) => {
    setTab(next);
    // 새로 고쳐도 보던 탭이 그대로이게 주소에 적는다. 뒤로 가기 기록은 늘리지 않는다
    history.replaceState(null, '', next === 'language' ? '#language' : location.pathname);
  };

  // 탭 사이는 화살표로, 처음과 끝은 Home·End로 옮긴다(WAI-ARIA 탭 패턴). Tab 키는 탭 묶음에서 바로 내용으로 간다.
  const onTabKey = (e: KeyboardEvent) => {
    const at = TABS.indexOf(tab);
    const index =
      e.key === 'ArrowRight' ? at + 1 : e.key === 'ArrowLeft' ? at - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? -1 : null;
    if (index === null) return;
    e.preventDefault();
    const next = TABS.at(index % TABS.length) ?? 'blockList';
    select(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <>
      <header className="page-bar">
        <Logo />
        <span className="wordmark mono">CleanTube</span>
        <span className="muted" aria-hidden="true">
          /
        </span>
        <h1>{t.settings.title}</h1>
      </header>

      <main className="page">
        <div className="page-tabs" role="tablist" aria-label={t.settings.title} onKeyDown={onTabKey}>
          {TABS.map((id) => (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[id] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              // 고른 탭의 내용만 그린다. 그리지 않은 패널을 가리키면 일부 화면 읽기 프로그램이 없는 대상으로 다룬다
              aria-controls={tab === id ? `panel-${id}` : undefined}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => select(id)}
            >
              {t.settings.tabs[id]}
            </button>
          ))}
        </div>

        <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tab-panel">
          {tab === 'blockList' &&
            (!blocked ? (
              <p className="muted">{t.common.loading}</p>
            ) : (
              <>
                {syncWarning && (
                  <p className="notice">
                    {syncWarning.kind === 'over'
                      ? t.sync.overLong(syncWarning.unsynced)
                      : t.sync.nearLong(syncWarning.percent)}
                  </p>
                )}
                <BlockList entries={blocked} onAdd={add} onRemove={remove} />
                <p className="muted footer">{t.list.footer}</p>
              </>
            ))}
          {tab === 'language' && <LanguagePanel />}
        </section>
      </main>
    </>
  );
}

/** 언어 고르기. 고르는 즉시 저장되고, 열려 있는 모든 화면(유튜브 탭 포함)이 그 언어로 바뀐다. */
function LanguagePanel() {
  const { t, setting, browserLocale } = useI18n();
  const { update } = useSettings();
  return (
    <fieldset className="choices">
      <legend className="sr-only">{t.settings.tabs.language}</legend>
      {languageOptions(t, browserLocale).map((option) => (
        <label key={option.value} className="choice">
          <input
            type="radio"
            name="language"
            value={option.value}
            checked={setting === option.value}
            onChange={() => void update({ language: option.value })}
          />
          {/* 언어 이름은 그 언어로 적혀 있다. 화면 읽기 프로그램이 그 언어로 읽게 */}
          <span lang={option.value === 'auto' ? undefined : option.value}>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
