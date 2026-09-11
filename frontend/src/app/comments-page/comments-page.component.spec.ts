import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommentsPage } from './comments-page.component';

describe('CommentsPage', () => {
  let component: CommentsPage;
  let fixture: ComponentFixture<CommentsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommentsPage],
    }).compileComponents();

    fixture = TestBed.createComponent(CommentsPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
