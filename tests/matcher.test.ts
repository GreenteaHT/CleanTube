import { describe, expect, it } from 'vitest';
import { entryKey, findBlock, isExpired, matches, parseEntry, type BlockEntry } from '../utils/matcher';

const ID = 'UCrKxP6IDEsFLuX_g8bx-43w';
const OTHER_ID = 'UCC5NfQ6Mf0dq_eEwv4P_hWA';
const NOW = 1_000_000;

describe('findBlock: 핸들', () => {
  const entries: BlockEntry[] = [{ handle: '@SanDiegoZoo' }];

  it('대소문자와 앞의 @를 무시한다', () => {
    expect(findBlock({ handle: '@sandiegozoo' }, entries, NOW)).toBe(entries[0]);
    expect(findBlock({ handle: 'SANDIEGOZOO' }, entries, NOW)).toBe(entries[0]);
  });

  it('앞뒤 공백을 무시한다', () => {
    expect(findBlock({ handle: '  @SanDiegoZoo ' }, entries, NOW)).toBe(entries[0]);
  });

  it('일부만 같으면 매칭하지 않는다', () => {
    expect(findBlock({ handle: '@SanDiegoZo' }, entries, NOW)).toBeNull();
    expect(findBlock({ handle: '@SanDiegoZoo2' }, entries, NOW)).toBeNull();
  });

  it('한글과 일본어 핸들', () => {
    expect(findBlock({ handle: '@김무식-i9t' }, [{ handle: '김무식-i9t' }], NOW)).not.toBeNull();
    expect(findBlock({ handle: '@ゴンギ' }, [{ handle: '@ゴンギ' }], NOW)).not.toBeNull();
  });

  it('빈 핸들끼리는 매칭하지 않는다', () => {
    expect(findBlock({ handle: '' }, [{ handle: '' }], NOW)).toBeNull();
    expect(findBlock({ handle: '@' }, [{ handle: '@' }], NOW)).toBeNull();
    expect(findBlock({}, [{ handle: '@a' }], NOW)).toBeNull();
  });
});

describe('findBlock: 채널 ID', () => {
  it('정확히 같아야 한다. 대소문자가 다르면 다른 채널', () => {
    expect(findBlock({ channelId: ID }, [{ channelId: ID }], NOW)).not.toBeNull();
    expect(findBlock({ channelId: ID }, [{ channelId: ID.toLowerCase() }], NOW)).toBeNull();
  });

  it('양쪽 다 채널 ID가 있으면 핸들이 같아도 ID가 다르면 매칭하지 않는다', () => {
    // 차단한 사람이 버린 핸들을 다른 사람이 가져간 경우
    const entries = [{ channelId: ID, handle: '@old' }];
    expect(findBlock({ channelId: OTHER_ID, handle: '@old' }, entries, NOW)).toBeNull();
  });

  it('핸들이 바뀌어도 채널 ID가 같으면 매칭한다', () => {
    const entries = [{ channelId: ID, handle: '@old' }];
    expect(findBlock({ channelId: ID, handle: '@new' }, entries, NOW)).toBe(entries[0]);
  });

  it('작성자의 채널 ID를 못 읽었으면 항목의 핸들로 매칭한다', () => {
    const entries = [{ channelId: ID, handle: '@name' }];
    expect(findBlock({ handle: '@name' }, entries, NOW)).toBe(entries[0]);
  });

  it('핸들만 있는 항목은 채널 ID가 있는 작성자도 핸들로 매칭한다', () => {
    expect(findBlock({ channelId: ID, handle: '@name' }, [{ handle: 'name' }], NOW)).not.toBeNull();
  });

  it('채널 ID만 있는 항목은 채널 ID를 못 읽은 작성자와 매칭하지 않는다', () => {
    expect(findBlock({ handle: '@name' }, [{ channelId: ID }], NOW)).toBeNull();
  });
});

describe('findBlock: 임시 차단', () => {
  it('만료 전에는 매칭하고 만료 시각부터는 하지 않는다', () => {
    const entries = [{ channelId: ID, until: NOW + 1 }];
    expect(findBlock({ channelId: ID }, entries, NOW)).toBe(entries[0]);
    expect(findBlock({ channelId: ID }, entries, NOW + 1)).toBeNull();
    expect(findBlock({ channelId: ID }, entries, NOW + 2)).toBeNull();
  });

  it('영구와 임시가 둘 다 걸리면 순서와 상관없이 영구를 돌려준다', () => {
    const temporary = { channelId: ID, until: NOW + 100 };
    const permanent = { handle: '@name' };
    const author = { channelId: ID, handle: '@name' };
    expect(findBlock(author, [temporary, permanent], NOW)).toBe(permanent);
    expect(findBlock(author, [permanent, temporary], NOW)).toBe(permanent);
  });

  it('만료된 임시 차단 뒤에 있는 유효한 항목은 찾는다', () => {
    const expired = { channelId: ID, until: NOW - 1 };
    const valid = { channelId: ID, until: NOW + 100 };
    expect(findBlock({ channelId: ID }, [expired, valid], NOW)).toBe(valid);
  });

  it('isExpired: until이 없으면 만료되지 않는다', () => {
    expect(isExpired({ channelId: ID }, Number.MAX_SAFE_INTEGER)).toBe(false);
    expect(isExpired({ channelId: ID, until: NOW }, NOW)).toBe(true);
    expect(isExpired({ channelId: ID, until: NOW + 1 }, NOW)).toBe(false);
  });
});

describe('findBlock: 빈 목록', () => {
  it('null', () => {
    expect(findBlock({ channelId: ID, handle: '@a' }, [], NOW)).toBeNull();
  });
});

describe('matches', () => {
  it('키가 다른 항목 둘이 같은 작성자에게 걸릴 수 있다', () => {
    // 손으로 넣은 핸들 항목과 메뉴로 넣은 채널 ID 항목. 작성자 기준으로 풀 때는 둘 다 빠져야 한다.
    const author = { channelId: ID, handle: '@name' };
    const typed = { handle: '@Name' };
    const fromMenu = { channelId: ID, handle: '@name', until: NOW + 100 };
    expect(entryKey(typed)).not.toBe(entryKey(fromMenu));
    expect(matches(author, typed)).toBe(true);
    expect(matches(author, fromMenu)).toBe(true);
  });

  it('핸들이 같아도 채널 ID가 다른 항목은 걸리지 않는다', () => {
    const author = { channelId: ID, handle: '@name' };
    expect(matches(author, { channelId: OTHER_ID, handle: '@name' })).toBe(false);
  });

  it('만료는 따지지 않는다', () => {
    expect(matches({ channelId: ID }, { channelId: ID, until: NOW - 1 })).toBe(true);
  });
});

describe('parseEntry', () => {
  it('채널 ID 모양이면 채널 ID로', () => {
    expect(parseEntry(ID)).toEqual({ channelId: ID });
    expect(parseEntry(`  ${ID} `)).toEqual({ channelId: ID });
  });

  it('그 밖에는 핸들로. @를 붙여 저장하고 대소문자는 입력한 대로 둔다', () => {
    expect(parseEntry('SanDiegoZoo')).toEqual({ handle: '@SanDiegoZoo' });
    expect(parseEntry(' @김무식-i9t ')).toEqual({ handle: '@김무식-i9t' });
  });

  it('UC로 시작해도 길이가 다르면 핸들', () => {
    expect(parseEntry('UCshort')).toEqual({ handle: '@UCshort' });
  });

  it('비어 있으면 null', () => {
    expect(parseEntry('')).toBeNull();
    expect(parseEntry('  ')).toBeNull();
    expect(parseEntry('@')).toBeNull();
  });

  it('채널 주소를 붙여 넣으면 그 안의 핸들을 꺼낸다', () => {
    expect(parseEntry('https://www.youtube.com/@SanDiegoZoo')).toEqual({ handle: '@SanDiegoZoo' });
    expect(parseEntry('youtube.com/@SanDiegoZoo/videos?view=0')).toEqual({ handle: '@SanDiegoZoo' });
    expect(parseEntry('@SanDiegoZoo/featured')).toEqual({ handle: '@SanDiegoZoo' });
  });

  it('주소의 핸들이 %로 인코딩돼 있으면 푼다', () => {
    expect(parseEntry('https://www.youtube.com/@%EA%B9%80%EB%AC%B4%EC%8B%9D-i9t')).toEqual({ handle: '@김무식-i9t' });
    expect(parseEntry('https://www.youtube.com/@100%')).toEqual({ handle: '@100%' });
  });

  it('채널 주소에 채널 ID가 있으면 채널 ID로', () => {
    expect(parseEntry(`https://www.youtube.com/channel/${ID}`)).toEqual({ channelId: ID });
    expect(parseEntry(`youtube.com/channel/${ID}/about`)).toEqual({ channelId: ID });
  });

  it('채널을 알 수 없는 주소와 공백이 있는 글은 null. 넣어도 아무에게도 걸리지 않는다', () => {
    expect(parseEntry('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseEntry('https://www.youtube.com/c/SanDiegoZoo')).toBeNull();
    expect(parseEntry(`https://www.youtube.com/channel/${ID}x`)).toBeNull();
    expect(parseEntry('@San Diego Zoo')).toBeNull();
  });
});

describe('entryKey', () => {
  it('채널 ID가 있으면 채널 ID', () => {
    expect(entryKey({ channelId: ID, handle: '@name' })).toBe(ID);
  });

  it('핸들만 있으면 정규화한 핸들. 표기가 달라도 같은 키', () => {
    expect(entryKey({ handle: '@Name' })).toBe('@name');
    expect(entryKey({ handle: 'NAME' })).toBe('@name');
  });
});
