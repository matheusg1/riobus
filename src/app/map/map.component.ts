import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import * as L from 'leaflet';
import 'leaflet-rotatedmarker';
import { GpsService } from '../services/gps/gps.service';
import { IonSearchbar } from '@ionic/angular/standalone';
import { Localizacao } from '../models/localizacao.model';
import { LoadingComponent } from '../loading/loading.component';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';

// Tipagens adicionais para o plugin leaflet-rotatedmarker
declare module 'leaflet' {
  interface MarkerOptions {
    rotationAngle?: number;
    rotationOrigin?: string;
  }

  interface Marker {
    setRotationAngle(angle: number): this;
    setRotationOrigin(origin: string): this;
  }
}

@Component({
  selector: 'app-leaflet-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  standalone: true,
  imports: [IonSearchbar, LoadingComponent, CommonModule]
})
export class MapComponent implements AfterViewInit, OnInit, OnDestroy {
  private mapa!: L.Map;
  private marcadores: Map<string, L.Marker> = new Map();
  private ultimasPosicoes: Map<string, L.LatLng> = new Map();

  private todasLocalizacoes: Localizacao[] = [];
  private localizacoesFiltradas: Localizacao[] = [];
  private assinaturaAtualizacao!: Subscription;

  readonly INTERVALO_ATUALIZACAO_MS = 10000;
  readonly CENTRO_PADRAO = L.latLng(-22.874935965701876, -43.24541996784035);
  readonly ZOOM_PADRAO = 13;
  readonly URL_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  isLoading = true;
  linhaBuscada: string = '';

  private readonly iconeOnibus = L.icon({
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Icon-mode-bus-default.svg/1024px-Icon-mode-bus-default.svg.png',
    iconSize: [38, 38],
    popupAnchor: [0, -10]
  });
  private criarIconeGota(): L.DivIcon {
    const svg = `
        <svg width="40px" height="40px" viewBox="0 0 16 16" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="#FFC828">
        <rect width="16" height="16" id="icon-bound" fill="none"></rect>
        <path d="M8,0C4.688,0,2,2.688,2,6c0,6,6,10,6,10s6-4,6-10C14,2.688,11.312,0,8,0z M8,8C6.344,8,5,6.656,5,5s1.344-3,3-3s3,1.344,3,3 S9.656,8,8,8z"></path>
      </svg>
    `;

    return L.divIcon({
      className: '',
      html: svg,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20]
    });
  }


  constructor(private gpsService: GpsService) { }

  ngOnInit(): void {
    this.iniciarAtualizacaoPeriodica();
  }

  ngAfterViewInit(): void {
    this.inicializarMapa();
  }

  ngOnDestroy(): void {
    this.assinaturaAtualizacao?.unsubscribe();
  }

  private inicializarMapa(): void {
    this.mapa = L.map('map', {
      zoomControl: false
    }).setView(this.CENTRO_PADRAO, this.ZOOM_PADRAO);

    L.tileLayer(this.URL_TILES, {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.mapa);

    setTimeout(() => this.mapa.invalidateSize(), 200);
  }

  private iniciarAtualizacaoPeriodica(): void {
    this.buscarLocalizacoes();

    this.assinaturaAtualizacao = interval(this.INTERVALO_ATUALIZACAO_MS).subscribe(() => {
      this.buscarLocalizacoes();
    });
  }

  private buscarLocalizacoes(): void {
    this.gpsService.getLocalizacoesOnibus(50).subscribe({
      next: (dados) => {
        this.todasLocalizacoes = dados;
        this.isLoading = false;
        console.log('Localizações atualizadas:', dados);

        if (this.linhaBuscada) {
          this.localizacoesFiltradas = this.filtrarPorLinha(this.todasLocalizacoes, this.linhaBuscada);
          this.atualizarMarcadores(this.localizacoesFiltradas);
        }
      },
      error: (erro) => {
        console.error('Erro ao buscar dados de GPS:', erro);
      }
    });
  }

  onBuscarLinha(evento: any): void {
    const valorBusca = evento.detail.value?.trim();
    this.linhaBuscada = valorBusca || '';

    if (!this.linhaBuscada) {
      this.localizacoesFiltradas = [];
      this.removerTodosMarcadores();
      return;
    }

    this.localizacoesFiltradas = this.filtrarPorLinha(this.todasLocalizacoes, this.linhaBuscada);
    this.atualizarMarcadores(this.localizacoesFiltradas);
    this.mapa.setZoom(12);
  }

  onLimparBusca() {
    this.limparTodosMarcadores();
  }

  private filtrarPorLinha(localizacoes: Localizacao[], linha: string): Localizacao[] {
    const filtradas = localizacoes.filter(loc => loc.linha.toUpperCase() === linha.toUpperCase());
    const ordenadas = filtradas.sort((a, b) => Number(b.datahora) - Number(a.datahora));

    return ordenadas.filter(
      (loc, index, self) => index === self.findIndex(outro => outro.ordem === loc.ordem)
    );
  }

  private atualizarMarcadores(localizacoes: Localizacao[]): void {
    const ordensAtuais = new Set<string>();

    localizacoes.forEach(loc => {
      const ordem = loc.ordem;
      const lat = parseFloat(loc.latitude.replace(',', '.'));
      const lng = parseFloat(loc.longitude.replace(',', '.'));
      const posicaoAtual = L.latLng(lat, lng);

      ordensAtuais.add(ordem);

      const direcao = this.calcularDirecao(ordem, posicaoAtual);

      const marcadorExistente = this.marcadores.get(ordem);

      if (marcadorExistente) {
        marcadorExistente.setLatLng(posicaoAtual);
        marcadorExistente.setPopupContent(this.gerarPopup(loc));
        marcadorExistente.setRotationAngle(direcao);
      } else {
        const marcador = L.marker(posicaoAtual, {
          icon: this.criarIconeGota(),
          rotationAngle: direcao,
          rotationOrigin: 'center center'
        }).addTo(this.mapa).bindPopup(this.gerarPopup(loc));

        this.marcadores.set(ordem, marcador);
      }

      this.ultimasPosicoes.set(ordem, posicaoAtual);
    });

    this.removerMarcadoresAntigos(ordensAtuais);
  }

  private limparTodosMarcadores(): void {
    this.marcadores.forEach(marcador => {
      this.mapa.removeLayer(marcador);
    });
    this.marcadores.clear();
    this.localizacoesFiltradas = [];
  }

  private removerMarcadoresAntigos(ordensAtuais: Set<string>): void {
    this.marcadores.forEach((marcador, ordem) => {
      if (!ordensAtuais.has(ordem)) {
        this.mapa.removeLayer(marcador);
        this.marcadores.delete(ordem);
        this.ultimasPosicoes.delete(ordem);
      }
    });
  }

  private calcularDirecao(ordem: string, posicaoAtual: L.LatLng): number {
    const posicaoAnterior = this.ultimasPosicoes.get(ordem);

    if (!posicaoAnterior) return 0;

    const deltaX = posicaoAtual.lng - posicaoAnterior.lng;
    const deltaY = posicaoAtual.lat - posicaoAnterior.lat;
    const anguloRad = Math.atan2(deltaX, deltaY);
    const anguloGraus = (anguloRad * 180) / Math.PI;

    return (anguloGraus + 360) % 360; // normaliza para 0–360
  }

  private removerTodosMarcadores(): void {
    this.marcadores.forEach((marcador) => {
      this.mapa.removeLayer(marcador);
    });
    this.marcadores.clear();
    this.ultimasPosicoes.clear();
  }

  private gerarPopup(loc: Localizacao): string {
    return `
      <div>
        <strong>Número:</strong> ${loc.ordem}<br>
        <strong>Linha:</strong> ${loc.linha}<br>
        <strong>Velocidade:</strong> ${loc.velocidade} km/h<br>
      </div>
    `;
  }

  private formatarData(timestamp: string | number): string {
    return new Date(Number(timestamp)).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }
}
