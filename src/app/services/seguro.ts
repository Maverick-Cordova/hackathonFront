import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SeguroService {

  private http = inject(HttpClient);

  validar(data: any) {
    return this.http.post(
      'http://localhost:3000/validar',
      data
    );
  }
}