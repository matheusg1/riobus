import { AfterViewInit, Component, OnInit } from '@angular/core';
import * as L from 'leaflet';
import { GpsService } from '../services/gps/gps.service';

@Component({
  selector: 'app-leaflet-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  standalone: true,
  imports: []
})

export class MapComponent implements AfterViewInit, OnInit {
  private map!: L.Map;
  //private map!: any;
  localizacoes: any[] = [];
  localizacoesFiltradas: any[] = [];

  constructor(private gpsService: GpsService) { }
  
  private initMap(): void {
    this.map = L.map('map').setView([-22.874935965701876, -43.24541996784035], 13); 

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

  }

  ngOnInit(): void {
    this.gpsService.getLocalizacoesOnibus(50).subscribe({
      next: (data) => {
        this.localizacoes = data;
        console.log('Posições recebidas:');
        console.log(this.localizacoes);
        this.localizacoesFiltradas = this.localizacoes.filter(p => p.linha.toUpperCase() === "397".toUpperCase())
        console.log(this.localizacoesFiltradas);
      },
      error: (err) => {
        console.error('Erro ao buscar dados de GPS:', err);
      }
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
    this.map.getSize();

    setTimeout(() => {
      this.map.invalidateSize();
    }, 100);
  }
}