import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { MdbModalService } from 'mdb-angular-ui-kit/modal';
import { App } from './app.component';
import { CommentsService } from './comments-page/comments.service';
import { CommentsRealtimeService } from './comments-page/comments-realtime.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        {
          provide: CommentsService,
          useValue: { getComments: () => of({ totalCount: 0, items: [] }) },
        },
        { provide: MdbModalService, useValue: { open: vi.fn() } },
        {
          provide: CommentsRealtimeService,
          useValue: { connect: vi.fn(), onCommentAdded: new Subject() },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the comments page', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Comments');
  });

  it('renders the site header above the comments page', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const children = Array.from(compiled.children);

    expect(children.findIndex((el) => el.tagName === 'APP-SITE-HEADER')).toBeLessThan(
      children.findIndex((el) => el.tagName === 'APP-COMMENTS-PAGE'),
    );
  });
});
