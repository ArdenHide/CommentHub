import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommentAvatar } from './comment-avatar.component';

describe('CommentAvatar', () => {
  let fixture: ComponentFixture<CommentAvatar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CommentAvatar] }).compileComponents();
    fixture = TestBed.createComponent(CommentAvatar);
  });

  function setInputs(seed: string, authorName: string, size?: number): void {
    fixture.componentRef.setInput('seed', seed);
    fixture.componentRef.setInput('authorName', authorName);
    if (size !== undefined) {
      fixture.componentRef.setInput('size', size);
    }
    fixture.detectChanges();
  }

  it('renders an svg identicon sized to the requested pixels', () => {
    setInputs('abc123', 'alice', 32);

    const svg: SVGElement | null = fixture.nativeElement.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('32');
    expect(svg?.getAttribute('height')).toBe('32');
  });

  it('renders the same icon markup for the same seed', () => {
    setInputs('same-seed', 'alice');
    const first = fixture.nativeElement.innerHTML;

    setInputs('same-seed', 'bob');
    const second = fixture.nativeElement.innerHTML;

    expect(first).toBe(second);
  });

  it('renders different icons for different seeds', () => {
    setInputs('seed-one', 'alice');
    const first = fixture.nativeElement.innerHTML;

    setInputs('seed-two', 'alice');
    const second = fixture.nativeElement.innerHTML;

    expect(first).not.toBe(second);
  });

  it('exposes an accessible label built from the author name', () => {
    setInputs('abc123', 'Carol');

    expect(fixture.nativeElement.getAttribute('aria-label')).toBe('Avatar of Carol');
    expect(fixture.nativeElement.getAttribute('role')).toBe('img');
  });
});
