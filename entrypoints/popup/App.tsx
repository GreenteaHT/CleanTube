import { useState } from 'react';
import { browser } from '#imports';
import { useSettings } from '@/hooks/useSettings';
import './App.css';

/** 툴바 아이콘을 눌렀을 때 뜨는 팝업. 자주 쓰는 조작만 담는다. */
export default function App() {
  const { settings, update } = useSettings();
  const [draft, setDraft] = useState('');

  if (!settings) return <div className="popup muted">불러오는 중…</div>;

  const addKeyword = () => {
    const value = draft.trim();
    if (!value) return;
    const exists = settings.keywords.some((k) => k.toLowerCase() === value.toLowerCase());
    if (!exists) update({ keywords: [...settings.keywords, value] });
    setDraft('');
  };

  return (
    <div className="popup">
      <header>
        <h1>CleanTube</h1>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          {settings.enabled ? '켜짐' : '꺼짐'}
        </label>
      </header>

      <fieldset disabled={!settings.enabled}>
        <div className="field">
          <span className="label">처리 방식</span>
          <div className="segmented">
            <button
              type="button"
              className={settings.mode === 'hide' ? 'active' : ''}
              onClick={() => update({ mode: 'hide' })}
            >
              숨기기
            </button>
            <button
              type="button"
              className={settings.mode === 'blur' ? 'active' : ''}
              onClick={() => update({ mode: 'blur' })}
            >
              흐리게
            </button>
          </div>
        </div>

        <form
          className="field"
          onSubmit={(e) => {
            e.preventDefault();
            addKeyword();
          }}
        >
          <span className="label">키워드 빠른 추가</span>
          <div className="row">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="예: 스포일러"
            />
            <button type="submit" disabled={!draft.trim()}>
              추가
            </button>
          </div>
        </form>

        <div className="checks">
          <label className="check">
            <input
              type="checkbox"
              checked={settings.hideShorts}
              onChange={(e) => update({ hideShorts: e.target.checked })}
            />
            쇼츠 숨기기
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.hideAllComments}
              onChange={(e) => update({ hideAllComments: e.target.checked })}
            />
            댓글 전체 숨기기
          </label>
        </div>
      </fieldset>

      <footer>
        <span className="muted">
          키워드 {settings.keywords.length}개 · 채널 {settings.channels.length}개
        </span>
        <button type="button" className="link" onClick={() => browser.runtime.openOptionsPage()}>
          상세 설정
        </button>
      </footer>
    </div>
  );
}
