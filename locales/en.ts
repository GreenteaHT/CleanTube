/**
 * 영어. 다른 언어 파일의 기준이다. 문구를 더하면 여기부터 더하고, 다른 언어는 `satisfies Messages`가 빠진 것을 알려 준다.
 * 영어 문구는 짧은 문장, 첫 글자만 대문자, 끝에 마침표 없이. 두 마디를 이을 때는 " · ".
 * 숫자가 들어가는 문구는 함수다. 언어마다 복수형과 어순이 달라서.
 */

/** 첫 사용 안내의 예시 댓글 하나. 사람이 쓴 댓글을 흉내 낸 것이라 UI 말투를 따르지 않는다. 이름과 글은 지어낸 것이다. */
export interface SampleComment {
  handle: string;
  time: string;
  text: string;
  likes: string;
}

/** 동기화 공간이 모자라 담지 못한 차단. 짧은 안내와 긴 안내가 같이 쓴다. 하나일 때는 단수로 */
const oldestUnsynced = (n: number) =>
  n === 1 ? "1 oldest block doesn't sync to other devices" : `${n} oldest blocks don't sync to other devices`;

export const en = {
  common: {
    loading: 'Loading…',
    permanent: 'Permanent block',
    temporary: 'Temporary block',
    display: 'Display',
    displayOf: (kind: string) => `${kind} display`,
    modes: { hide: 'Hide completely', blur: 'Blur', placeholder: 'Replace with text' },
    /** 큰 숫자 뒤에 붙는다. "37 blocked" */
    blockedCount: 'blocked',
    days: (n: number) => (n === 1 ? '1 day' : `${n} days`),
    hours: (n: number) => (n === 1 ? '1 hour' : `${n} hours`),
  },
  /** 유튜브 화면의 가림막. 첫 사용 안내의 예시도 같은 글을 쓴다. */
  overlay: {
    blocked: 'Blocked comment',
    show: 'Show comment',
    hide: 'Hide again',
  },
  duration: {
    label: 'Duration',
    group: 'Temporary block duration',
    custom: 'Custom',
    amount: 'Duration',
    unit: 'Unit',
    hours: 'hours',
    days: 'days',
  },
  sync: {
    overShort: oldestUnsynced,
    nearShort: (percent: number) => `Sync storage ${percent}% used`,
    overLong: (n: number) =>
      `Sync storage full · ${oldestUnsynced(n)} · Still hidden on this device`,
    nearLong: (percent: number) =>
      `Sync storage ${percent}% used · When full, the oldest blocks stop syncing first`,
  },
  popup: {
    manageList: 'Manage block list',
    durationNote: 'Duration changes apply to new temporary blocks',
    coverReplies: 'Also cover replies',
    coverRepliesHint: 'Applies to blur and replace with text · Hide completely always includes replies',
    debugPanel: 'Debug panel',
    debugPanelHint: 'Shows the comments read on YouTube on the right',
    /** 팝업 맨 위 줄의 차단 기능 스위치. 글은 화면 읽기 프로그램이 읽고, 이름은 마우스를 올리면 나온다 */
    enabled: 'Blocking',
    enabledHint: 'When off, blocked comments show as usual · No CleanTube button on comments',
    previewHide: 'Nothing left in its place',
    previewBlur: 'Blurred comment example',
  },
  settings: {
    title: 'Settings',
    tabs: { blockList: 'Block list', language: 'Language' },
    languageAuto: (name: string) => `Browser language (${name})`,
  },
  list: {
    search: 'Search authors',
    searchLabel: 'Search blocked authors',
    add: 'Add manually',
    addPlaceholder: '@handle or channel ID (exact match)',
    addButton: 'Add',
    sort: {
      recent: 'Recently blocked',
      oldest: 'Oldest first',
      name: 'Name',
      until: 'Unblocking soon',
    },
    sortLabel: (group: string) => `Sort ${group.toLowerCase()}`,
    pagerLabel: (group: string) => `${group} pages`,
    prev: '← Prev',
    next: 'Next →',
    columns: { author: 'Author', until: 'Unblocks', channel: 'Channel ID' },
    empty: 'None yet',
    noMatch: 'No matching authors',
    showDetails: (name: string) => `Show why ${name} was blocked`,
    hideDetails: (name: string) => `Hide why ${name} was blocked`,
    unblock: (name: string) => `Unblock ${name}`,
    /** 차단 목록에서 지운 뒤 화면 읽기 프로그램에 알리는 글. 화면에는 보이지 않는다 */
    unblocked: (name: string) => `${name} unblocked`,
    details: {
      at: 'Blocked',
      video: 'Video',
      comment: 'Comment',
      open: 'Go to comment',
      noSource: 'No record on this device of which comment led to the block',
    },
    footer: 'You can also block from the button on YouTube comments · Temporary blocks only there',
  },
  onboarding: {
    title: 'Get started',
    language: 'Language',
    howTitle: 'How to block',
    howLead: 'Hover a comment → CleanTube button on the right → Block permanently or temporarily',
    howNotes: [
      "Blocked authors' comments stay hidden on every video from then on",
      'Permanent blocks last until you remove them · Temporary ones expire on their own',
    ],
    permanentTitle: 'Permanent block display',
    permanentLead: "For spam, spoilers, and others you won't need to see again · Lasts until removed",
    temporaryTitle: 'Temporary block duration and display',
    temporaryLead: "For people you'd rather not see for a while, like during an argument · Expires on its own",
    repliesDisabled: 'Available with blur or replace with text',
    repliesAlways: 'Hide completely always includes replies',
    repliesShared: 'Shared by permanent and temporary blocks',
    unchosen: (current: string) =>
      `Applies to the example below right away · If you skip, the current setting (${current}) stays`,
    captionHide: (handle: string) => `${handle}'s comment folds away with its replies · Nothing left in its place`,
    captionBlur: 'Blurred · Hover to see "Show comment"',
    captionPlaceholder: 'Only a "Blocked comment" line remains · "Show comment" opens it for a moment',
    repliesCovered: 'Replies covered too',
    repliesVisible: 'Replies stay visible',
    doneTitle: "You're all set",
    summaryReplies: 'Replies',
    summaryRepliesAlways: 'Always hidden with hide completely',
    summaryRepliesCovered: 'Covered too',
    summaryRepliesVisible: 'Left visible',
    changeLater: 'To change later: CleanTube icon in the toolbar → popup',
    skip: 'Skip',
    back: 'Back',
    next: 'Next',
    goToYoutube: 'Go to YouTube',
    navLabel: 'Guide pages',
    example: 'Example',
    exampleLabel: 'Example comments',
    reply: 'Reply',
  },
  youtube: {
    menuLabel: 'CleanTube menu',
    unknownAuthor: "Couldn't read the author",
    blockPermanent: 'Block permanently',
    unblockPermanent: 'Remove permanent block',
    blockTemporary: (duration: string) => `Block temporarily · ${duration}`,
    unblockTemporary: 'Remove temporary block',
    panel: {
      expand: 'Expand',
      collapse: 'Collapse',
      count: (comments: number, blocked: number) => `${comments} comments · ${blocked} blocked`,
      empty: 'No comments read on this page · Scroll until comments appear',
      noHandle: "Couldn't read the handle",
      noChannel: "Couldn't read the channel ID",
      block: 'Block',
      unblock: 'Unblock',
      permanent: 'Permanent block',
      until: (date: string) => `Blocked until ${date}`,
    },
  },
  samples: {
    before: {
      handle: '@moviefan_22',
      time: '3 hours ago',
      text: 'The direction was amazing. I held my breath through the last 10 minutes.',
      likes: '1.2K',
    },
    after: {
      handle: '@daily_watcher',
      time: '1 day ago',
      text: "This channel's edits are always so clean.",
      likes: '342',
    },
    spoiler: {
      handle: '@ending_recap_bot',
      time: '5 hours ago',
      text: 'SPOILER) In the last scene they break up and the main character leaves alone.',
      likes: '3',
    },
    spoilerReplies: [
      { handle: '@no_spoilers_pls', time: '4 hours ago', text: "Please don't spoil it… I haven't watched yet", likes: '58' },
      { handle: '@popcorn_time', time: '4 hours ago', text: "I wish comments like this didn't show up", likes: '21' },
    ],
    heated: {
      handle: '@heated_debater',
      time: '2 hours ago',
      text: "If you still think that after this video, there's no hope. Did anyone actually watch it?",
      likes: '12',
    },
    heatedReplies: [
      { handle: '@calm_viewer', time: '1 hour ago', text: "I don't think it's worth getting that worked up", likes: '40' },
      { handle: '@popcorn_time', time: '1 hour ago', text: 'Here we go again…', likes: '9' },
    ],
  } satisfies Record<string, SampleComment | SampleComment[]>,
};

export type Messages = typeof en;
