# Web Events SDK

Este SDK permite registrar eventos de navegación dentro del sitio web y ponerlos a disposición del asistente conversacional. Su objetivo es mejorar la experiencia del chat brindándole más contexto sobre las acciones previas del usuario.

El uso del SDK es **opcional**: el chat funciona correctamente aun sin esta información, aunque la experiencia será más fluida cuando el agente pueda interpretar eventos de la navegación.

---

## ✅ Características principales
- Registro de eventos relevantes en la navegación (p. ej.: selección de plan, inicio de checkout, pago rechazado).
- API sencilla: `track()` para registrar y `getEvents()` para obtener eventos.
- Almacenamiento configurable en memoria, `sessionStorage` o `localStorage`.
- Compatible con React mediante `WebEventsProvider` y `useWebEvents()`.
- Bridge opcional para exponer los eventos al widget del chat vía `window.ChatEvents.getEvents()`.
- Funciona sin dependencias externas.

---

## 📦 Instalación
Copiar el archivo `web-events-sdk.ts` dentro del proyecto.

Funciona tanto en TypeScript como en JavaScript.

---

## 🚀 Uso básico (JavaScript / TypeScript)
```ts
import { createWebEventsSDK, attachChatBridge } from "./web-events-sdk";

const sdk = createWebEventsSDK({ storage: "session", maxEvents: 100 });
attachChatBridge(sdk);

sdk.track("checkout_started", "El usuario inició el proceso de compra");

console.log(sdk.getEvents());
```

---

## ⚛️ Uso en React
### 1. Configurar el Provider
```tsx
import { WebEventsProvider, createWebEventsSDK, attachChatBridge } from "./web-events-sdk";

const sdk = createWebEventsSDK({ storage: "session" });
attachChatBridge(sdk);

function AppRoot() {
  return (
    <WebEventsProvider sdk={sdk}>
      <App />
    </WebEventsProvider>
  );
}
```

### 2. Registrar eventos
g
```tsx
import { useWebEvents } from "./web-events-sdk";

function Checkout() {
  const { track } = useWebEvents();

  const onPaymentRejected = (reason) => {
    track("checkout_payment_failed", "Pago rechazado", { reason });
  };
}
```

### 3. Integración con el widget de chat
```js
const events = window.ChatEvents?.getEvents() || [];
const last = events[events.length - 1];

if (last?.name === "checkout_payment_failed") {
  openChatWithMessage(
    "Vemos que tu pago fue rechazado. ¿Querés que te guíe para reintentarlo?"
  );
}
```

---

## 🧠 Cómo funciona
Cada evento registrado incluye:
- nombre del evento
- nota descriptiva
- metadatos opcionales
- timestamp
- pathname, título de página y referrer
- tamaño de viewport
- sessionId y pageId

El chat puede usar esta información para:
- Entender mejor el estado actual del usuario.
- Ser proactivo ante eventos críticos.
- Reducir preguntas repetitivas.

---

## 🔧 API Completa
### `createWebEventsSDK(options)`
Crea una nueva instancia del SDK.

**Opciones:**
- `storage`: "memory" | "session" | "local"
- `storageKey`: clave de almacenamiento
- `maxEvents`: máximo de eventos a retener

### `sdk.track(name, note?, metadata?)`
Registra un evento.

### `sdk.getEvents()`
Retorna una lista de eventos.

### `sdk.clear()`
Elimina todos los eventos.

### `sdk.subscribe(listener)`
Permite reaccionar cuando cambian los eventos.

---

## ⚛️ API de React
### `<WebEventsProvider>`
Contexto global para el SDK.

### `useWebEvents()`
Expose:
- `events`
- `track`
- `getEvents`
- `clear`

---

## 🌐 Bridge para el chat
`attachChatBridge(sdk)` expone:

```js
window.ChatEvents.getEvents()
```

Esto permite que el widget del chat lea los eventos recientes.

---

## ✅ Recomendaciones
- Registrar solo eventos relevantes para el proceso de compra.
- No almacenar datos sensibles del usuario.
- Usar un límite razonable en `maxEvents`.
- Exponer únicamente los eventos recientes al agente.

---

## 📝 Licencia
Uso interno para el proyecto de SportClub.

---
