import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { MapComponent } from '../map/map.component';
import { IonHeader } from "@ionic/angular/standalone";
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    MapComponent,
    CommonModule,
    FormsModule,
    IonicModule,    
  ]
})
export class HomePage {

  constructor() {
  }


}
