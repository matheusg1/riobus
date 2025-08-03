import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, tap, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GpsService {

  private readonly apiUrlOnibus = 'https://dados.mobilidade.rio/gps/sppo';

  constructor(private http: HttpClient) { }

  getLocalizacoesOnibus(segundosAtras: number): Observable<any> {
    const agora = new Date();
    const dataInicial = new Date(agora.getTime() - segundosAtras * 1000);

    const formatar = (data: Date): string => {
      const pad = (n: number) => (n < 10 ? `0${n}` : n);
      return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}+${pad(data.getHours())}:${pad(data.getMinutes())}:${pad(data.getSeconds())}`;
    };

    const url = `${this.apiUrlOnibus}?dataInicial=${formatar(dataInicial)}&dataFinal=${formatar(agora)}`;
    console.log('getLocalizacoesOnibus chamado', url);

    return this.http.get(url).pipe(
      tap((resposta) => {
        console.log('Localizações de ônibus recebidas com sucesso:', resposta);
      }),
      catchError((error) => {
        console.error('Erro ao buscar localizações de ônibus:', error);
        return throwError(() => error);
      }),
    );
  }


  getLocalizacoesBrt() {

  }
}
