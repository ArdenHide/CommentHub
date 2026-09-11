import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MdbRippleModule } from 'mdb-angular-ui-kit/ripple';

export interface CommentItem {
  id: number;
  authorName: string;
  authorInitials: string;
  avatarColor: string;
  text: string;
  createdAt: Date;
}

@Component({
  imports: [DatePipe, MdbRippleModule],
  selector: 'app-comments-page',
  styleUrl: './comments-page.component.scss',
  templateUrl: './comments-page.component.html',
})
export class CommentsPage {
  readonly comments: CommentItem[] = [
    {
      id: 1,
      authorName: 'Alice Johnson',
      authorInitials: 'AJ',
      avatarColor: '#3b71ca',
      text: 'This is a great article! Thanks for sharing your insights on Angular standalone components.',
      createdAt: new Date('2026-09-08T10:15:00'),
    },
    {
      id: 2,
      authorName: 'Mark Petrov',
      authorInitials: 'MP',
      avatarColor: '#14a44d',
      text: 'I have a question about the GraphQL integration mentioned in the second paragraph — could you elaborate?',
      createdAt: new Date('2026-09-09T14:32:00'),
    },
    {
      id: 3,
      authorName: 'Yuki Tanaka',
      authorInitials: 'YT',
      avatarColor: '#e4a11b',
      text: 'Nicely written and easy to follow. Looking forward to the next part of this series.',
      createdAt: new Date('2026-09-10T09:05:00'),
    },
  ];
}
