import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MdbModalService } from 'mdb-angular-ui-kit/modal';
import { CommentAttachment } from './comment-attachment.component';
import { AttachmentLightbox } from '../attachment-lightbox/attachment-lightbox.component';
import { CommentAttachmentDto } from '../graphql/get-comments.query';
import { environment } from '../../../environments/environment';

describe('CommentAttachment', () => {
  let fixture: ComponentFixture<CommentAttachment>;
  let modalService: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    modalService = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CommentAttachment],
      providers: [{ provide: MdbModalService, useValue: modalService }],
    }).compileComponents();

    fixture = TestBed.createComponent(CommentAttachment);
  });

  function imageAttachment(overrides: Partial<CommentAttachmentDto> = {}): CommentAttachmentDto {
    return {
      id: 1,
      kind: 'IMAGE',
      originalName: 'photo.png',
      contentType: 'image/png',
      sizeBytes: 2048,
      width: 200,
      height: 150,
      ...overrides,
    };
  }

  it('renders nothing when there is no attachment', () => {
    fixture.componentRef.setInput('attachment', null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.comment-attachment')).toBeNull();
  });

  it('renders an image thumbnail pointing at the permanent attachment URL', () => {
    fixture.componentRef.setInput('attachment', imageAttachment());
    fixture.detectChanges();

    const img: HTMLImageElement = fixture.nativeElement.querySelector('img.attachment-thumb');
    expect(img).not.toBeNull();
    expect(img.src).toBe(`${environment.apiBaseUrl}/attachments/1`);
    expect(img.alt).toBe('photo.png');
  });

  it('opens the lightbox with image data when the thumbnail is clicked', () => {
    fixture.componentRef.setInput('attachment', imageAttachment());
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.attachment-thumb-btn').click();

    expect(modalService.open).toHaveBeenCalledWith(
      AttachmentLightbox,
      expect.objectContaining({
        data: { url: `${environment.apiBaseUrl}/attachments/1`, kind: 'IMAGE', originalName: 'photo.png' },
      }),
    );
  });

  it('renders a file button with name and size for a text attachment', () => {
    fixture.componentRef.setInput(
      'attachment',
      imageAttachment({ kind: 'TEXT', originalName: 'notes.txt', sizeBytes: 1536, width: null, height: null }),
    );
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.attachment-file-btn');
    expect(button.textContent).toContain('notes.txt');
    expect(button.textContent).toContain('KB');
    expect(fixture.nativeElement.querySelector('img.attachment-thumb')).toBeNull();
  });

  it('opens the lightbox with text data when the file button is clicked', () => {
    fixture.componentRef.setInput(
      'attachment',
      imageAttachment({ id: 2, kind: 'TEXT', originalName: 'notes.txt', width: null, height: null }),
    );
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.attachment-file-btn').click();

    expect(modalService.open).toHaveBeenCalledWith(
      AttachmentLightbox,
      expect.objectContaining({
        data: { url: `${environment.apiBaseUrl}/attachments/2`, kind: 'TEXT', originalName: 'notes.txt' },
      }),
    );
  });
});
