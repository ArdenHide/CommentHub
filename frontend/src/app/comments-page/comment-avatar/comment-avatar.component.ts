import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { toSvg } from 'jdenticon';

@Component({
  selector: 'app-comment-avatar',
  template: '',
  host: {
    role: 'img',
    '[attr.aria-label]': '"Avatar of " + authorName()',
    '[style.display]': '"inline-block"',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.borderRadius.%]': '50',
    '[style.overflow]': '"hidden"',
    '[innerHTML]': 'svg()',
  },
})
export class CommentAvatar {
  private readonly sanitizer = inject(DomSanitizer);

  readonly seed = input.required<string>();
  readonly authorName = input.required<string>();
  readonly size = input(40);

  readonly svg = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(toSvg(this.seed(), this.size())),
  );
}
