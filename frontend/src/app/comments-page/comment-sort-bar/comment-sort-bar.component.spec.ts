import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommentSortBar } from './comment-sort-bar.component';

describe('CommentSortBar', () => {
  let fixture: ComponentFixture<CommentSortBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CommentSortBar] }).compileComponents();
    fixture = TestBed.createComponent(CommentSortBar);
  });

  function setInputs(sortBy: 'CREATED_AT' | 'USER_NAME' | 'EMAIL', descending: boolean): void {
    fixture.componentRef.setInput('sortBy', sortBy);
    fixture.componentRef.setInput('descending', descending);
    fixture.detectChanges();
  }

  it('renders the three sort field options', () => {
    setInputs('CREATED_AT', true);

    const optionLabels = Array.from(
      fixture.nativeElement.querySelectorAll('option') as NodeListOf<HTMLOptionElement>,
    ).map((option) => option.textContent?.trim());

    expect(optionLabels).toEqual(['Date added', 'User name', 'E-mail']);
  });

  it('reflects the selected sort field in the select value', () => {
    setInputs('USER_NAME', true);

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    expect(select.value).toBe('USER_NAME');
  });

  it('emits sortByChange when a different option is selected', () => {
    setInputs('CREATED_AT', true);
    const emitted: string[] = [];
    fixture.componentInstance.sortByChange.subscribe((value) => emitted.push(value));

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    select.value = 'EMAIL';
    select.dispatchEvent(new Event('change'));

    expect(emitted).toEqual(['EMAIL']);
  });

  it('emits the flipped direction and shows the descending icon/label', () => {
    setInputs('CREATED_AT', true);
    const emitted: boolean[] = [];
    fixture.componentInstance.descendingChange.subscribe((value) => emitted.push(value));

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.getAttribute('aria-label')).toBe('Sort descending');
    expect(button.querySelector('i')?.classList.contains('fa-arrow-down-wide-short')).toBe(true);

    button.click();

    expect(emitted).toEqual([false]);
  });

  it('shows the ascending icon/label when descending is false', () => {
    setInputs('CREATED_AT', false);

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.getAttribute('aria-label')).toBe('Sort ascending');
    expect(button.querySelector('i')?.classList.contains('fa-arrow-up-wide-short')).toBe(true);
  });
});
