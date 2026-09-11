import { CommentIdentityStore } from './comment-identity.store';

describe('CommentIdentityStore', () => {
  let store: CommentIdentityStore;

  beforeEach(() => {
    localStorage.clear();
    store = new CommentIdentityStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when nothing was ever stored', () => {
    expect(store.lookup('nobody@example.com')).toBeNull();
  });

  it('returns a remembered identity for the same email', () => {
    store.remember('alice@example.com', 'alice', 'https://alice.dev');

    expect(store.lookup('alice@example.com')).toEqual({
      userName: 'alice',
      homePage: 'https://alice.dev',
    });
  });

  it('normalizes email case and surrounding whitespace when looking up', () => {
    store.remember('bob@example.com', 'bob', null);

    expect(store.lookup('  Bob@Example.COM ')).toEqual({ userName: 'bob', homePage: null });
  });

  it('overwrites the previous entry for the same email without affecting other entries', () => {
    store.remember('alice@example.com', 'alice', 'https://alice.dev');
    store.remember('bob@example.com', 'bob', null);

    store.remember('alice@example.com', 'alice2', null);

    expect(store.lookup('alice@example.com')).toEqual({ userName: 'alice2', homePage: null });
    expect(store.lookup('bob@example.com')).toEqual({ userName: 'bob', homePage: null });
  });

  it('returns null instead of throwing when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(store.lookup('alice@example.com')).toBeNull();
  });

  it('does not throw when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => store.remember('alice@example.com', 'alice', null)).not.toThrow();
  });

  it('returns null when the stored value is corrupt JSON', () => {
    localStorage.setItem('commenthub.identities', '{not json');

    expect(store.lookup('alice@example.com')).toBeNull();
  });
});
