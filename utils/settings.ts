import { storage } from '#imports';
import { DAY_MS } from './duration';
import { isLanguageSetting, type LanguageSetting } from './i18n';

const DISPLAY_MODES = ['hide', 'blur', 'placeholder'] as const;

/**
 * 차단된 댓글을 보여 주는 방법.
 * - hide: 완전히 숨긴다.
 * - blur: 흐리게 하고, 마우스를 올리면 "숨긴 항목 보기"가 나온다.
 * - placeholder: "차단된 댓글" 한 줄로 바꾸고 "숨긴 항목 보기"를 둔다.
 */
export type DisplayMode = (typeof DISPLAY_MODES)[number];

function isDisplayMode(value: unknown): value is DisplayMode {
  return DISPLAY_MODES.some((mode) => mode === value);
}

/** 차단 목록은 여기 없다. 커질 수 있어서 utils/blocklist.ts가 storage.local에 따로 둔다. */
export interface Settings {
  /**
   * 차단 기능 전체. 끄면 유튜브 화면에서 아무것도 가리지 않고 댓글 메뉴 버튼도 붙이지 않는다.
   * 차단 목록은 그대로 두어 다시 켜면 돌아온다. 디버그 패널은 이 값과 상관없이 debugPanel을 따른다.
   */
  enabled: boolean;
  /** 유튜브 화면 오른쪽에 읽은 댓글 목록과 차단 버튼을 띄운다. 채널 ID를 손으로 복사하지 않아도 되게. */
  debugPanel: boolean;
  /** 댓글 메뉴의 "임시 차단"을 눌렀을 때 차단하는 기간(ms). 이미 걸어 둔 임시 차단의 기간은 바뀌지 않는다. */
  temporaryDurationMs: number;
  /** 영구 차단과 임시 차단을 각각 어떻게 보여 줄지. */
  display: { permanent: DisplayMode; temporary: DisplayMode };
  /**
   * blur나 placeholder일 때, 최상위 댓글이 차단이면 그 답글까지 가릴지.
   * hide는 이 값과 상관없이 스레드째 숨긴다. 댓글만 숨기면 "답글 N개"가 부모 없이 남기 때문이다.
   */
  coverReplies: boolean;
  /** UI 언어. 'auto'면 브라우저 언어를 따른다. 팝업, 차단 목록 페이지, 첫 사용 안내, 유튜브 화면의 메뉴·가림막·패널이 모두 따른다. */
  language: LanguageSetting;
}

/** updateSettings()에 넘기는 변경. display는 한쪽만 넘겨도 된다. */
export type SettingsPatch = Partial<Omit<Settings, 'display'>> & {
  display?: Partial<Settings['display']>;
};

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  debugPanel: false,
  temporaryDurationMs: 7 * DAY_MS,
  display: { permanent: 'hide', temporary: 'blur' },
  coverReplies: false,
  language: 'auto',
};

/**
 * 'sync:' 접두사 = chrome.storage.sync. 같은 크롬 계정의 다른 기기와 동기화된다.
 * 팝업과 콘텐츠 스크립트가 이 하나를 공유하고, watchSettings()로 구독하면 어느 쪽에서 바꿔도 즉시 반영된다.
 * 모듈 밖으로 내보내지 않는다. 읽기, 쓰기, 구독은 아래 함수로만 해서 병합 규칙이 한 곳에 있게 한다.
 */
const settingsItem = storage.defineItem<Settings>('sync:settings', {
  fallback: DEFAULT_SETTINGS,
});

export async function loadSettings(): Promise<Settings> {
  return withDefaults(await settingsItem.getValue());
}

/**
 * 다른 창에서 바꾼 값을 덮어쓰지 않도록 최신 값을 읽어서 병합한다. 병합한 결과를 돌려준다.
 * 저장된 값 그대로에 병합한다. withDefaults()를 거친 값에 병합하면, 더 새 버전이 적어 둔 값(이 버전이 모르는 언어 같은 것)을
 * 기본값으로 바꿔 써서 그 PC의 설정까지 되돌린다.
 */
export async function updateSettings(patch: SettingsPatch): Promise<Settings> {
  const stored = await settingsItem.getValue();
  const next: Settings = {
    ...stored,
    ...patch,
    display: { ...stored.display, ...patch.display },
  };
  await settingsItem.setValue(next);
  return withDefaults(next);
}

export function watchSettings(callback: (settings: Settings) => void): () => void {
  return settingsItem.watch((next) => callback(withDefaults(next)));
}

/**
 * 저장된 값을 이 버전이 쓸 수 있는 설정으로. 다른 버전이 쓴 값일 수 있어서 그대로 믿지 않는다.
 * - 전에 저장된 객체에는 나중에 추가한 필드가 없다. fallback은 값이 통째로 없을 때만 쓰이므로 읽을 때마다 DEFAULT_SETTINGS 위에 덮어 쓴다.
 * - 더 새 버전이 쓴 객체에는 이 버전이 모르는 언어나 표시 방법이 있을 수 있다. 그대로 쓰면 글을 못 찾아 화면이 죽는다. 기본값으로 읽는다.
 */
function withDefaults(value: Partial<Settings> | null | undefined): Settings {
  const display = value?.display;
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    display: {
      permanent: isDisplayMode(display?.permanent) ? display.permanent : DEFAULT_SETTINGS.display.permanent,
      temporary: isDisplayMode(display?.temporary) ? display.temporary : DEFAULT_SETTINGS.display.temporary,
    },
    language: isLanguageSetting(value?.language) ? value.language : DEFAULT_SETTINGS.language,
  };
}
