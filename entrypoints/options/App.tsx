import ListEditor from '@/components/ListEditor';
import { useSettings } from '@/hooks/useSettings';
import { DEFAULT_SETTINGS } from '@/utils/settings';
import './App.css';

/** 상세 설정 페이지. 키워드·채널 목록처럼 공간이 필요한 조작은 여기에. */
export default function App() {
  const { settings, update } = useSettings();

  if (!settings) return <main className="options muted">불러오는 중…</main>;

  const reset = () => {
    if (confirm('모든 설정을 초기화할까요?')) update(DEFAULT_SETTINGS);
  };

  return (
    <main className="options">
      <header>
        <h1>CleanTube 설정</h1>
        <p className="muted">
          설정은 크롬 계정에 동기화됩니다. 바꾸면 열려 있는 유튜브 탭에 바로 반영돼요.
        </p>
      </header>

      <section>
        <h2>기본</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          확장기능 켜기
        </label>

        <div className="field">
          <span className="label">처리 방식</span>
          <label className="check">
            <input
              type="radio"
              name="mode"
              checked={settings.mode === 'hide'}
              onChange={() => update({ mode: 'hide' })}
            />
            숨기기 (화면에서 완전히 제거)
          </label>
          <label className="check">
            <input
              type="radio"
              name="mode"
              checked={settings.mode === 'blur'}
              onChange={() => update({ mode: 'blur' })}
            />
            흐리게 (마우스를 올리면 보임)
          </label>
        </div>

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
          댓글 섹션 전체 숨기기
        </label>
      </section>

      <ListEditor
        title="차단 키워드"
        placeholder="영상 제목이나 댓글에 포함되면 숨김 (대소문자 무시)"
        items={settings.keywords}
        onChange={(keywords) => update({ keywords })}
      />

      <ListEditor
        title="차단 채널"
        placeholder="채널명 또는 @핸들 (정확히 일치)"
        items={settings.channels}
        onChange={(channels) => update({ channels })}
      />

      <footer>
        <button type="button" onClick={reset}>
          모든 설정 초기화
        </button>
      </footer>
    </main>
  );
}
