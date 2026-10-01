# TSOS Mobile Native Clients Specification (Android & iOS)
**Document Version:** 1.0.0  
**Android Platform:** Kotlin 2.1, Jetpack Compose, Android 10+ (API 29 to 35)  
**iOS Platform:** Swift 6.0, SwiftUI, iOS 16+  
**Target Hardware:** Waitstaff Handhelds, Sunmi V2 / PAX A920 Smart POS Terminals, Apple iPad POS Docks  
**Connectivity:** Bluetooth Low Energy (BLE), Wi-Fi Direct, Local LAN Socket (Port 9100)

---

## 1. Android Native Handheld Architecture (Kotlin & Jetpack Compose)

### 1.1 Tech Stack
- **UI Framework:** Jetpack Compose (Declarative UI matching TSOS design tokens)
- **Architecture:** MVI / Clean Architecture (ViewModel + StateFlow + Kotlin Coroutines)
- **Local Database:** Room Database with SQLCipher encryption and TypeConverters
- **Network & Sync:** Retrofit 2 + OkHttp with WebSocket client + WorkManager for offline replay
- **Hardware Drivers:** Android BluetoothGatt API & Sunmi Printer SDK AIDL IPC

### 1.2 Android BLE Thermal Printing Service
```kotlin
package com.tsos.pos.hardware.printer

import android.bluetooth.*
import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.*

class AndroidBlePrinterService(private val context: Context) {
    private var bluetoothGatt: BluetoothGatt? = null
    private var writeCharacteristic: BluetoothGattCharacteristic? = null

    companion object {
        // Standard Thermal Printer BLE Service UUID
        val PRINTER_SERVICE_UUID: UUID = UUID.fromString("000018f0-0000-1000-8000-00805f9b34fb")
        val PRINTER_WRITE_UUID: UUID = UUID.fromString("00002af1-0000-1000-8000-00805f9b34fb")
        const val CHUNK_SIZE = 128 // Safe negotiated MTU chunk size
    }

    suspend fun printBytes(device: BluetoothDevice, payload: ByteArray): Boolean = withContext(Dispatchers.IO) {
        val callback = object : BluetoothGattCallback() {
            override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
                if (newState == BluetoothProfile.STATE_CONNECTED) {
                    gatt.discoverServices()
                }
            }

            override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
                val service = gatt.getService(PRINTER_SERVICE_UUID)
                writeCharacteristic = service?.getCharacteristic(PRINTER_WRITE_UUID)
            }
        }

        bluetoothGatt = device.connectGatt(context, false, callback)
        // Send in throttled chunks to prevent buffer drop
        for (i in payload.indices step CHUNK_SIZE) {
            val end = (i + CHUNK_SIZE).coerceAtMost(payload.size)
            val chunk = payload.copyOfRange(i, end)
            writeCharacteristic?.let { char ->
                char.value = chunk
                bluetoothGatt?.writeCharacteristic(char)
                kotlinx.coroutines.delay(20) // 20ms pacing
            }
        }
        true
    }
}
```

### 1.3 Sunmi / PAX Built-In Hardware Printer Integration (AIDL)
Handheld Android POS terminals (Sunmi V2s, PAX A920) feature built-in thermal print heads connected via Android AIDL:
```kotlin
// Sunmi AIDL Service Binding
import woyou.aidlservice.jiuiv5.IWoyouService

class SunmiHardwarePrinter(private val context: Context) {
    private var woyouService: IWoyouService? = null

    fun bindService() {
        val intent = Intent("woyou.aidlservice.jiuiv5.IWoyouService")
        intent.setPackage("woyou.aidlservice.jiuiv5")
        context.bindService(intent, connection, Context.BIND_AUTO_CREATE)
    }

    fun printRawEscPos(data: ByteArray) {
        woyouService?.sendRAWData(data, null)
    }
}
```

---

## 2. iOS Native Handheld Architecture (Swift & SwiftUI)

### 2.1 Tech Stack
- **UI Framework:** SwiftUI with `@Observable` (iOS 17+) and SF Symbols
- **State Management:** Swift Actor concurrency model + Combine
- **Persistence:** SwiftData / SQLite for local offline order buffering
- **Bluetooth:** CoreBluetooth (`CBCentralManager`, `CBPeripheral`)

### 2.2 iOS CoreBluetooth Thermal Print Manager
```swift
import Foundation
import CoreBluetooth

class CoreBluetoothPrinterManager: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate, ObservableObject {
    var centralManager: CBCentralManager!
    var connectedPeripheral: CBPeripheral?
    var writeCharacteristic: CBCharacteristic?

    let serviceUUID = CBUUID(string: "18F0")
    let writeCharUUID = CBUUID(string: "2AF1")

    override init() {
        super.init()
        centralManager = CBCentralManager(delegate: self, queue: nil)
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn {
            centralManager.scanForPeripherals(withServices: [serviceUUID], options: nil)
        }
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
        connectedPeripheral = peripheral
        centralManager.stopScan()
        centralManager.connect(peripheral, options: nil)
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        peripheral.delegate = self
        peripheral.discoverServices([serviceUUID])
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard let service = peripheral.services?.first(where: { $0.uuid == serviceUUID }) else { return }
        peripheral.discoverCharacteristics([writeCharUUID], for: service)
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        writeCharacteristic = service.characteristics?.first(where: { $0.uuid == writeCharUUID })
    }

    func sendPrintJob(data: Data) {
        guard let peripheral = connectedPeripheral, let characteristic = writeCharacteristic else { return }
        
        let chunkSize = 100
        var offset = 0
        while offset < data.count {
            let chunk = data.subdata(in: offset..<min(offset + chunkSize, data.count))
            peripheral.writeValue(chunk, for: characteristic, type: .withoutResponse)
            offset += chunkSize
            Thread.sleep(forTimeInterval: 0.02)
        }
    }
}
```

---

## 3. Offline Data Synchronization & Conflict Resolution
Both Android and iOS clients implement the standard TSOS offline replication lifecycle:
1. **Local Append First:** Orders placed on mobile are immediately saved to local Room/SwiftData with `status = 'pending_sync'`.
2. **KOT Immediate Print:** Even if Wi-Fi is disconnected, local handhelds print the KOT via Bluetooth directly to the kitchen printer.
3. **Background Sync Worker (`WorkManager` / `BGAppRefreshTask`):** Automatically detects restored internet connectivity, batches offline orders, and executes HTTPS `POST /api/orders/sync-batch`.
4. **Idempotency Key:** Every order carries a client-generated UUID to guarantee zero duplicate charges on retry.

---

## 4. Customer Native Mobile Client (Table QR, Table Booking, Menu & Ordering)

### 4.1 Functional Scope
The Customer Android (Kotlin/Jetpack Compose) and iOS (SwiftUI) applications are dedicated to cafe guests:
- **Scan & Check-In:** High-performance CameraX / AVFoundation QR scanner scans table acrylic discs or NFC tags (e.g. Table T-04).
- **Table Booking & Floor Map:** Allows guests to view table occupancy, select party size (1-8 guests), and reserve or check into their table.
- **Interactive Menu:** Displays cafe categories, pure-veg/vegan/non-veg dietary flags, calorie & allergen badges, and customizable item sheets (milk choice, sweetness, extra shots).
- **Table Cart & Loyalty Redemption:** Integrates customer points balance (1 pt = ₹1 discount) with coupon codes and transparent CGST/SGST/Platform fee breakdown.
- **Instant UPI Intent Checkout:** Initiates standard NPCI UPI payment intents (`upi://pay?pa=merchant@upi&am=...&pn=TSOS+Cafe`) with automatic receipt generation and KOT routing to the kitchen.
- **Live KDS Tracker:** Real-time visual progress from Order Placed → Brewing in Kitchen → Table Delivery, with dining assistance calls (Water, Server).

### 4.2 Jetpack Compose Customer Implementation Pattern (Kotlin)
```kotlin
package com.tsos.customer.ui

import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage

@Composable
fun CustomerTableQrScanner(
    onTableScanned: (tableId: String) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = androidx.lifecycle.compose.LocalLifecycleOwner.current
    val barcodeScanner = remember { BarcodeScanning.getClient() }

    AndroidView(
        factory = { ctx ->
            val previewView = androidx.camera.view.PreviewView(ctx)
            val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)

            cameraProviderFuture.addListener({
                val cameraProvider = cameraProviderFuture.get()
                val preview = Preview.Builder().build().also {
                    it.setSurfaceProvider(previewView.surfaceProvider)
                }

                val imageAnalysis = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()

                imageAnalysis.setAnalyzer(androidx.core.content.ContextCompat.getMainExecutor(ctx)) { imageProxy ->
                    val mediaImage = imageProxy.image
                    if (mediaImage != null) {
                        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                        barcodeScanner.process(image)
                            .addOnSuccessListener { barcodes ->
                                for (barcode in barcodes) {
                                    barcode.rawValue?.let { rawValue ->
                                        if (rawValue.contains("tbl-") || rawValue.contains("table")) {
                                            onTableScanned(rawValue)
                                        }
                                    }
                                }
                            }
                            .addOnCompleteListener {
                                imageProxy.close()
                            }
                    } else {
                        imageProxy.close()
                    }
                }

                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(
                    lifecycleOwner,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    imageAnalysis
                )
            }, androidx.core.content.ContextCompat.getMainExecutor(ctx))

            previewView
        },
        modifier = Modifier.fillMaxSize()
    )
}
```

