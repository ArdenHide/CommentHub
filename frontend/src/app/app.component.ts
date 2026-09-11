import { Component } from '@angular/core';
import { CommentsPage } from './comments-page/comments-page.component';
import { SiteHeader } from './site-header/site-header.component';

@Component({
  imports: [SiteHeader, CommentsPage],
  selector: 'app-root',
  styleUrl: './app.component.scss',
  templateUrl: './app.component.html',
})
export class App {}
