import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { MdbModalRef } from 'mdb-angular-ui-kit/modal';
import { AttachmentLightbox } from './attachment-lightbox.component';

describe('AttachmentLightbox', () => {
  let fixture: ComponentFixture<AttachmentLightbox>;
  let component: AttachmentLightbox;
  let modalRef: { close: ReturnType<typeof vi.fn> };
  let http: { get: ReturnType<typeof vi.fn> };

  async function createComponent(): Promise<void> {
    modalRef = { close: vi.fn() };
    http = { get: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AttachmentLightbox],
      providers: [
        { provide: MdbModalRef, useValue: modalRef },
        { provide: HttpClient, useValue: http },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AttachmentLightbox);
    component = fixture.componentInstance;
  }

  it('renders the image directly without making an HTTP request', async () => {
    await createComponent();
    component.url = 'https://example.com/attachments/1';
    component.kind = 'IMAGE';
    component.originalName = 'photo.png';

    fixture.detectChanges();

    const img: HTMLImageElement = fixture.nativeElement.querySelector('.lightbox-image');
    expect(img.src).toBe('https://example.com/attachments/1');
    expect(http.get).not.toHaveBeenCalled();
  });

  it('fetches and renders text content as plain text, never as HTML', async () => {
    await createComponent();
    const maliciousContent = '<script>window.hacked = true;</script>';
    http.get.mockReturnValue(of(maliciousContent));

    component.url = 'https://example.com/attachments/2';
    component.kind = 'TEXT';
    component.originalName = 'notes.txt';

    fixture.detectChanges();

    expect(http.get).toHaveBeenCalledWith('https://example.com/attachments/2', { responseType: 'text' });
    const pre: HTMLPreElement = fixture.nativeElement.querySelector('.lightbox-text');
    expect(pre.textContent).toBe(maliciousContent);
    expect(fixture.nativeElement.querySelector('script')).toBeNull();
  });

  it('shows an error message when the text file fails to load', async () => {
    await createComponent();
    http.get.mockReturnValue(throwError(() => new Error('network')));

    component.url = 'https://example.com/attachments/3';
    component.kind = 'TEXT';
    component.originalName = 'notes.txt';

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.alert-danger')).not.toBeNull();
  });

  it('closes the modal when close() is called', async () => {
    await createComponent();
    component.kind = 'IMAGE';
    fixture.detectChanges();

    component.close();

    expect(modalRef.close).toHaveBeenCalled();
  });
});
