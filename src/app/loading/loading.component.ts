import { CommonModule } from '@angular/common';
import { Component  } from '@angular/core';

@Component({
  selector: 'app-loading',
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class LoadingComponent {
}
