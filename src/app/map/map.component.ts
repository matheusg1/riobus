import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import * as L from 'leaflet';
import { GpsService } from '../services/gps/gps.service';
import { IonSearchbar } from '@ionic/angular/standalone';
import { Localizacao } from '../models/localizacao.model';
import { LoadingComponent } from '../loading/loading.component';
import { CommonModule } from '@angular/common';
import { interval, startWith, Subscription, switchMap } from 'rxjs';

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
  private ultimasAtualizacoes: Map<string, number> = new Map();


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

  constructor(private gpsService: GpsService) { }

  ngOnInit(): void {
    this.iniciarAtualizacaoPeriodica();
  }

  ngAfterViewInit(): void {
    this.inicializarMapa();
    this.mostrarLocalizacaoAtual()
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
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.mapa);

    this.mapa.attributionControl.setPrefix('');
    setTimeout(() => this.mapa.invalidateSize(), 200);
  }

   private iniciarAtualizacaoPeriodica(): void {
    this.assinaturaAtualizacao = interval(this.INTERVALO_ATUALIZACAO_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.gpsService.getLocalizacoesOnibus(30))
      )
      .subscribe({
        next: (dados) => {
          this.todasLocalizacoes = dados;
          this.isLoading = false;

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

  mostrarLocalizacaoAtual() {
    if (!this.mapa) return;

    this.mapa.locate();

    const baseRadius = 1000;
    let userCircle: L.Circle | null = null;

    const updateCircleRadius = () => {
      if (!userCircle) return;

      const zoom = this.mapa.getZoom();
      const dynamicRadius = baseRadius * Math.pow(2, (10 - zoom));
      userCircle.setRadius(dynamicRadius);
    };

    this.mapa.on('locationfound', (e: L.LocationEvent) => {
      if (userCircle) {
        this.mapa.removeLayer(userCircle);
      }

      userCircle = L.circle(e.latlng, {
        radius: baseRadius,
        color: 'white',
        fillColor: '#1052FC',
        fillOpacity: 1
      }).addTo(this.mapa);

      updateCircleRadius();
    });

    this.mapa.on('zoomend', () => {
      updateCircleRadius();
    });
  }

  onBuscarLinha(evento: any): void {
    const valorBusca = evento.detail.value?.trim();
    this.linhaBuscada = valorBusca || '';
    console.log('buscar linha ' + valorBusca)

    if (!this.linhaBuscada) {
      this.localizacoesFiltradas = [];
      this.removerTodosMarcadores();
      return;
    }

    this.localizacoesFiltradas = this.filtrarPorLinha(this.todasLocalizacoes, this.linhaBuscada);
    this.atualizarMarcadores(this.localizacoesFiltradas);
    this.mapa.zoomOut();
    console.log('qtd localizacoes filtradas ' + this.localizacoesFiltradas.length)
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

      const marcadorExistente = this.marcadores.get(ordem);

      if (marcadorExistente) {
        marcadorExistente.setLatLng(posicaoAtual);
        marcadorExistente.setPopupContent(this.gerarPopup(loc));
      } else {
        const marcador = L.marker(posicaoAtual, {
          icon: this.iconeOnibus,
        }).addTo(this.mapa).bindPopup(this.gerarPopup(loc));

        this.marcadores.set(ordem, marcador);
      }

      this.ultimasPosicoes.set(ordem, posicaoAtual);
      this.ultimasAtualizacoes.set(ordem, Date.now());

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
    const LIMITE_MS = 2 * 60 * 1000; // 2 minutos
    const agora = Date.now();

    this.marcadores.forEach((marcador, ordem) => {
      const ultimaAtualizacao = this.ultimasAtualizacoes.get(ordem);

      if (!ultimaAtualizacao || (agora - ultimaAtualizacao > LIMITE_MS)) {
        this.mapa.removeLayer(marcador);
        this.marcadores.delete(ordem);
        this.ultimasPosicoes.delete(ordem);
        this.ultimasAtualizacoes.delete(ordem);
      }
    });
  }

  private removerTodosMarcadores(): void {
    this.marcadores.forEach((marcador) => {
      this.mapa.removeLayer(marcador);
    });
    this.marcadores.clear();
    this.ultimasPosicoes.clear();
  }

  private gerarPopup(loc: Localizacao): string {
    return `<div>
        <strong>Número:</strong> ${loc.ordem}<br>
        <strong>Linha:</strong> ${loc.linha}<br>
        <strong>Velocidade:</strong> ${loc.velocidade} km/h<br>
      </div>`
      ;
  }
}