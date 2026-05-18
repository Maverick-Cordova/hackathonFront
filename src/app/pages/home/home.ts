import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { SeguroService } from '../../services/seguro';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-home',
  imports: [CommonModule, FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  cedula = '';
  archivo!: File;
  nombreArchivo = '';
  tamanoArchivo = '';
  loading = false;
  resultado: any = null;
  mostrarModal = false;

  // Sistema de notificaciones e impresiones clínicas premium
  mensajeError: string | null = null;
  tipoError: 'warning' | 'error' | 'success' | null = null;
  private errorTimeout: any;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  mostrarError(mensaje: string, tipo: 'warning' | 'error' | 'success' = 'error') {
    this.mensajeError = mensaje;
    this.tipoError = tipo;
    this.cdr.detectChanges();

    // Limpieza automática tras 7 segundos
    if (this.errorTimeout) {
      clearTimeout(this.errorTimeout);
    }
    this.errorTimeout = setTimeout(() => {
      this.limpiarError();
    }, 7000);
  }

  limpiarError() {
    this.mensajeError = null;
    this.tipoError = null;
    this.cdr.detectChanges();
  }

  seleccionarArchivo(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      this.limpiarError();
      this.archivo = file;
      this.nombreArchivo = file.name;
      this.tamanoArchivo = this.formatearTamano(file.size);
      this.cdr.detectChanges(); // Forzar actualización visual inmediata
    }
  }

  formatearTamano(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  removerArchivo(fileInput: HTMLInputElement) {
    this.archivo = null as any;
    this.nombreArchivo = '';
    this.tamanoArchivo = '';
    if (fileInput) {
      fileInput.value = '';
    }
    this.limpiarError();
    this.cdr.detectChanges(); // Forzar actualización visual inmediata
  }

  enviar() {
    this.limpiarError();

    if (!this.archivo) {
      this.mostrarError('Por favor, seleccione el informe médico en PDF.', 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('cedula', this.cedula ? this.cedula.trim() : '');
    formData.append('archivo', this.archivo);

    this.loading = true;
    this.resultado = null; // Limpiar resultado previo
    this.cdr.detectChanges(); // Mostrar spinner inmediatamente

    console.log('[SeguroIA] Enviando petición de pre-autorización al servidor...');

    this.http.post('http://localhost:3000/preautorizacion', formData)
    .subscribe({
      next: (response: any) => {
        console.log('[SeguroIA] Respuesta HTTP 200 recibida del servidor:', response);
        
        // 1. Detener el spinner de inmediato
        this.loading = false;
        
        // 2. Determinar el mensaje del banner de inmediato para dar feedback instantáneo
        let mensajeFriendly = '';
        let tipoAlerta: 'success' | 'error' = 'success';
        
        if (response.aprobado) {
          mensajeFriendly = `¡Pre-Autorización Quirúrgica APROBADA! Especialidad: ${response.especialidad}. ${response.motivo}.`;
          tipoAlerta = 'success';
        } else {
          mensajeFriendly = `Pre-Autorización RECHAZADA. Especialidad: ${response.especialidad || 'No identificada'}. Motivo: ${response.motivo}.`;
          tipoAlerta = 'error';
        }
        
        this.mensajeError = mensajeFriendly;
        this.tipoError = tipoAlerta;
        this.cdr.detectChanges(); // Detiene el spinner y pinta el banner verde/rojo al exacto milisegundo de red!
        
        // 3. Deferir renderizado del modal e informes completos al siguiente tick para máxima suavidad
        setTimeout(() => {
          try {
            this.resultado = response;
            if (response.paciente && response.paciente.cedula) {
              this.cedula = response.paciente.cedula;
            }
            this.mostrarModal = true; // Mostrar la ventana emergente de resultado
            this.cdr.detectChanges(); // Forzar renderizado del modal e informes
          } catch (renderError) {
            console.error('[SeguroIA] Error de renderizado en el template:', renderError);
          }
        }, 0);
      },
      error: (error) => {
        console.error('[SeguroIA] Error capturado en el flujo HTTP del frontend:', error);
        
        // 1. Detener el spinner e invocar repaint de inmediato
        this.loading = false;
        this.cdr.detectChanges(); // Detiene el spinner de carga al exacto milisegundo de red

        // Auto-completar cédula si el backend logró extraerla del PDF pero el afiliado no está registrado
        if (error?.error?.cedula) {
          this.cedula = error.error.cedula;
        }
        
        let mensajeFriendly = 'No se pudo conectar con el motor de Inteligencia SeguroIA. Por favor, asegúrese de que el backend esté ejecutándose.';
        
        if (error.status === 404) {
          if (error.error?.cedula) {
            mensajeFriendly = `El paciente con cédula ${error.error.cedula} detectada en el PDF no se encuentra registrado en Notion.`;
          } else {
            mensajeFriendly = 'La cédula ingresada no se encuentra registrada en la base de datos de afiliados. Por favor, verifique el número e intente de nuevo.';
          }
        } else if (error.status === 400) {
          if (error?.error?.error) {
            mensajeFriendly = error.error.error;
          } else {
            mensajeFriendly = 'El informe médico enviado no es válido o está corrupto. Suba un PDF legible.';
          }
        } else if (error?.error?.error) {
          const apiError = error.error.error;
          if (apiError.includes('Paciente no encontrado')) {
            mensajeFriendly = 'La cédula de identidad ingresada no pertenece a ningún paciente registrado en el sistema.';
          } else {
            mensajeFriendly = apiError;
          }
        } else if (error?.message) {
          mensajeFriendly = `Error de conexión: ${error.message}`;
        }
        
        // 2. Deferir renderizado del error al siguiente tick
        setTimeout(() => {
          this.mensajeError = mensajeFriendly;
          this.tipoError = 'error';
          this.cdr.detectChanges(); // Barrido reactivo instantáneo
          
          // Configurar la auto-limpieza
          if (this.errorTimeout) {
            clearTimeout(this.errorTimeout);
          }
          this.errorTimeout = setTimeout(() => {
            this.limpiarError();
          }, 7000);
        }, 0);
      }
    });
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.cdr.detectChanges();
  }
}