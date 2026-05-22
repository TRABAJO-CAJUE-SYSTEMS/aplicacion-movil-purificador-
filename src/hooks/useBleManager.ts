import { useEffect, useRef, useState, useCallback } from 'react';
import { BleManager, Device, Characteristic } from 'react-native-ble-plx';
import { Alert, Platform, PermissionsAndroid } from 'react-native';
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
  status:      'ok' | 'error';
  reiniciando?: boolean;
  msg?:         string;
}

async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if ((Platform.Version as number) >= 31) {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return (
      results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]    === PermissionsAndroid.RESULTS.GRANTED &&
      results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
    );
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Permiso de ubicación para Bluetooth',
      message: 'La app necesita acceso a la ubicación para buscar dispositivos Bluetooth cercanos.',
      buttonPositive: 'Permitir',
      buttonNegative: 'Cancelar',
    }
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export function useBleManager() {
  const managerRef               = useRef<BleManager | null>(null);
  const connectedDeviceRef       = useRef<Device | null>(null);
  const scanTimeoutRef           = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [devices,    setDevices]    = useState<ScannedDevice[]>([]);
  const [scanning,   setScanning]   = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected,  setConnected]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // ── Inicializar manager (singleton) ──────────────────────
  const getManager = useCallback((): BleManager => {
    if (!managerRef.current) {
      managerRef.current = new BleManager();
    }
    return managerRef.current;
  }, []);

  // ── Detener escaneo ───────────────────────────────────────
  const stopScan = useCallback(() => {
    if (scanTimeoutRef.current) { clearTimeout(scanTimeoutRef.current); scanTimeoutRef.current = null; }
    managerRef.current?.stopDeviceScan();
    setScanning(false);
  }, []);

  // ── Cleanup al desmontar ──────────────────────────────────
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      stopScan();
      disconnect();
      managerRef.current?.destroy();
      managerRef.current = null;
    };
  }, []);

  // ── Escanear dispositivos BLE ─────────────────────────────
  const startScan = useCallback(async () => {
    setError(null);
    setDevices([]);
    setScanning(true);

    // 1. Pedir permisos en Android
    if (Platform.OS === 'android') {
      const granted = await requestBlePermissions();
      if (!granted) {
        setError('Permisos de Bluetooth denegados. Ve a Ajustes > Permisos y actívalos.');
        setScanning(false);
        return;
      }
    }

    const mgr = getManager();

    // Lee el estado BLE actual (emite inmediatamente con el estado real)
    const readState = (): Promise<string> =>
      new Promise((resolve) => {
        const sub = mgr.onStateChange((s) => { sub.remove(); resolve(s); }, true);
      });

    try {
      // 2. Estado inicial
      let state = await readState();

      if (state === 'Unsupported') {
        throw new Error('Este dispositivo no soporta Bluetooth Low Energy.');
      }
      if (state === 'Unauthorized') {
        throw new Error('Sin autorización para Bluetooth. Revisa los permisos de la app.');
      }

      // 3. Si BT está apagado → activarlo en Android, avisar en iOS
      if (state === 'PoweredOff') {
        if (Platform.OS === 'android') {
          await mgr.enable();
          // Re-leer estado DESPUÉS de enable() para evitar la race condition:
          // enable() puede resolver antes o después de que BT esté realmente ON.
          state = await readState();
        } else {
          throw new Error('Bluetooth desactivado. Ve a Ajustes → Bluetooth y actívalo.');
        }
      }

      // 4. Si aún no está encendido, esperar — usando emitCurrentValue:true para
      //    evitar perder la transición si ya ocurrió entre el readState y este punto.
      if (state !== 'PoweredOn') {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            sub.remove();
            reject(new Error('Tiempo de espera agotado al activar Bluetooth (10 s).'));
          }, 10000);
          const sub = mgr.onStateChange((s) => {
            if (s === 'PoweredOn') {
              clearTimeout(timer);
              sub.remove();
              resolve();
            } else if (['PoweredOff', 'Unsupported', 'Unauthorized'].includes(s)) {
              clearTimeout(timer);
              sub.remove();
              reject(new Error('Bluetooth no disponible.'));
            }
          }, true); // ← true: emite estado actual de inmediato, sin race condition
        });
      }

      // 5. Escanear — acepta name O localName para no perder dispositivos
      mgr.startDeviceScan(null, { allowDuplicates: false }, (err, device) => {
        if (err) {
          setError(err.message);
          setScanning(false);
          return;
        }
        const name = device?.name ?? device?.localName;
        if (!name) return;

        setDevices((prev) => {
          const exists = prev.find((d) => d.id === device!.id);
          const entry: ScannedDevice = {
            id:   device!.id,
            name,
            rssi: device!.rssi ?? -100,
          };
          if (exists) return prev.map((d) => d.id === device!.id ? entry : d);
          return [...prev, entry];
        });
      });

      scanTimeoutRef.current = setTimeout(stopScan, 15000);

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
      const device = await mgr.connectToDevice(deviceId);
      await device.discoverAllServicesAndCharacteristics();

      // Solicitar MTU grande para JSON completo
      try { await device.requestMTU(512); } catch { /* no crítico */ }

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

  // ── Enviar JSON al ESP32 ──────────────────────────────────
  const sendConfig = useCallback(async (payload: object): Promise<BleResponse> => {
    const device = connectedDeviceRef.current;
    if (!device) throw new Error('Sin dispositivo conectado');

    const jsonStr = JSON.stringify(payload);
    const bytes   = Buffer.from(jsonStr, 'utf-8');

    // Dividir en chunks si es necesario (MTU ≤ 512)
    const CHUNK_SIZE = 500;
    if (bytes.length > CHUNK_SIZE) {
      const chunks = [];
      for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        chunks.push(bytes.slice(i, i + CHUNK_SIZE));
      }
      for (let i = 0; i < chunks.length; i++) {
        const isLast  = i === chunks.length - 1;
        const chunk   = isLast ? Buffer.concat([chunks[i], Buffer.from('\n')]) : chunks[i];
        const b64     = chunk.toString('base64');
        await device.writeCharacteristicWithResponseForService(
          SERVICE_UUID, CHAR_WRITE_UUID, b64
        );
        // Pequeña pausa entre chunks
        await new Promise(r => setTimeout(r, 50));
      }
    } else {
      const b64 = bytes.toString('base64');
      await device.writeCharacteristicWithResponseForService(
        SERVICE_UUID, CHAR_WRITE_UUID, b64
      );
    }

    // Leer respuesta
    await new Promise(r => setTimeout(r, 500));
    const char = await device.readCharacteristicForService(SERVICE_UUID, CHAR_READ_UUID);
    if (!char.value) throw new Error('Sin respuesta del dispositivo');
    const responseStr = Buffer.from(char.value, 'base64').toString('utf-8');
    return JSON.parse(responseStr) as BleResponse;
  }, []);

  // ── Desconectar ───────────────────────────────────────────
  const disconnect = useCallback(async () => {
    try {
      await connectedDeviceRef.current?.cancelConnection();
    } catch { /* ignorar */ }
    connectedDeviceRef.current = null;
    setConnected(false);
  }, []);

  return {
    devices, scanning, connecting, connected, error,
    startScan, stopScan, connect, sendConfig, disconnect,
  };
}
