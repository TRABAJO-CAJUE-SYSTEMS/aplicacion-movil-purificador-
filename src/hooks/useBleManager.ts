import { useEffect, useRef, useState, useCallback } from 'react';
import { BleManager, Device } from 'react-native-ble-plx';
import { Alert, Linking, Platform, PermissionsAndroid } from 'react-native';
import { Buffer } from 'buffer';

// ── UUIDs del ESP32 ───────────────────────────────────────
export const SERVICE_UUID    = '12345678-1234-1234-1234-123456789abc';
export const CHAR_WRITE_UUID = 'abcd1234-ab12-ab12-ab12-abcdef012345';
export const CHAR_READ_UUID  = 'abcd5678-ab12-ab12-ab12-abcdef012345';
export const DEVICE_NAME     = 'PurificadorIA';

export interface ScannedDevice {
  id:   string;
  name: string;
  rssi: number;
}

export interface BleResponse {
  status:       'ok' | 'error';
  reiniciando?: boolean;
  msg?:         string;
}

async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const api = Platform.Version as number;

  if (api >= 31) {
    // Android 12+ — necesita BLUETOOTH_SCAN + BLUETOOTH_CONNECT
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    const scan    = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN];
    const connect = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT];
    return (
      scan    === PermissionsAndroid.RESULTS.GRANTED &&
      connect === PermissionsAndroid.RESULTS.GRANTED
    );
  }

  // Android < 12 — solo necesita ubicación
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title:           'Permiso de ubicación',
      message:         'Necesario para buscar dispositivos Bluetooth cercanos.',
      buttonPositive:  'Permitir',
      buttonNegative:  'Cancelar',
    }
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

// Abre el diálogo del sistema para activar Bluetooth
function requestEnableBluetooth(): Promise<void> {
  return new Promise((resolve) => {
    Alert.alert(
      'Bluetooth desactivado',
      'Activa el Bluetooth para buscar dispositivos cercanos.',
      [
        {
          text: 'Abrir ajustes Bluetooth',
          onPress: () => {
            Linking.sendIntent('android.bluetooth.adapter.action.REQUEST_ENABLE')
              .catch(() => Linking.openSettings());
            resolve();
          },
        },
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve() },
      ]
    );
  });
}

export function useBleManager() {
  const managerRef         = useRef<BleManager | null>(null);
  const connectedDeviceRef = useRef<Device | null>(null);
  const scanTimeoutRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [devices,    setDevices]    = useState<ScannedDevice[]>([]);
  const [scanning,   setScanning]   = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected,  setConnected]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // ── Singleton manager — siempre fresco ───────────────────
  const getManager = useCallback((): BleManager => {
    if (!managerRef.current) {
      managerRef.current = new BleManager();
    }
    return managerRef.current;
  }, []);

  // ── Detener escaneo ───────────────────────────────────────
  const stopScan = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    managerRef.current?.stopDeviceScan();
    setScanning(false);
  }, []);

  // ── Cleanup al desmontar ──────────────────────────────────
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      managerRef.current?.stopDeviceScan();
      connectedDeviceRef.current?.cancelConnection().catch(() => {});
      managerRef.current?.destroy();
      managerRef.current = null;
    };
  }, []);

  // ── Escanear dispositivos BLE ─────────────────────────────
  const startScan = useCallback(async () => {
    setError(null);
    setDevices([]);
    setScanning(true);

    // 1. Permisos Android
    if (Platform.OS === 'android') {
      const granted = await requestBlePermissions();
      if (!granted) {
        setError('Permisos de Bluetooth denegados.\nVe a Ajustes > Aplicaciones > airpure-app > Permisos y activa Bluetooth y Ubicación.');
        setScanning(false);
        return;
      }
    }

    // 2. Siempre recrear el manager para evitar estado corrupto
    if (managerRef.current) {
      managerRef.current.stopDeviceScan();
      managerRef.current.destroy();
      managerRef.current = null;
    }
    const mgr = getManager();

    // Lee estado actual del BT (emitCurrentValue: true para no perder transiciones)
    const readState = (): Promise<string> =>
      new Promise((resolve) => {
        const sub = mgr.onStateChange((s) => { sub.remove(); resolve(s); }, true);
      });

    try {
      let state = await readState();

      if (state === 'Unsupported') {
        throw new Error('Este dispositivo no soporta Bluetooth Low Energy.');
      }
      if (state === 'Unauthorized') {
        throw new Error('Sin autorización para Bluetooth. Ve a Ajustes y activa los permisos de la app.');
      }

      // 3. Si BT apagado → abrir diálogo del sistema (no llamar mgr.enable())
      if (state === 'PoweredOff') {
        if (Platform.OS === 'android') {
          await requestEnableBluetooth();
        } else {
          throw new Error('Bluetooth desactivado. Ve a Ajustes → Bluetooth y actívalo.');
        }
      }

      // 4. Esperar hasta 30s a que BT se active
      if (state !== 'PoweredOn') {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            stateSub.remove();
            reject(new Error('Bluetooth no se activó en 30 segundos.\nActívalo manualmente y vuelve a intentar.'));
          }, 30000);
          const stateSub = mgr.onStateChange((s) => {
            if (s === 'PoweredOn') {
              clearTimeout(timer);
              stateSub.remove();
              resolve();
            } else if (s === 'Unsupported' || s === 'Unauthorized') {
              clearTimeout(timer);
              stateSub.remove();
              reject(new Error('Bluetooth no disponible en este dispositivo.'));
            }
          }, true);
        });
      }

      // 5. Escanear TODOS los dispositivos BLE (incluye sin nombre)
      mgr.startDeviceScan(
        null,                      // sin filtro de servicios
        { allowDuplicates: false },
        (err, device) => {
          if (err) {
            // Error 102 = BT apagado durante escaneo — ignorar silenciosamente
            if ((err as any).errorCode !== 102) {
              setError(err.message);
            }
            setScanning(false);
            return;
          }
          if (!device) return;

          const name = device.name ?? device.localName ?? `[${device.id.slice(-5)}]`;

          setDevices((prev) => {
            const entry: ScannedDevice = {
              id:   device.id,
              name,
              rssi: device.rssi ?? -100,
            };
            const exists = prev.find((d) => d.id === device.id);
            if (exists) return prev.map((d) => d.id === device.id ? entry : d);
            return [...prev, entry];
          });
        }
      );

      // Parar después de 20 segundos
      scanTimeoutRef.current = setTimeout(stopScan, 20000);

    } catch (e: any) {
      setError(e.message);
      setScanning(false);
    }
  }, [getManager, stopScan]);

  // ── Conectar al dispositivo ───────────────────────────────
  const connect = useCallback(async (deviceId: string): Promise<Device | null> => {
    stopScan();
    setConnecting(true);
    setError(null);

    try {
      const mgr    = getManager();
      const device = await mgr.connectToDevice(deviceId, { timeout: 10000 });
      await device.discoverAllServicesAndCharacteristics();
      // No pedimos MTU — CHUNK=20 es seguro con el MTU por defecto (23 bytes).
      // requestMTU() puede desestabilizar la conexión en ciertos teléfonos Android.

      connectedDeviceRef.current = device;
      setConnected(true);
      setConnecting(false);
      return device;
    } catch (e: any) {
      setError(`Error al conectar: ${e.message}`);
      setConnecting(false);
      return null;
    }
  }, [stopScan, getManager]);

  // ── Enviar JSON al ESP32 por BLE ──────────────────────────
  const sendConfig = useCallback(async (payload: object): Promise<BleResponse> => {
    const device = connectedDeviceRef.current;
    if (!device) throw new Error('Sin dispositivo conectado');

    const jsonStr = JSON.stringify(payload);
    const bytes   = Buffer.from(jsonStr, 'utf-8');
    const CHUNK   = 20;   // seguro con MTU por defecto (23 bytes)

    // Esperar a que la conexión BLE se estabilice antes de enviar datos
    await new Promise(r => setTimeout(r, 500));

    // Preparar todos los chunks; añadir '\n' al último para que el Arduino lo detecte
    const allChunks: Buffer[] = [];
    for (let i = 0; i < bytes.length; i += CHUNK) {
      allChunks.push(bytes.slice(i, i + CHUNK));
    }
    allChunks[allChunks.length - 1] = Buffer.concat([
      allChunks[allChunks.length - 1],
      Buffer.from('\n'),
    ]);

    // Usar writeWithoutResponse (WRITE_NR): no requiere ACK, es más estable
    // para envío masivo de chunks y evita timeouts de escritura GATT
    for (const chunk of allChunks) {
      await device.writeCharacteristicWithoutResponseForService(
        SERVICE_UUID, CHAR_WRITE_UUID, chunk.toString('base64')
      );
      await new Promise(r => setTimeout(r, 120));
    }

    // Dar tiempo al ESP32 de procesar y actualizar la característica (reinicia en ~2s)
    await new Promise(r => setTimeout(r, 3000));
    let char;
    try {
      char = await device.readCharacteristicForService(SERVICE_UUID, CHAR_READ_UUID);
    } catch {
      // El ESP32 reinició tras guardar — conexión caída = éxito
      return { status: 'ok', reiniciando: true };
    }
    if (!char.value) return { status: 'ok', reiniciando: true };
    const responseStr = Buffer.from(char.value, 'base64').toString('utf-8');
    let parsed: BleResponse;
    try {
      parsed = JSON.parse(responseStr) as BleResponse;
    } catch {
      return { status: 'ok', reiniciando: true };
    }
    // Solo falla si el Arduino reporta error explícito — cualquier otro estado
    // ('ready', 'ok', etc.) significa que el ESP32 ya procesó o está reiniciando
    if (parsed.status !== 'error') return { status: 'ok', reiniciando: true };
    return parsed;
  }, []);

  // ── Desconectar ───────────────────────────────────────────
  const disconnect = useCallback(async () => {
    try { await connectedDeviceRef.current?.cancelConnection(); } catch {}
    connectedDeviceRef.current = null;
    setConnected(false);
  }, []);

  return {
    devices, scanning, connecting, connected, error,
    startScan, stopScan, connect, sendConfig, disconnect,
  };
}
