import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SeguroService {

  private http = inject(HttpClient);

  validar(data: any) {
    return this.http.post(
      'https://hackathon-1eel.onrender.com/validar',
      data
    );
  }
}