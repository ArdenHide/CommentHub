import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MdbModalService } from 'mdb-angular-ui-kit/modal';
import { SiteHeader } from './site-header.component';
import { CommentFormComponent } from '../comments-page/comment-form/comment-form.component';
import { CommentNode } from '../comments-page/comment-node.mapper';

function makeNode(id: number): CommentNode {
  return {
    id,
    authorName: 'alice',
    avatarSeed: 'seed',
    textHtml: '<p>hi</p>',
    createdAt: '2026-09-11T10:00:00Z',
    attachment: null,
    replies: [],
    repliesTotalCount: 0,
    repliesKnown: true,
  };
}

describe('SiteHeader', () => {
  let component: SiteHeader;
  let fixture: ComponentFixture<SiteHeader>;
  let modalService: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    modalService = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SiteHeader],
      providers: [{ provide: MdbModalService, useValue: modalService }],
    }).compileComponents();

    fixture = TestBed.createComponent(SiteHeader);
    component = fixture.componentInstance;
  });

  it('renders a "New comment" button', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('New comment');
  });

  it('opens the comment form modal with no parent when clicked', () => {
    modalService.open.mockReturnValue({ onClose: of(undefined) });
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();

    expect(modalService.open).toHaveBeenCalledWith(
      CommentFormComponent,
      expect.objectContaining({ data: { parentId: null, parentAuthorName: null } }),
    );
  });

  it('emits commentPosted when the modal closes with a new comment', () => {
    const newNode = makeNode(1);
    modalService.open.mockReturnValue({ onClose: of(newNode) });
    fixture.detectChanges();

    const emitted: CommentNode[] = [];
    component.commentPosted.subscribe((node) => emitted.push(node));

    fixture.nativeElement.querySelector('button').click();

    expect(emitted).toEqual([newNode]);
  });

  it('does not emit commentPosted when the modal is cancelled', () => {
    modalService.open.mockReturnValue({ onClose: of(undefined) });
    fixture.detectChanges();

    const emitted: CommentNode[] = [];
    component.commentPosted.subscribe((node) => emitted.push(node));

    fixture.nativeElement.querySelector('button').click();

    expect(emitted).toEqual([]);
  });
});
