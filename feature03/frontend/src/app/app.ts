import { Component } from '@angular/core';
import { ChatStreamComponent } from './ia/chat-stream/chat-stream.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ChatStreamComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
