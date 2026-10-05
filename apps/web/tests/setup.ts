class LocalStorageMock {
  private store: Record<string, string> = {};

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    if (key in this.store) {
      return this.store[key];
    }
    return null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }
}

globalThis.localStorage ??= new LocalStorageMock() as unknown as Storage;

const classListSet = new Set<string>();
const mockDoc = {
  head: {
    appendChild: () => {},
    removeChild: () => {},
  },
  body: {
    appendChild: () => {},
    removeChild: () => {},
  },
  createTextNode: (text: string) => ({ textContent: text }),
  createElement: () => ({
    setAttribute: () => {},
    textContent: '',
    style: {},
    appendChild: () => {},
  }),
  getElementsByTagName: () => [
    {
      appendChild: () => {},
      removeChild: () => {},
    },
  ],
  documentElement: {
    classList: {
      add: (cls: string) => classListSet.add(cls),
      remove: (cls: string) => classListSet.delete(cls),
      contains: (cls: string) => classListSet.has(cls),
    },
  },
};

globalThis.document ??= mockDoc as unknown as Document;

// @ts-expect-error define React act environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
