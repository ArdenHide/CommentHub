import { Component } from '@angular/core';
import { CommentsPage } from './comments-page/comments-page.component';

@Component({
  imports: [CommentsPage],
  selector: 'app-root',
  styleUrl: './app.component.scss',
  templateUrl: './app.component.html',
})
export class App {}
