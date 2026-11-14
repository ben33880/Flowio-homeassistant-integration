import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { loadInstallations, selectInstallation, type ConfigConnection, type Installation } from './integration-config';
export type InstallationHass = Partial<ConfigConnection> & { connection?: unknown };
export class InstallationController implements ReactiveController {
  value?: Installation;
  error = '';
  private active = false;
  private requested = false;
  private generation = 0;
  private connection?: unknown;
  constructor(private host: ReactiveControllerHost, private hass: () => InstallationHass | undefined) {
    host.addController(this);
  }
  hostConnected() {
    this.active = true;
    this.reset();
    this.host.requestUpdate();
  }
  hostDisconnected() { this.active = false; this.generation++; }
  private reset() {
    this.generation++;
    this.requested = false;
    this.value = undefined;
    this.error = '';
  }
  hostUpdated() {
    const hass = this.hass();
    if (!this.active || !hass) return;
    if (this.connection !== hass.connection) {
      this.connection = hass.connection;
      this.reset();
      this.host.requestUpdate();
    }
    if (this.requested) return;
    this.requested = true;
    if (typeof hass.callWS !== 'function') {
      this.error = 'Connexion WebSocket Home Assistant indisponible.';
      this.host.requestUpdate();
      return;
    }
    const token = ++this.generation;
    void loadInstallations({ callWS: message => hass.callWS!(message) }).then(items => {
      if (!this.active || token !== this.generation) return;
      this.value = selectInstallation(items);
      this.host.requestUpdate();
    }).catch(error => {
      if (!this.active || token !== this.generation) return;
      this.error = error instanceof Error ? error.message : 'Lecture des réglages Flow.io impossible.';
      this.host.requestUpdate();
    });
  }
}
