import { Injectable } from '@angular/core';

const STORAGE_KEY = 'commenthub.identities';

export interface CommentIdentity {
  userName: string;
  homePage: string | null;
}

@Injectable({ providedIn: 'root' })
export class CommentIdentityStore {
  lookup(email: string): CommentIdentity | null {
    const identities = this.readAll();
    return identities[this.normalize(email)] ?? null;
  }

  remember(email: string, userName: string, homePage: string | null): void {
    const identities = this.readAll();
    identities[this.normalize(email)] = { userName, homePage };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(identities));
    } catch {
      /* private mode, quota exceeded, etc. — remembering is a convenience, not a requirement */
    }
  }

  private readAll(): Record<string, CommentIdentity> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private normalize(email: string): string {
    return email.trim().toLowerCase();
  }
}
